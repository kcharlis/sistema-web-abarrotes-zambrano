import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill';
import type { BarcodeFormat } from 'barcode-detector/ponyfill';
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { X, ScanBarcode, SwitchCamera, ImageUp, Loader2, CheckCircle2 } from 'lucide-react';

// Empaqueta el wasm con la app (evita depender del CDN de jsDelivr).
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? zxingWasmUrl : `${prefix}${path}`
  }
});

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
  scannerId?: string;
  mode?: 'qr' | 'barcode' | 'all';
  errorMessage?: string | null;
}

type ScanMode = 'qr' | 'barcode' | 'all';
type CameraInfo = { id: string; label: string };

const QR_FORMATS: BarcodeFormat[] = ['qr_code'];
const LINEAR_FORMATS: BarcodeFormat[] = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'itf',
  'codabar'
];

const MODE_FORMATS: Record<ScanMode, BarcodeFormat[]> = {
  qr: QR_FORMATS,
  barcode: LINEAR_FORMATS,
  all: [...LINEAR_FORMATS, ...QR_FORMATS]
};

const VIRTUAL_CAMERA_PATTERN = /virtual|logi capture|obs|manycam|snap camera|xsplit|droidcam|iriun/i;
const BACK_CAMERA_PATTERN = /back|rear|trasera|posterior|environment|world|wide/i;
const DETECT_INTERVAL_MS = 120;
const COOLDOWN_MS = 2000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getErrorParts = (error: unknown) => {
  if (typeof error === 'string') {
    return { name: 'Error', message: error };
  }
  const err = error as { name?: string; message?: string };
  return { name: err?.name || 'Error', message: err?.message || '' };
};

const getTechnicalError = (error: unknown) => {
  if (!error) return '';
  const { name, message } = getErrorParts(error);
  const text = message ? `${name}: ${message}` : name;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
};

const getFriendlyCameraError = (error: unknown) => {
  const { name, message } = getErrorParts(error);
  const raw = `${name} ${message}`;

  if (/NotAllowed|Permission|PermissionDenied|SecurityError/i.test(raw)) {
    return 'No hay permiso para usar la cámara. Habilítalo en el navegador o usa "Subir foto".';
  }
  if (/NotReadable|Device in use|TrackStart|Could not start video/i.test(raw)) {
    return 'La cámara está ocupada por otra aplicación (Logi Capture, OBS, Zoom…). Ciérrala o usa "Subir foto".';
  }
  if (/Overconstrained|ConstraintNotSatisfied|Constraints/i.test(raw)) {
    return 'La cámara no admite la resolución solicitada y no respondió al reintento básico.';
  }
  if (/NotFound|DevicesNotFound|Requested device/i.test(raw)) {
    return 'No se encontró una cámara disponible en este equipo.';
  }
  return 'No se pudo iniciar ninguna cámara. Puedes usar "Subir foto" como respaldo.';
};

const cameraScore = (camera: CameraInfo) => {
  let score = 0;
  if (camera.label && !VIRTUAL_CAMERA_PATTERN.test(camera.label)) score += 4;
  else if (!camera.label) score += 1;
  if (BACK_CAMERA_PATTERN.test(camera.label)) score += 2;
  return score;
};

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onClose,
  title = 'Escaneando...',
  scannerId = 'barcode-reader',
  mode = 'all',
  errorMessage = null
}) => {
  const onScanRef = useRef(onScan);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const lockRef = useRef(false);
  const detectingRef = useRef(false);
  const pausedRef = useRef(false);
  const startTokenRef = useRef(0);
  const manualCameraRef = useRef(false);
  const attemptsRef = useRef(0);
  const detectFailuresRef = useRef(0);
  const wasmErrorShownRef = useRef(false);
  const cooldownRef = useRef<number | null>(null);

  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [scanAttempts, setScanAttempts] = useState(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Refresca el contador sin re-renderizar en cada frame.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setScanAttempts(attemptsRef.current);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // El track ya estaba detenido.
        }
      });
    }
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        // Sin problema si el video ya estaba pausado.
      }
      video.srcObject = null;
    }
  }, []);

  const refreshCameras = useCallback(async (): Promise<CameraInfo[]> => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const list = devices
        .filter(device => device.kind === 'videoinput')
        .map<CameraInfo>(device => ({
          id: device.deviceId,
          label: device.label || ''
        }))
        .sort((a, b) => cameraScore(b) - cameraScore(a));

      setCameras(list);
      return list;
    } catch (err) {
      console.warn('[BarcodeScanner] No se pudieron enumerar las cámaras:', err);
      return [];
    }
  }, []);

  const startCamera = useCallback(async (cameraId: string | null) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setLocalError('Este navegador no permite acceder a la cámara. Usa HTTPS o "Subir foto".');
      setIsStarting(false);
      return;
    }

    const token = ++startTokenRef.current;
    setIsStarting(true);
    setLocalError(null);
    setErrorDetail(null);
    attemptsRef.current = 0;
    detectFailuresRef.current = 0;
    setScanAttempts(0);

    stopStream();
    // Pausa para que Windows libere el dispositivo antes de reabrirlo.
    await delay(150);
    if (token !== startTokenRef.current) return;

    const hd: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    };

    const attempts: MediaStreamConstraints[] = [];
    if (cameraId) {
      attempts.push({ video: { ...hd, deviceId: { exact: cameraId } }, audio: false });
      attempts.push({ video: { deviceId: { exact: cameraId } }, audio: false });
    } else {
      attempts.push({ video: { ...hd, facingMode: { ideal: 'environment' } }, audio: false });
      attempts.push({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      attempts.push({ video: true, audio: false });
    }

    let lastError: unknown = null;

    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (token !== startTokenRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach(track => track.stop());
          setIsStarting(false);
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // Algunos navegadores requieren un gesto del usuario para reproducir.
        }

        const trackSettings = stream.getVideoTracks()[0]?.getSettings?.();
        const realDeviceId = trackSettings?.deviceId || cameraId || null;
        if (realDeviceId) {
          setSelectedCameraId(realDeviceId);
          setActiveCameraId(realDeviceId);
        }
        setIsStarting(false);
        return;
      } catch (err) {
        lastError = err;
        console.warn('[BarcodeScanner] Intento de cámara fallido:', constraints, err);
        await delay(200);
        if (token !== startTokenRef.current) return;
      }
    }

    if (token !== startTokenRef.current) return;
    setLocalError(getFriendlyCameraError(lastError));
    setErrorDetail(getTechnicalError(lastError));
    setIsStarting(false);
  }, [stopStream]);

  // Arranque: pide permiso, enumera y prioriza cámara trasera/física.
  useEffect(() => {
    let disposed = false;

    const boot = async () => {
      await startCamera(null);
      if (disposed) return;

      const list = await refreshCameras();
      if (disposed || manualCameraRef.current) return;

      const physical = list.filter(camera => !VIRTUAL_CAMERA_PATTERN.test(camera.label));
      const preferred =
        physical.find(camera => BACK_CAMERA_PATTERN.test(camera.label)) ||
        physical[0] ||
        list.find(camera => BACK_CAMERA_PATTERN.test(camera.label)) ||
        list[0];

      if (!preferred) return;

      const activeId = streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId;
      setSelectedCameraId(preferred.id);

      if (preferred.id !== activeId) {
        await startCamera(preferred.id);
      }
    };

    void boot();

    return () => {
      disposed = true;
      startTokenRef.current += 1;
      stopStream();
    };
  }, [startCamera, refreshCameras, stopStream]);

  const handleDetected = useCallback((rawValue: string) => {
    if (lockRef.current) return;
    lockRef.current = true;

    console.log('[BarcodeScanner] Detectado:', rawValue);
    if ('vibrate' in navigator) navigator.vibrate(80);

    setDetectedCode(rawValue);
    onScanRef.current(rawValue);

    if (cooldownRef.current) window.clearTimeout(cooldownRef.current);
    cooldownRef.current = window.setTimeout(() => {
      lockRef.current = false;
      setDetectedCode(null);
      cooldownRef.current = null;
    }, COOLDOWN_MS);
  }, []);

  // Bucle de escaneo sobre el <video>.
  useEffect(() => {
    let detector: BarcodeDetector | null = null;
    try {
      detector = new BarcodeDetector({ formats: MODE_FORMATS[mode] });
    } catch (err) {
      console.warn('[BarcodeScanner] Formatos no soportados, usando todos:', err);
      try {
        detector = new BarcodeDetector();
      } catch (fallbackErr) {
        console.error('[BarcodeScanner] No se pudo crear el detector:', fallbackErr);
        detector = null;
        setLocalError('El motor ZXing-WASM no está disponible en este navegador. Usa "Subir foto".');
        setErrorDetail(getTechnicalError(fallbackErr));
      }
    }
    detectorRef.current = detector;

    let cancelled = false;

    const tick = async () => {
      const video = videoRef.current;
      const activeDetector = detectorRef.current;
      if (
        cancelled ||
        pausedRef.current ||
        lockRef.current ||
        detectingRef.current ||
        !video ||
        !activeDetector ||
        video.readyState < 2 ||
        video.videoWidth === 0
      ) {
        return;
      }

      detectingRef.current = true;
      try {
        const codes = await activeDetector.detect(video);
        attemptsRef.current += 1;
        detectFailuresRef.current = 0;
        if (codes.length > 0 && !lockRef.current) {
          handleDetected(codes[0].rawValue);
        }
      } catch (err) {
        detectFailuresRef.current += 1;
        // Si ZXing-WASM nunca logra analizar, se avisa una sola vez.
        if (detectFailuresRef.current >= 5 && attemptsRef.current === 0 && !wasmErrorShownRef.current) {
          wasmErrorShownRef.current = true;
          console.warn('[BarcodeScanner] Error del motor ZXing-WASM:', err);
          setLocalError('El motor ZXing-WASM no pudo analizar el video. Prueba con "Subir foto".');
          setErrorDetail(getTechnicalError(err));
        }
      } finally {
        detectingRef.current = false;
      }
    };

    const timer = window.setInterval(() => {
      void tick();
    }, DETECT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      detectorRef.current = null;
    };
  }, [mode, handleDetected]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) window.clearTimeout(cooldownRef.current);
    };
  }, []);

  const handleSwitchCamera = () => {
    if (cameras.length < 2 || isStarting) return;

    manualCameraRef.current = true;
    const baseId = activeCameraId || selectedCameraId;
    const currentIndex = cameras.findIndex(camera => camera.id === baseId);
    const nextCamera = cameras[(currentIndex + 1) % cameras.length];

    lockRef.current = false;
    setDetectedCode(null);
    setLocalError(null);
    setErrorDetail(null);
    setSelectedCameraId(nextCamera.id);
    setActiveCameraId(nextCamera.id);
    void startCamera(nextCamera.id);
  };

  const handleFileScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    pausedRef.current = true;
    setIsFileScanning(true);
    setLocalError(null);
    setErrorDetail(null);

    let bitmap: ImageBitmap | null = null;

    try {
      const detector = detectorRef.current ?? new BarcodeDetector({ formats: MODE_FORMATS[mode] });

      let codes: Array<{ rawValue: string }> = [];
      try {
        bitmap = await createImageBitmap(file);
        codes = await detector.detect(bitmap);
      } catch (bitmapError) {
        console.warn('[BarcodeScanner] createImageBitmap falló, intentando con el archivo:', bitmapError);
        codes = await detector.detect(file);
      }

      attemptsRef.current += 1;

      if (!codes || codes.length === 0) {
        setLocalError('La foto no contiene un código de barras o QR legible. Acércate más y evita reflejos.');
        setErrorDetail('ZXing-WASM: 0 resultados en la imagen');
        return;
      }

      // La lectura desde archivo siempre debe disparar, aunque el cooldown
      // del video en vivo esté activo.
      lockRef.current = false;
      handleDetected(codes[0].rawValue);
    } catch (err) {
      console.warn('[BarcodeScanner] Error al leer la foto:', err);
      setLocalError('No se pudo leer el código de la imagen. Prueba con una foto más nítida y bien iluminada.');
      setErrorDetail(getTechnicalError(err));
    } finally {
      if (bitmap) {
        try {
          bitmap.close();
        } catch {
          // El navegador liberará la memoria igualmente.
        }
      }
      setIsFileScanning(false);
      pausedRef.current = false;
    }
  };

  const activeCameraIndex = cameras.findIndex(
    camera => camera.id === (activeCameraId || selectedCameraId)
  );
  const activeCamera = activeCameraIndex >= 0 ? cameras[activeCameraIndex] : null;
  const cameraButtonLabel =
    cameras.length > 0
      ? `Cámara ${activeCameraIndex >= 0 ? activeCameraIndex + 1 : 1}/${cameras.length}`
      : 'Cambiar cámara';
  const visibleError = localError || errorMessage;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in">
      <div className="flex justify-between items-center gap-3 p-4 bg-black/60 backdrop-blur-md border-b border-white/10 shrink-0">
        <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-white min-w-0">
          <ScanBarcode className="shrink-0" /> <span className="truncate">{title}</span>
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {cameras.length > 0 && (
            <button
              onClick={handleSwitchCamera}
              disabled={cameras.length < 2 || isStarting}
              className="flex items-center gap-2 px-3 py-2.5 bg-white/15 rounded-full hover:bg-white/25 text-white transition-colors text-[10px] sm:text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed"
              title={activeCamera?.label ? `Cambiar cámara (actual: ${activeCamera.label})` : 'Cambiar cámara'}
            >
              <SwitchCamera size={20} />
              <span>{cameraButtonLabel}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-3 bg-white/20 rounded-full hover:bg-white/30 text-white transition-colors"
            title="Cerrar escáner"
          >
            <X size={26} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
        <video
          ref={videoRef}
          id={scannerId}
          className="w-full max-w-xl max-h-full bg-black object-contain"
          autoPlay
          playsInline
          muted
        />

        {isStarting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70">
            <Loader2 className="animate-spin text-white" size={34} />
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Iniciando cámara...</p>
          </div>
        )}

        {detectedCode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-[92%] flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl shadow-lg animate-in zoom-in-95">
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="font-black text-xs truncate">{detectedCode}</span>
          </div>
        )}

        {visibleError && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-red-500 text-white px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-top duration-300 z-20">
            <p className="font-bold text-xs text-center">{visibleError}</p>
            {localError && errorDetail && (
              <p className="mt-1 text-[9px] font-mono font-normal text-center opacity-90 break-words leading-tight">
                {errorDetail}
              </p>
            )}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
          <p className="text-white/80 text-xs sm:text-sm font-medium text-center max-w-[90%]">
            Ubica el {mode === 'qr' ? 'código QR' : mode === 'barcode' ? 'código de barras' : 'código de barras o QR'} dentro del recuadro
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileScan}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isFileScanning}
            className="flex items-center gap-2 px-5 py-3 bg-white text-gray-900 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all disabled:opacity-60"
          >
            {isFileScanning ? <Loader2 size={18} className="animate-spin" /> : <ImageUp size={18} />}
            {isFileScanning ? 'LEYENDO FOTO...' : 'SUBIR FOTO'}
          </button>

          <div className="text-[9px] font-mono text-white/40">
            Motor: ZXing-WASM · Frames analizados: {scanAttempts}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;

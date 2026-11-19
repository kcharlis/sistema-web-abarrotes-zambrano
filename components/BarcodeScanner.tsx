import React, { useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  Html5QrcodeCameraScanConfig,
  CameraDevice
} from 'html5-qrcode';
import { X, ScanBarcode, SwitchCamera, ImageUp, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
  scannerId?: string;
  mode?: 'qr' | 'barcode' | 'all';
  errorMessage?: string | null;
}

type CameraAttempt = {
  deviceId?: string;
  facingMode?: 'user' | 'environment';
  hd: boolean;
};

const VIRTUAL_CAMERA_PATTERN = /virtual|logi capture|obs|manycam|snap camera|xsplit/i;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getFormatsForMode = (mode: 'qr' | 'barcode' | 'all'): Html5QrcodeSupportedFormats[] => {
  if (mode === 'qr') {
    return [Html5QrcodeSupportedFormats.QR_CODE];
  }

  const barcodeFormats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.ITF
  ];

  return mode === 'barcode'
    ? barcodeFormats
    : [...barcodeFormats, Html5QrcodeSupportedFormats.QR_CODE];
};

const getErrorParts = (error: unknown) => {
  if (typeof error === 'string') {
    return { name: 'Error', message: error };
  }
  const err = error as { name?: string; message?: string };
  return {
    name: err?.name || 'Error',
    message: err?.message || ''
  };
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

  if (/NotAllowed|Permission|PermissionDenied/i.test(raw)) {
    return 'No hay permiso para usar la cámara. Habilítalo en el navegador o usa "Subir foto".';
  }
  if (/NotReadable|Device in use|TrackStart|Could not start video/i.test(raw)) {
    return 'La cámara está ocupada por otra aplicación (por ejemplo Logi Capture u OBS). Ciérrala o usa "Subir foto".';
  }
  if (/Overconstrained|ConstraintNotSatisfied|Constraints/i.test(raw)) {
    return 'La cámara no admite la configuración solicitada. Se intentó sin resolución HD, pero no respondió.';
  }
  if (/NotFound|DevicesNotFound|Requested device/i.test(raw)) {
    return 'No se encontró una cámara disponible en este equipo.';
  }
  return 'No se pudo iniciar ninguna cámara. Puedes usar "Subir foto" como respaldo.';
};

const isPermissionError = (error: unknown) => {
  const { name, message } = getErrorParts(error);
  return /NotAllowed|Permission|PermissionDenied/i.test(`${name} ${message}`);
};

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ 
  onScan, 
  onClose, 
  title = "Escaneando...", 
  scannerId = "barcode-reader",
  mode = 'all',
  errorMessage = null
}) => {
  const onScanRef = useRef(onScan);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanLockedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const camerasRef = useRef<CameraDevice[]>([]);
  const lastErrorRef = useRef<unknown>(null);
  const runIdRef = useRef(0);
  const bootPromiseRef = useRef<Promise<void> | null>(null);
  const scanAttemptsRef = useRef(0);

  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [camerasReady, setCamerasReady] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  // ZXing JS lee 1D de forma más confiable en Chrome/Brave sobre Windows.
  const [engine, setEngine] = useState<'zxing' | 'native'>('zxing');
  const [scanAttempts, setScanAttempts] = useState(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Refresca el contador de frames sin re-renderizar en cada intento fallido.
  useEffect(() => {
    const timer = setInterval(() => {
      setScanAttempts(scanAttemptsRef.current);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const stopCurrentScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (err) {
      console.warn('No se pudo detener el escáner anterior:', err);
    }
    try {
      scanner.clear();
    } catch (err) {
      console.warn('No se pudo limpiar el escáner anterior:', err);
    }
  };

  // Detecta cámaras y prioriza una cámara física real sobre cámaras virtuales.
  useEffect(() => {
    let cancelled = false;

    Html5Qrcode.getCameras()
      .then(devices => {
        if (cancelled) return;
        const list = devices || [];
        camerasRef.current = list;
        setCameras(list);

        if (list.length > 0) {
          const physicalCamera = list.find(camera => !VIRTUAL_CAMERA_PATTERN.test(camera.label || ''));
          const preferredCamera = physicalCamera || list[0];
          setSelectedCameraId(previous => previous ?? preferredCamera.id);
          setActiveCameraId(previous => previous ?? preferredCamera.id);
          console.info(
            'Cámaras detectadas:',
            list.map(camera => `${camera.label || '(sin nombre)'} [${camera.id}]`).join(' | '),
            '→ preferida:',
            preferredCamera.label || preferredCamera.id
          );
        }

        setCamerasReady(true);
      })
      .catch(err => {
        console.warn('No se pudieron enumerar las cámaras:', err);
        if (!cancelled) setCamerasReady(true);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!camerasReady) return;

    let cancelled = false;
    const runId = ++runIdRef.current;
    const isCurrent = () => !cancelled && runId === runIdRef.current;

    setLocalError(null);
    setErrorDetail(null);
    setIsStarting(true);
    scanAttemptsRef.current = 0;
    setScanAttempts(0);

    const buildAttempts = (): CameraAttempt[] => {
      const attempts: CameraAttempt[] = [];
      const pushAttempt = (attempt: CameraAttempt) => {
        const exists = attempts.some(item =>
          item.deviceId === attempt.deviceId &&
          item.facingMode === attempt.facingMode &&
          item.hd === attempt.hd
        );
        if (!exists) attempts.push(attempt);
      };

      if (selectedCameraId) {
        pushAttempt({ deviceId: selectedCameraId, hd: true });
        pushAttempt({ deviceId: selectedCameraId, hd: false });
      }

      camerasRef.current.forEach(camera => {
        if (camera.id === selectedCameraId) return;
        pushAttempt({ deviceId: camera.id, hd: true });
        pushAttempt({ deviceId: camera.id, hd: false });
      });

      if (!selectedCameraId && camerasRef.current.length === 0) {
        pushAttempt({ facingMode: 'environment', hd: true });
        pushAttempt({ facingMode: 'environment', hd: false });
      }

      // Últimos recursos: cámara por orientación, sin restricciones de resolución.
      pushAttempt({ facingMode: 'environment', hd: false });
      pushAttempt({ facingMode: 'user', hd: false });

      return attempts;
    };

    const formatos = getFormatsForMode(mode);
    const qrbox: Html5QrcodeCameraScanConfig['qrbox'] = (viewfinderWidth, viewfinderHeight) =>
      mode === 'barcode'
        ? {
            width: Math.floor(viewfinderWidth * 0.92),
            height: Math.floor(viewfinderHeight * 0.65)
          }
        : {
            width: Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.78),
            height: Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.78)
          };

    const safeStop = async (instance: Html5Qrcode | null) => {
      if (!instance) return;
      if (scannerRef.current === instance) {
        scannerRef.current = null;
      }
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
      } catch (err) {
        console.warn('Error al detener intento de cámara:', err);
      }
      try {
        instance.clear();
      } catch (err) {
        console.warn('Error al limpiar intento de cámara:', err);
      }
    };

    const tryStartAttempt = async (attempt: CameraAttempt): Promise<boolean> => {
      if (!isCurrent()) return false;

      const element = document.getElementById(scannerId);
      if (!element) return false;
      element.innerHTML = '';

      const instance = new Html5Qrcode(scannerId, {
        formatsToSupport: formatos,
        experimentalFeatures: {
          // false = ZXing JS (1D confiable en Chrome/Brave Windows).
          useBarCodeDetectorIfSupported: engine === 'native'
        },
        verbose: false
      });
      scannerRef.current = instance;

      const videoConstraints: MediaTrackConstraints = attempt.deviceId
        ? { deviceId: { exact: attempt.deviceId } }
        : { facingMode: attempt.facingMode || 'environment' };

      if (attempt.hd) {
        videoConstraints.width = { ideal: 1280 };
        videoConstraints.height = { ideal: 720 };
      }

      const config: Html5QrcodeCameraScanConfig = {
        fps: 12,
        qrbox,
        disableFlip: false
      };

      try {
        await instance.start(
          videoConstraints,
          config,
          (decodedText) => {
            if (!isCurrent() || scanLockedRef.current) return;
            scanLockedRef.current = true;
            if ('vibrate' in navigator) navigator.vibrate(80);
            console.log('[BarcodeScanner] Detectado:', decodedText);
            try {
              instance.pause(true);
            } catch {
              // La pausa no es crítica.
            }
            onScanRef.current(decodedText);

            // Si el padre no cierra el escáner (código no encontrado), se
            // reactiva tras un breve enfriamiento para evitar ráfagas.
            setTimeout(() => {
              if (!isCurrent()) return;
              scanLockedRef.current = false;
              try {
                if (instance.isScanning) instance.resume();
              } catch {
                // Sin problema si el escáner ya se detuvo.
              }
            }, 1500);
          },
          (frameError) => {
            // Errores de lectura por frame: solo se cuentan para diagnóstico.
            scanAttemptsRef.current += 1;
            void frameError;
          }
        );

        if (!isCurrent()) {
          await safeStop(instance);
          return false;
        }

        lastErrorRef.current = null;
        setActiveCameraId(attempt.deviceId || null);
        setLocalError(null);
        setErrorDetail(null);
        setIsStarting(false);
        return true;
      } catch (err) {
        lastErrorRef.current = err;
        console.warn(
          `Intento de cámara fallido (${attempt.deviceId || attempt.facingMode || 'sin id'}, HD: ${attempt.hd}):`,
          err
        );
        await safeStop(instance);
        return false;
      }
    };

    const bootScanner = async () => {
      // Detiene y limpia por completo la instancia anterior.
      await stopCurrentScanner();
      if (!isCurrent()) return;

      // Pausa obligatoria para que Windows libere el dispositivo.
      await delay(250);
      if (!isCurrent()) return;

      const attempts = buildAttempts();
      let permissionDenied = false;

      for (const attempt of attempts) {
        if (!isCurrent()) return;

        const started = await tryStartAttempt(attempt);
        if (started) return;
        if (!isCurrent()) return;

        if (isPermissionError(lastErrorRef.current)) {
          permissionDenied = true;
          break;
        }

        await delay(250);
      }

      if (!isCurrent()) return;

      setLocalError(
        permissionDenied
          ? getFriendlyCameraError(lastErrorRef.current)
          : `${getFriendlyCameraError(lastErrorRef.current)}`
      );
      setErrorDetail(getTechnicalError(lastErrorRef.current));
      setIsStarting(false);
    };

    const bootPromise = bootScanner();
    bootPromiseRef.current = bootPromise;
    void bootPromise.finally(() => {
      if (bootPromiseRef.current === bootPromise) bootPromiseRef.current = null;
    });

    return () => {
      cancelled = true;
    };
  }, [camerasReady, mode, scannerId, selectedCameraId, restartToken, engine]);

  // Limpieza final al cerrar el escáner.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      void stopCurrentScanner();
    };
  }, []);

  const handleSwitchCamera = () => {
    if (cameras.length < 2 || isStarting) return;
    const baseId = activeCameraId || selectedCameraId;
    const currentIndex = cameras.findIndex(camera => camera.id === baseId);
    const nextCamera = cameras[(currentIndex + 1) % cameras.length];

    scanLockedRef.current = false;
    setLocalError(null);
    setErrorDetail(null);
    setActiveCameraId(nextCamera.id);
    setSelectedCameraId(nextCamera.id);
  };

  // Alterna entre el decodificador ZXing JS y el nativo (BarcodeDetector).
  const handleToggleEngine = () => {
    scanLockedRef.current = false;
    scanAttemptsRef.current = 0;
    setScanAttempts(0);
    setLocalError(null);
    setErrorDetail(null);
    setEngine(prev => (prev === 'zxing' ? 'native' : 'zxing'));
  };

  const handleFileScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    scanLockedRef.current = false;
    setLocalError(null);
    setErrorDetail(null);
    setIsFileScanning(true);

    // Espera a que termine el arranque de cámara en curso: así Windows libera
    // el dispositivo y scanFile no choca con un estado "SCANNING" a medias.
    const pendingBoot = bootPromiseRef.current;
    if (pendingBoot) {
      try {
        await pendingBoot;
      } catch (bootError) {
        console.warn('El arranque de cámara falló antes de leer la foto:', bootError);
      }
    }

    // Desde aquí controlamos el escáner: invalida cualquier arranque pendiente.
    runIdRef.current += 1;

    let scanner = scannerRef.current;
    if (!scanner) {
      const element = document.getElementById(scannerId);
      if (!element) {
        setIsFileScanning(false);
        return;
      }
      element.innerHTML = '';
      scanner = new Html5Qrcode(scannerId, {
        formatsToSupport: getFormatsForMode(mode),
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: engine === 'native'
        },
        verbose: false
      });
      scannerRef.current = scanner;
      setIsStarting(false);
    }

    const readFile = async (target: Html5Qrcode): Promise<string> => {
      // scanFile solo funciona cuando la cámara está detenida.
      if (target.isScanning) {
        try {
          await target.stop();
        } catch (stopError) {
          console.warn('No se pudo detener la cámara antes de leer la foto:', stopError);
        }
      }

      try {
        return await target.scanFile(file, true);
      } catch (firstError) {
        // Puede quedar una transición de estado tras detener la cámara.
        console.warn('Primer intento de lectura de foto falló, reintentando:', firstError);
        await delay(350);
        try {
          if (target.isScanning) await target.stop();
        } catch (retryStopError) {
          console.warn('No se pudo reiniciar el estado del escáner:', retryStopError);
        }
        return await target.scanFile(file, true);
      }
    };

    try {
      const decodedText = await readFile(scanner);
      if (!scanLockedRef.current) {
        scanLockedRef.current = true;
        if ('vibrate' in navigator) navigator.vibrate(80);
        onScanRef.current(decodedText);

        // Reactiva la cámara si el modal sigue abierto tras la lectura del archivo.
        setTimeout(() => {
          if (mountedRef.current) setRestartToken(token => token + 1);
        }, 900);
      }
    } catch (err) {
      console.warn('Error al leer el código desde la imagen:', err);
      setLocalError('No se pudo leer el código en la foto. Prueba con una imagen más nítida y bien iluminada.');
      setErrorDetail(getTechnicalError(err));
      scanLockedRef.current = false;
      setRestartToken(token => token + 1);
    } finally {
      setIsFileScanning(false);
    }
  };

  const activeCameraIndex = cameras.findIndex(
    camera => camera.id === (activeCameraId || selectedCameraId)
  );
  const cameraButtonLabel = cameras.length > 0
    ? `Cámara ${activeCameraIndex >= 0 ? activeCameraIndex + 1 : 1}/${cameras.length}`
    : 'Cambiar cámara';
  const activeCamera = activeCameraIndex >= 0 ? cameras[activeCameraIndex] : null;
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
        <div
          id={scannerId}
          className="w-full max-w-xl bg-black overflow-hidden [&_video]:w-full [&_video]:h-auto"
        />

        {isStarting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70">
            <Loader2 className="animate-spin text-white" size={34} />
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Iniciando cámara...</p>
          </div>
        )}

        {visibleError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-red-500 text-white px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-top duration-300 z-20">
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

          {/* Diagnóstico discreto del decodificador activo */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[9px] font-mono text-white/40">
            <span>
              Motor: {engine === 'native' ? 'Nativo' : 'ZXing'} · Frames analizados: {scanAttempts}
            </span>
            <button
              onClick={handleToggleEngine}
              className="px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/70 font-black uppercase tracking-wide transition-colors"
              title="Alternar decodificador manualmente (prueba)"
            >
              Usar {engine === 'native' ? 'ZXing' : 'Nativo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;

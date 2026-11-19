import React, { useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, ScanBarcode } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
  scannerId?: string;
  mode?: 'qr' | 'barcode' | 'all';
  errorMessage?: string | null;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ 
  onScan, 
  onClose, 
  title = "Escaneando...", 
  scannerId = "barcode-reader",
  mode = 'all',
  errorMessage = null
}) => {
  const onScanRef = React.useRef(onScan);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    let isMounted = true;
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      if (!isMounted) return;

      const element = document.getElementById(scannerId);
      if (!element) return;
      
      element.innerHTML = "";
      
      try {
        html5QrCode = new Html5Qrcode(scannerId);
        
        let formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13, 
          Html5QrcodeSupportedFormats.EAN_8, 
          Html5QrcodeSupportedFormats.UPC_A, 
          Html5QrcodeSupportedFormats.UPC_E, 
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        if (mode === 'qr') {
          formatsToSupport = [Html5QrcodeSupportedFormats.QR_CODE];
        } else if (mode === 'barcode') {
          formatsToSupport = [
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.EAN_8, 
            Html5QrcodeSupportedFormats.UPC_A, 
            Html5QrcodeSupportedFormats.UPC_E, 
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF
          ];
        }
        
        const config = { 
          fps: 20, 
          qrbox: mode === 'barcode' ? { width: 320, height: 120 } : { width: 280, height: 280 },
          formatsToSupport,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };
        
        // Wait a small extra buffer to ensure previous instances are cleared from systemic resources
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => {
            if (isMounted) onScanRef.current(decodedText);
          },
          () => {}
        );
      } catch(e: any) {
        if (!isMounted) return;
        console.error("Scanner error", e);
        
        // Specifically handle NotReadableError by retrying once
        if (e?.name === 'NotReadableError' || e?.message?.includes('NotReadableError') || e?.message?.includes('Device in use')) {
          console.warn("Camera occupied, retrying start in 500ms...");
          setTimeout(startScanner, 500);
          return;
        }

        // Only show message if it's a real failure and we are still mounted
        if (isMounted) {
            onCloseRef.current();
        }
      }
    };

    const timer = setTimeout(startScanner, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      const shutdown = async () => {
        if (html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              await html5QrCode.stop();
            }
            html5QrCode.clear();
          } catch (err) {
            console.warn("Error during scanner cleanup:", err);
          }
        }
      };
      shutdown();
    };
  }, [mode, scannerId]); // Reduced dependencies to prevent thrashing

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in">
      <div className="flex justify-between items-center p-4 bg-black/50 absolute top-0 w-full z-10">
        <h3 className="text-lg font-bold flex items-center gap-2 text-white">
          <ScanBarcode /> {title}
        </h3>
        <button 
          onClick={onClose} 
          className="p-3 bg-white/20 rounded-full hover:bg-white/30 text-white transition-colors"
        >
          <X size={28} />
        </button>
      </div>
      
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <div id={scannerId} className="w-full max-w-md h-auto overflow-hidden bg-black"></div>
        
        {/* Guía visual */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-blue-500/50 rounded-lg pointer-events-none animate-pulse ${
          mode === 'barcode' ? 'w-72 h-32' : 'w-64 h-64'
        }`}>
           <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/50"></div>
        </div>

        {errorMessage && (
          <div className="absolute top-[65%] left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg animate-in slide-in-from-top duration-300">
            {errorMessage}
          </div>
        )}
        
        <p className="absolute bottom-20 text-white/70 text-sm font-medium bg-black/50 px-4 py-2 rounded-full text-center max-w-[80%]">
          Ubica el {mode === 'qr' ? 'código QR' : mode === 'barcode' ? 'código de barras' : 'código de barras o QR'} dentro del recuadro
        </p>
      </div>
    </div>
  );
};

export default BarcodeScanner;

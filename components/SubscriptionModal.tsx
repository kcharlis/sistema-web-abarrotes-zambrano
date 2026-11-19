import React from 'react';
import { Check, X, ShieldCheck, Sparkles, Award } from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-[120] p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-all hover:scale-110 cursor-pointer shadow-lg"
          aria-label="Cerrar"
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-emerald-600 p-8 text-white text-center relative">
          <div className="w-16 h-16 bg-white/20 text-yellow-300 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-lg backdrop-blur-md border border-white/20">
            <Sparkles size={32} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-yellow-950 px-3 py-1 rounded-full inline-block mb-2">
            Prototipo Funcional TRL 5
          </span>
          <h2 className="text-2xl font-black italic tracking-tight">Todas las funciones activas</h2>
          <p className="text-blue-100 text-xs font-medium mt-1">Proyecto de Grado UNAD · Zambrano, Bolívar</p>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">
            Este aplicativo opera con <b>todas las funcionalidades Pro habilitadas al 100%</b> sin cobro comercial ni suscripciones de pago para las tiendas de abarrotes evaluadas:
          </p>

          <ul className="space-y-2.5 text-xs font-medium text-gray-700 dark:text-gray-200">
            <li className="flex items-center gap-2">
              <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={3} />
              <span>Inventario sin límites con cálculo automático de márgenes</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={3} />
              <span>Cobro de fiados por WhatsApp y semáforo de riesgo</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={3} />
              <span>Reportes financieros, auditoría y balance de hoy</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={3} />
              <span>Escáner óptico QR y de código de barras por cámara</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={3} />
              <span>Protección Habeas Data (Ley 1581) y comprobantes (Ley 527)</span>
            </li>
          </ul>

          <div className="pt-2">
            <button 
              onClick={onClose}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck size={20} />
              ENTENDIDO, CONTINUAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;

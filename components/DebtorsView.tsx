import React, { useState } from 'react';
import { MessageCircle, Plus, X, User, DollarSign, Phone, ChevronRight, History, Calendar, CheckCircle2, Trash2, AlertCircle, Wallet, CreditCard, Crown, Clock, Lock, ShieldCheck } from 'lucide-react';
import { Debtor, LogFunction, OperationType } from '../types';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, getFriendlyErrorMessage } from '../lib/firestoreUtils';

interface DebtorsViewProps {
  debtors: Debtor[];
  setDebtors: React.Dispatch<React.SetStateAction<Debtor[]>>;
  isPro?: boolean;
  onOpenPro?: () => void;
  onLog?: LogFunction;
  isGuest?: boolean;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const DebtorsView: React.FC<DebtorsViewProps> = ({ debtors, setDebtors, isPro = true, onOpenPro, onLog, isGuest = false }) => {
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null); 
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Transaction Mode inside Modal (Pay vs Add Debt)
  const [transactionMode, setTransactionMode] = useState<'pay' | 'add'>('pay');

  // Estado Add Manual
  const [newDebtorName, setNewDebtorName] = useState('');
  const [newDebtorAmount, setNewDebtorAmount] = useState('');
  const [newDebtorPhone, setNewDebtorPhone] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Estado Abonar/Sumar
  const [paymentAmount, setPaymentAmount] = useState('');

  // Cálculos para Badges
  const activeDebtors = debtors.filter(d => d.debt > 0);
  const maxDebt = activeDebtors.length > 0 ? Math.max(...activeDebtors.map(d => d.debt)) : 0;
  const maxDays = activeDebtors.length > 0 ? Math.max(...activeDebtors.map(d => d.days)) : 0;
  const visualDebtLimit = Math.max(150000, maxDebt * 1.1);

  const formatMoney = (amount: number) => '$ ' + amount.toLocaleString('es-CO');
  const formatDateTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const handleOpenDetail = (debtor: Debtor) => {
      setSelectedDebtor(debtor);
      setTransactionMode('pay');
      setPaymentAmount('');
  };

  const handleAddDebtor = async () => {
    const amount = parseInt(newDebtorAmount.replace(/\./g, ''));
    if (!newDebtorName.trim() || !amount) return;

    if (!consentAccepted) {
      alert('Debe marcar la casilla de autorización de datos personales (Ley 1581 de 2012) para registrar a este cliente.');
      return;
    }

    if (onLog) onLog(`Intentando guardar deudor: ${newDebtorName}, Monto: ${amount}`, 'info');

    const newId = generateUUID();
    const newConsentDate = new Date().toISOString();
    const newDebtor: Debtor = {
      id: newId,
      name: newDebtorName.trim(),
      phone: newDebtorPhone.trim() || undefined,
      days: 0,
      debt: amount,
      initial: newDebtorName.trim().slice(0, 2).toUpperCase(),
      risk: amount > 100000 ? 'high' : amount > 50000 ? 'medium' : 'low',
      payments: [],
      consentAccepted: true,
      consentDate: newConsentDate
    };

    // Optimistic
    setDebtors(prev => [newDebtor, ...prev]);
    setShowAddModal(false);
    resetForm();

    if (isGuest) {
        if (onLog) onLog('Guardado en memoria (Modo Invitado).', 'success');
        return;
    }

    try {
        if (!auth.currentUser) return;

        const payload = {
            id: newId,
            name: newDebtor.name,
            phone: newDebtor.phone || null,
            debt: amount,
            risk: newDebtor.risk,
            initial: newDebtor.initial,
            payments: [],
            consentAccepted: true,
            consentDate: newConsentDate,
            user_id: auth.currentUser.uid
        };
        
        if (onLog) onLog(`Enviando a Firestore...`, 'info');

        const debtorRef = doc(db, 'debtors', newId);
        await setDoc(debtorRef, payload).catch(e => handleFirestoreError(e, OperationType.CREATE, 'debtors'));

        if (onLog) onLog(`Guardado exitoso en DB con Ley 1581.`, 'success');
    } catch (e: unknown) {
        console.error("Exception:", e);
        if (onLog) onLog(`EXCEPCIÓN CRÍTICA: ${getFriendlyErrorMessage(e)}`, 'error');
        alert(getFriendlyErrorMessage(e));
    }
  };

  const handleOpenAddModal = () => {
    setShowAddModal(true);
  };

  const resetForm = () => { 
    setNewDebtorName(''); 
    setNewDebtorAmount(''); 
    setNewDebtorPhone(''); 
    setConsentAccepted(false);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setter(formatted);
  };

  const openWhatsApp = (e: React.MouseEvent, debtor: Debtor) => {
      e.stopPropagation();
      if (!debtor.phone) { alert("Este cliente no tiene teléfono guardado"); return; }
      const message = `Hola ${debtor.name}, le recordamos cordialmente su saldo pendiente de ${formatMoney(debtor.debt)} en SIGA Zambrano. ¡Agradecemos su preferencia!`;
      window.open(`https://wa.me/57${debtor.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleTransaction = async () => {
    try {
      if (!selectedDebtor || !paymentAmount) return;
      const amount = parseInt(paymentAmount.replace(/\./g, ''));
      if (amount <= 0) return;

      if (onLog) onLog(`Procesando transacción: ${transactionMode === 'pay' ? 'Abono' : 'Suma'} de ${amount} para ${selectedDebtor.name}`, 'info');

      let newDebt = selectedDebtor.debt;
      let newPayments = selectedDebtor.payments || [];

      if (transactionMode === 'pay') {
          newDebt = Math.max(0, selectedDebtor.debt - amount);
          newPayments = [{ id: generateUUID(), date: Date.now(), amount }, ...newPayments].sort((a, b) => b.date - a.date);
      } else {
          newDebt = selectedDebtor.debt + amount;
      }

      let newRisk: 'low' | 'medium' | 'high' = 'low';
      if (newDebt > 100000) newRisk = 'high';
      else if (newDebt > 50000) newRisk = 'medium';

      const updatedDebtor: Debtor = { ...selectedDebtor, debt: newDebt, risk: newRisk, payments: newPayments };

      // Optimistic
      setDebtors(prev => prev.map(d => d.id === selectedDebtor.id ? updatedDebtor : d));
      setSelectedDebtor(updatedDebtor);
      setPaymentAmount('');

      if (isGuest) {
          if (onLog) onLog('Actualizado en memoria (Modo Invitado).', 'success');
          return;
      }

      const debtorRef = doc(db, 'debtors', String(selectedDebtor.id));
      await updateDoc(debtorRef, {
          debt: newDebt,
          risk: newRisk,
          payments: newPayments
      }).catch(e => {
          handleFirestoreError(e, OperationType.UPDATE, 'debtors');
      });
      
      if (onLog) onLog(`Saldo actualizado correctamente.`, 'success');
    } catch (e) {
      const msg = getFriendlyErrorMessage(e);
      if (onLog) onLog(`Error: ${msg}`, 'error');
      alert(msg);
    }
  };

  const handleDeleteDebtor = async () => {
    try {
      if (!selectedDebtor) return;
      if (onLog) onLog(`Eliminando deudor: ${selectedDebtor.name}`, 'info');
      
      // Optimistic
      setDebtors(prev => prev.filter(d => d.id !== selectedDebtor.id));
      setShowDeleteConfirm(false);
      
      if (isGuest) {
          setSelectedDebtor(null);
          if (onLog) onLog('Eliminado de memoria (Modo Invitado).', 'success');
          return;
      }

      const debtorRef = doc(db, 'debtors', String(selectedDebtor.id));
      await deleteDoc(debtorRef).catch(e => {
          handleFirestoreError(e, OperationType.DELETE, 'debtors');
      });
      
      if (onLog) onLog(`Deudor eliminado.`, 'success');
      setSelectedDebtor(null);
    } catch (e) {
      const msg = getFriendlyErrorMessage(e);
      if (onLog) onLog(`Error: ${msg}`, 'error');
      alert(msg);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div>
              <h2 className="font-bold text-gray-800 dark:text-white text-lg">Control de Fiados</h2>
              <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500 font-medium">
                    Total por Cobrar: <b className="text-red-500 font-bold">{formatMoney(debtors.reduce((acc, curr) => acc + curr.debt, 0))}</b>
                  </p>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    {debtors.length} clientes
                  </span>
              </div>
          </div>
          <button 
            onClick={handleOpenAddModal} 
            className="p-3 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            title="Nuevo Cliente Fiado"
          >
            <Plus size={24} />
          </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Al día</span>
          <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><span className="w-2 h-2 rounded-full bg-yellow-500"></span>Alerta</span>
          <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><span className="w-2 h-2 rounded-full bg-red-500"></span>Peligro</span>
        </div>
        <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
          <ShieldCheck size={12} className="text-emerald-500" /> Ley 1581/2012
        </span>
      </div>
      
      {debtors.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
            <User size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold text-sm">No hay fiados pendientes</p>
            <p className="text-xs text-gray-400 mt-1">Registra nuevos créditos con el botón superior (+)</p>
          </div>
      ) : (
          debtors.map(debtor => {
            let borderColor = 'border-l-emerald-500';
            let barColor = 'bg-emerald-500';
            if (debtor.risk === 'medium') { borderColor = 'border-l-yellow-500'; barColor = 'bg-yellow-500'; }
            if (debtor.risk === 'high') { borderColor = 'border-l-red-500'; barColor = 'bg-red-500'; }
            
            const isPaid = debtor.debt === 0;
            if (isPaid) borderColor = 'border-l-gray-300 dark:border-l-gray-600 opacity-70';
            const isMaxDebt = !isPaid && debtor.debt === maxDebt && maxDebt > 0;
            const isOldest = !isPaid && debtor.days === maxDays && maxDays > 0;
            const isSpecial = isMaxDebt || isOldest;
            const debtProgress = Math.min(100, (debtor.debt / visualDebtLimit) * 100);

            return (
              <div 
                key={debtor.id} 
                onClick={() => handleOpenDetail(debtor)} 
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-l-4 ${borderColor} relative overflow-hidden transition-all active:scale-[0.99] cursor-pointer hover:shadow-md ${isSpecial ? 'ring-1 ring-blue-100 dark:ring-blue-900/30' : ''}`}
              >
                <div className="p-4 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isPaid ? 'bg-gray-100 dark:bg-gray-700 text-gray-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                      {isPaid ? <CheckCircle2 size={16}/> : debtor.initial}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`font-bold ${isPaid ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{debtor.name}</h4>
                          {debtor.consentAccepted && (
                            <span className="text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold" title="Habeas Data autorizado">
                              Ley 1581
                            </span>
                          )}
                        </div>
                        {isSpecial && !isPaid && (
                            <div className="flex flex-col">
                              <div className="h-px bg-gray-100 dark:bg-gray-700 w-full my-1"></div>
                              <div className="flex gap-1 mb-1">
                                {isMaxDebt && <span className="flex items-center gap-1 text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md font-bold"><Crown size={10} /> Mayor Deuda</span>}
                                {isOldest && <span className="flex items-center gap-1 text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md font-bold"><Clock size={10} /> Más Antiguo</span>}
                              </div>
                            </div>
                        )}
                        <p className="text-xs text-gray-500">{isPaid ? 'Pagado Totalmente' : `Debe hace ${debtor.days} días`}</p>
                    </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={`font-bold text-sm ${isPaid ? 'text-emerald-500' : 'text-red-500'}`}>{formatMoney(debtor.debt)}</span>
                      {debtor.phone && !isPaid && (
                        <button 
                          onClick={(e) => openWhatsApp(e, debtor)} 
                          className="w-9 h-9 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center active:scale-90 transition-all shadow-md shadow-emerald-500/30"
                          title="Cobro por WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </button>
                      )}
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                </div>
                {!isPaid && <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700"><div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${debtProgress}%` }}/></div>}
              </div>
            );
          })
      )}

      {/* Modal Nuevo Fiado con Ley 1581 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[30px] p-6 shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-white">Nuevo Fiado</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Registro de crédito en tienda</p>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 ml-1">Nombre Completo del Cliente *</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                              type="text" 
                              value={newDebtorName} 
                              onChange={(e) => setNewDebtorName(e.target.value)} 
                              placeholder="Ej: Carmen Gómez"
                              className="w-full bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-3 pl-10 outline-none text-gray-900 dark:text-white font-bold text-sm focus:border-blue-500"
                              autoFocus
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 ml-1">Número de WhatsApp (Opcional)</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                              type="tel" 
                              value={newDebtorPhone} 
                              onChange={(e) => setNewDebtorPhone(e.target.value.replace(/\D/g, ''))} 
                              placeholder="Ej: 3001234567"
                              className="w-full bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-3 pl-10 outline-none text-gray-900 dark:text-white font-bold text-sm focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 ml-1">Monto Inicial del Fiado *</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                              type="text" 
                              inputMode="numeric" 
                              value={newDebtorAmount} 
                              onChange={(e) => handleAmountChange(e, setNewDebtorAmount)} 
                              placeholder="0"
                              className="w-full bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-3 pl-10 outline-none font-bold text-gray-900 dark:text-white text-sm focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Checkbox Obligatorio Ley 1581 de 2012 */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={consentAccepted} 
                          onChange={(e) => setConsentAccepted(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                        <div className="text-[11px] leading-tight text-gray-800 dark:text-gray-200">
                          <span className="font-bold">El cliente autoriza el tratamiento de sus datos personales (Ley 1581 de 2012).</span>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                            Autorización para fines de contacto, recordatorios de cobro y registro de fiados en SIGA Zambrano.
                          </p>
                        </div>
                      </label>
                    </div>

                    <button 
                      onClick={handleAddDebtor} 
                      disabled={!consentAccepted || !newDebtorName.trim() || !newDebtorAmount}
                      className={`w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all ${
                        consentAccepted && newDebtorName.trim() && newDebtorAmount 
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' 
                          : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none'
                      }`}
                    >
                      Guardar Fiado con Consentimiento
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Detalle y Abonos del Deudor */}
      {selectedDebtor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[30px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto no-scrollbar relative">
                <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{selectedDebtor.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{selectedDebtor.phone || 'Sin teléfono'}</span>
                        {selectedDebtor.consentAccepted && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                            Ley 1581 de 2012
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDeleteConfirm(true)} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full text-red-500 hover:bg-red-100" title="Eliminar deudor">
                        <Trash2 size={20} />
                      </button>
                      <button onClick={() => setSelectedDebtor(null)} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:bg-gray-200">
                        <X size={20} />
                      </button>
                    </div>
                </div>
                <div className={`text-center py-6 rounded-2xl mb-6 transition-colors ${transactionMode === 'add' ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Saldo Pendiente</p>
                    <p className={`text-4xl font-black ${selectedDebtor.debt === 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatMoney(selectedDebtor.debt)}</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-4">
                    <button onClick={() => setTransactionMode('pay')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${transactionMode === 'pay' ? 'bg-white dark:bg-gray-600 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}><Wallet size={14} /> Abonar</button>
                    <button onClick={() => setTransactionMode('add')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${transactionMode === 'add' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}><CreditCard size={14} /> Sumar Deuda</button>
                </div>
                <div className="mb-6 animate-in fade-in">
                    <div className="flex gap-2">
                        <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span><input type="text" inputMode="numeric" value={paymentAmount} onChange={(e) => handleAmountChange(e, setPaymentAmount)} placeholder="0" className={`w-full bg-white dark:bg-gray-700 border-2 rounded-xl p-3 pl-8 outline-none font-bold text-gray-900 dark:text-white ${transactionMode === 'pay' ? 'border-emerald-100' : 'border-blue-100'}`} autoFocus/></div>
                        <button onClick={handleTransaction} disabled={!paymentAmount} className={`px-5 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all ${transactionMode === 'pay' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{transactionMode === 'pay' ? 'Abonar' : 'Sumar'}</button>
                    </div>
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><History size={16} className="text-gray-400" /> Historial de Abonos</h4>
                    <div className="bg-white dark:bg-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 overflow-hidden">
                        {(selectedDebtor.payments && selectedDebtor.payments.length > 0) ? selectedDebtor.payments.map((payment) => (<div key={payment.id} className="p-3 border-b border-gray-100 dark:border-gray-600 flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><div className="p-1.5 bg-gray-100 dark:bg-gray-600 rounded-lg"><Calendar size={14} /></div><span className="text-xs font-medium">{formatDateTime(payment.date)}</span></div><span className="font-bold text-emerald-500 text-sm">+{formatMoney(payment.amount)}</span></div>)) : <div className="p-6 text-center text-gray-400 text-xs">No hay abonos registrados aún.</div>}
                    </div>
                </div>
             </div>
        </div>
      )}

      {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-in fade-in backdrop-blur-sm">
             <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 text-center">
                 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} /></div>
                 <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">¿Eliminar Deudor?</h3>
                 <p className="text-xs text-gray-500 mb-6">Se borrará permanentemente el registro de este cliente y su historial de pagos.</p>
                 <div className="flex gap-3"><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl">Cancelar</button><button onClick={handleDeleteDebtor} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30">Sí, Eliminar</button></div>
             </div>
          </div>
      )}
    </div>
  );
};

export default DebtorsView;

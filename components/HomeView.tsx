import React, { useState } from 'react';
import { Plus, Receipt, X, Calendar, Trash2, FileText, Lock } from 'lucide-react';
import { TransactionType, Tab, Debtor, Transaction, UserRole } from '../types';
import { generateInvoicePDF } from '../lib/pdfUtils';

interface HomeViewProps {
  sales: number;
  expenses: number;
  onOpenCalc: (type: TransactionType) => void;
  setActiveTab: (tab: Tab) => void;
  recentDebtors: Debtor[];
  transactions: Transaction[]; 
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (id: string, newAmount: number, newDescription: string) => void;
  userRole?: UserRole;
}

const HomeView: React.FC<HomeViewProps> = ({ 
  sales, 
  expenses, 
  onOpenCalc, 
  setActiveTab, 
  recentDebtors, 
  transactions,
  onDeleteTransaction,
  userRole = 'admin'
}) => {
  const [activeHistoryType, setActiveHistoryType] = useState<TransactionType | null>(null);
  const balance = sales - expenses;

  const formatMoney = (amount: number) => 
    '$ ' + amount.toLocaleString('es-CO');

  const formatDate = (timestamp: number) => 
    new Date(timestamp).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });

  const historyTransactions = transactions
    .filter(t => t.type === activeHistoryType)
    .sort((a, b) => b.date - a.date);

  const isExpense = activeHistoryType === 'gasto';

  const handleExpenseClick = () => {
    if (userRole === 'dependiente') {
      alert('Acceso Denegado (Error 403): Solo el Administrador puede registrar o autorizar gastos administrativos.');
      return;
    }
    onOpenCalc('gasto');
  };

  const handleDeleteClick = (id: string) => {
    if (userRole === 'dependiente') {
      alert('Acceso Denegado (Error 403): Solo el Administrador tiene permisos para anular o eliminar transacciones del historial.');
      return;
    }
    onDeleteTransaction(id);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Balance Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 ${
          balance >= 0 
            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {balance >= 0 ? '¡Hoy vas Ganando! 😄' : 'Ojo: Más gastos 😬'}
        </div>
        <div className="text-center mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Saldo Total</p>
          <h2 className={`text-4xl font-extrabold ${balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
            {balance >= 0 ? '+' : ''}{formatMoney(balance)}
          </h2>
        </div>
        <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
          <div className="w-1/2 text-center border-r border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-emerald-50 py-1" onClick={() => setActiveHistoryType('venta')}>
             <span className="text-xs text-gray-500 block">Ventas</span>
             <span className="text-lg font-bold text-emerald-500 underline decoration-dotted">{formatMoney(sales)}</span>
          </div>
          <div className="w-1/2 text-center cursor-pointer hover:bg-red-50 py-1" onClick={() => setActiveHistoryType('gasto')}>
            <span className="text-xs text-gray-500 block">Gastos</span>
            <span className="text-lg font-bold text-red-500 underline decoration-dotted">{formatMoney(expenses)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => onOpenCalc('venta')} 
          className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white p-5 rounded-2xl flex flex-col items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Plus size={32} />
          <span className="font-bold">VENDER</span>
        </button>

        <button 
          onClick={handleExpenseClick} 
          className={`p-5 rounded-2xl flex flex-col items-center gap-2 shadow-lg transition-all active:scale-95 ${
            userRole === 'dependiente' 
              ? 'bg-gray-400/80 text-white cursor-not-allowed shadow-none' 
              : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
          }`}
          title={userRole === 'dependiente' ? 'Restringido a Administrador' : 'Registrar Gasto'}
        >
          {userRole === 'dependiente' ? <Lock size={32} /> : <Receipt size={32} />}
          <div className="flex items-center gap-1">
            <span className="font-bold">GASTAR</span>
            {userRole === 'dependiente' && <span className="text-[10px] font-mono opacity-80">(403)</span>}
          </div>
        </button>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800 dark:text-white">Deudores Recientes</h3><button onClick={() => setActiveTab('debtors')} className="text-blue-500 text-sm font-semibold hover:underline">Ver todo</button></div>
        <div className="space-y-3">
          {recentDebtors.slice(0, 3).map(debtor => (
            <div key={debtor.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl flex justify-between items-center border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">{debtor.initial}</div>
                <div><h4 className="font-bold text-gray-800 dark:text-white text-sm">{debtor.name}</h4><p className="text-xs text-gray-500">{debtor.days === 0 ? 'Hoy' : `Hace ${debtor.days} días`}</p></div>
              </div>
              <span className="font-bold text-red-500">{formatMoney(debtor.debt)}</span>
            </div>
          ))}
          {recentDebtors.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No hay deudas recientes.</p>}
        </div>
      </div>

      {activeHistoryType && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[30px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
                 <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Historial de {isExpense ? 'Gastos' : 'Ventas'}</h3>
                    <button onClick={() => setActiveHistoryType(null)} className="p-3 bg-gray-100 rounded-full text-gray-500"><X size={24} /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                     {historyTransactions.map(tx => (
                         <div key={tx.id} className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-gray-700/50">
                             <div className="flex items-center gap-3 overflow-hidden">
                                 <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0 ${activeHistoryType === 'gasto' ? 'text-red-500' : 'text-emerald-500'}`}><Receipt size={18} /></div>
                                 <div className="min-w-0">
                                     <h4 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-1">{tx.description}</h4>
                                     <p className="text-[10px] text-gray-500 flex items-center gap-1"><Calendar size={10} /> {formatDate(tx.date)}</p>
                                 </div>
                             </div>
                             <div className="flex flex-col items-end gap-1">
                                 <span className={`font-bold text-sm ${activeHistoryType === 'gasto' ? 'text-red-500' : 'text-emerald-500'}`}>{formatMoney(tx.amount)}</span>
                                 <div className="flex gap-1">
                                     {!isExpense && (
                                       <button onClick={() => generateInvoicePDF(tx)} className="p-2 text-emerald-600 bg-emerald-50 rounded-lg flex items-center gap-1 hover:bg-emerald-100">
                                           <FileText size={16} />
                                           <span className="text-[10px] font-bold">PDF</span>
                                       </button>
                                     )}
                                     {userRole === 'admin' ? (
                                       <button onClick={() => handleDeleteClick(tx.id)} className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100" title="Eliminar transacción">
                                         <Trash2 size={16} />
                                       </button>
                                     ) : (
                                       <button onClick={() => handleDeleteClick(tx.id)} className="p-2 text-gray-300 bg-gray-100 rounded-lg cursor-not-allowed" title="Eliminar restringido (403)">
                                         <Lock size={16} />
                                       </button>
                                     )}
                                 </div>
                             </div>
                         </div>
                     ))}
                     {historyTransactions.length === 0 && (
                       <p className="text-center text-gray-400 text-xs py-8">No hay transacciones registradas.</p>
                     )}
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;

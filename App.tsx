import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Sun, LogOut, Loader2, AlertTriangle, Gem, RefreshCw, Info, ShieldCheck, ShieldAlert, Lock, User } from 'lucide-react';
import { Tab, TransactionType, InventoryItem, Debtor, Transaction, OperationType, UserRole } from './types';
import HomeView from './components/HomeView';
import InventoryView from './components/InventoryView';
import DebtorsView from './components/DebtorsView';
import ReportsView from './components/ReportsView';
import BottomNav from './components/BottomNav';
import CalculatorModal from './components/CalculatorModal';
import SubscriptionModal from './components/SubscriptionModal';
import AuthScreen from './components/AuthScreen';
import LandingView from './components/LandingView';
import { db, auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, setDoc, limit, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, getFriendlyErrorMessage, normalizeBarcode } from './lib/firestoreUtils';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isBulk?: boolean;
  bulkUnits?: number;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function App() {
  const [session, setSession] = useState<{ user: { uid: string; email: string | null; emailVerified: boolean; displayName?: string | null } } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('tf_guest_mode') === 'true'); 
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  // Rol de usuario: admin vs dependiente
  const [userRole, setUserRole] = useState<UserRole>(() => (localStorage.getItem('tf_user_role') as UserRole) || 'admin');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    localStorage.setItem('tf_user_role', userRole);
  }, [userRole]);

  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(() => (localStorage.getItem('tf_active_tab') as Tab) || 'home');

  useEffect(() => {
    localStorage.setItem('tf_active_tab', activeTab);
  }, [activeTab]);
  
  const [showSubModal, setShowSubModal] = useState(false);
  const [isPro] = useState(true); // Siempre Pro en prototipo TRL 5
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcType, setCalcType] = useState<TransactionType>('venta');

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSession({ 
          user: { 
            uid: user.uid, 
            email: user.email, 
            emailVerified: user.emailVerified,
            displayName: user.displayName || user.email?.split('@')[0] || 'Usuario'
          } 
        });
        setIsGuest(false);
        setIsEmailVerified(user.emailVerified);
        localStorage.setItem('tf_guest_mode', 'false');
      } else {
        setSession(null);
        setIsEmailVerified(false);
        const guestMode = localStorage.getItem('tf_guest_mode') === 'true';
        if (guestMode) {
          fetchLocalData();
        } else {
          setSessionChecked(true);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const [lastFetchedUid, setLastFetchedUid] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.uid && session.user.uid !== lastFetchedUid) {
      setLastFetchedUid(session.user.uid);
      fetchData(session.user.uid);
    }
  }, [session?.user?.uid, lastFetchedUid]);

  useEffect(() => {
    if (isGuest) {
      localStorage.setItem('tf_local_inventory', JSON.stringify(inventory));
      localStorage.setItem('tf_local_transactions', JSON.stringify(transactions));
      localStorage.setItem('tf_local_debtors', JSON.stringify(debtors));
    }
  }, [inventory, transactions, debtors, isGuest]);

  const reloadUser = async () => {
    if (!auth.currentUser) return;
    setIsReloading(true);
    await auth.currentUser.reload();
    setIsEmailVerified(auth.currentUser.emailVerified);
    setIsReloading(false);
  };

  const fetchData = async (userId: string) => {
    try {
        // Fetch Inventory
        const invRef = collection(db, 'inventory');
        const invQuery = query(invRef, where('user_id', '==', userId));
        const invSnapshot = await getDocs(invQuery);
        const invData = invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setInventory(invData.map((i: any) => ({
            id: i.id, 
            name: i.name, 
            category: i.category || 'General', 
            stock: Number(i.stock), 
            initialStock: Number(i.initialStock || i.stock), 
            minStock: Number(i.minStock || 0), 
            unit: i.unit, 
            cost: Number(i.cost), 
            price: Number(i.price), 
            isPaid: i.isPaid, 
            supplierDebt: Number(i.supplierDebt), 
            user_id: i.user_id, 
            icon: i.icon,
            barcode: i.barcode ? normalizeBarcode(i.barcode) : undefined,
            unitsPerPackage: (i.unitsPerPackage !== undefined && i.unitsPerPackage !== null) ? Number(i.unitsPerPackage) : undefined,
            bulkUnit: i.bulkUnit,
            bulkPrice: (i.bulkPrice !== undefined && i.bulkPrice !== null) ? Number(i.bulkPrice) : undefined,
            profitPercent: (i.profitPercent !== undefined && i.profitPercent !== null) ? Number(i.profitPercent) : undefined,
            bulkProfitPercent: (i.bulkProfitPercent !== undefined && i.bulkProfitPercent !== null) ? Number(i.bulkProfitPercent) : undefined,
            expirationDate: i.expirationDate || undefined
        })));

        // Fetch Transactions
        const txRef = collection(db, 'transactions');
        const txQuery = query(txRef, where('user_id', '==', userId), limit(1000));
        const txSnapshot = await getDocs(txQuery);
        const txData = txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sortedTx = txData.map((t: any) => {
            let dateValue: number;
            if (typeof t.date === 'number') {
                dateValue = t.date;
            } else if (t.date && typeof t.date === 'string') {
                const isoDate = t.date.includes('T') ? t.date : t.date.replace(' ', 'T');
                dateValue = new Date(isoDate).getTime();
            } else if (t.date && t.date.seconds) {
                dateValue = t.date.seconds * 1000;
            } else {
                dateValue = Date.now();
            }

            return {
                id: t.id, 
                type: t.type, 
                amount: Number(t.amount || 0), 
                date: isNaN(dateValue) ? Date.now() : dateValue, 
                description: t.description || '', 
                items: Array.isArray(t.items) ? t.items : [], 
                user_id: t.user_id
            };
        }).sort((a, b) => b.date - a.date);

        setTransactions(sortedTx);

        // Fetch Debtors
        const debRef = collection(db, 'debtors');
        const debQuery = query(debRef, where('user_id', '==', userId));
        const debSnapshot = await getDocs(debQuery);
        const debData = debSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setDebtors(debData.map((d: any) => ({
            id: d.id, 
            name: d.name, 
            phone: d.phone, 
            debt: Number(d.debt), 
            risk: d.risk, 
            days: 0, 
            initial: d.initial, 
            payments: d.payments || [], 
            consentAccepted: Boolean(d.consentAccepted),
            consentDate: d.consentDate || undefined,
            user_id: d.user_id
        })));
    } catch (e) { 
        console.error(e); 
        alert(getFriendlyErrorMessage(e));
    } finally { 
        setSessionChecked(true);
    }
  };

  const fetchLocalData = () => {
    setInventory(JSON.parse(localStorage.getItem('tf_local_inventory') || '[]'));
    setTransactions(JSON.parse(localStorage.getItem('tf_local_transactions') || '[]'));
    setDebtors(JSON.parse(localStorage.getItem('tf_local_debtors') || '[]'));
    setSessionChecked(true);
  };

  const handleLogout = async () => {
      setIsLoggingOut(true);
      try {
        await signOut(auth);
        setSession(null);
        setIsGuest(false);
        setInventory([]);
        setTransactions([]);
        setDebtors([]);
        setLastFetchedUid(null);
        setActiveTab('home');
        localStorage.removeItem('tf_guest_mode');
        localStorage.removeItem('tf_local_inventory');
        localStorage.removeItem('tf_local_transactions');
        localStorage.removeItem('tf_local_debtors');
      } finally {
        setIsLoggingOut(false);
      }
  };

  const handleConfirmTransaction = async (
    amount: number, 
    isCredit?: boolean, 
    clientName?: string, 
    clientPhone?: string, 
    cartItems?: CartItem[], 
    description?: string, 
    type?: TransactionType,
    consentAccepted?: boolean
  ) => {
    try {
      const txType = type || calcType;
      const txId = generateUUID();
      const txDesc = description || (txType === 'gasto' ? 'Gasto' : (cartItems?.length ? `Venta: ${cartItems.length} items` : 'Venta General'));
      const txItems = (cartItems || []).map(c => ({ id: String(c.id), name: c.name, quantity: Number(c.quantity), price: Number(c.price) }));
      const nowTimestamp = Date.now();
      
      const sessUid = session?.user?.uid;
      const newTx: Transaction = { 
        id: txId, 
        type: txType, 
        amount: Number(amount), 
        date: nowTimestamp,
        description: txDesc, 
        items: txItems, 
        user_id: sessUid 
      };

      // Actualización optimista del estado local
      setTransactions(prev => [newTx, ...prev]);

      if (txType === 'venta') {
        if (cartItems?.length) {
            const updatedInv = inventory.map(invItem => {
                const soldItem = cartItems.find(c => String(c.id) === String(invItem.id));
                const deduction = soldItem ? (soldItem.isBulk ? (soldItem.quantity * (soldItem.bulkUnits || 1)) : soldItem.quantity) : 0;
                return soldItem ? { ...invItem, stock: Math.max(0, invItem.stock - deduction) } : invItem;
            });
            setInventory(updatedInv);
            if (isGuest) localStorage.setItem('tf_local_inventory', JSON.stringify(updatedInv));
            
            if (!isGuest && auth.currentUser) {
                const batch = writeBatch(db);
                for (const soldItem of cartItems) {
                    const item = inventory.find(i => i.id === soldItem.id);
                    if (item) {
                        const deduction = soldItem.isBulk ? (soldItem.quantity * (soldItem.bulkUnits || 1)) : soldItem.quantity;
                        const newStock = Math.max(0, item.stock - deduction);
                        const itemRef = doc(db, 'inventory', String(soldItem.id));
                        batch.update(itemRef, { stock: newStock });
                    }
                }
                await batch.commit().catch(e => handleFirestoreError(e, OperationType.UPDATE, 'inventory'));
            }
        }

        if (isCredit && clientName) {
          const existing = debtors.find(d => d.name.toLowerCase() === clientName.toLowerCase().trim());
          if (existing) {
              const newDebt = existing.debt + amount;
              setDebtors(prev => {
                const updated = prev.map(d => d.id === existing.id ? { ...d, debt: newDebt } : d);
                if (isGuest) localStorage.setItem('tf_local_debtors', JSON.stringify(updated));
                return updated;
              });
              if (!isGuest) {
                  const debtorRef = doc(db, 'debtors', String(existing.id));
                  await updateDoc(debtorRef, { debt: newDebt }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'debtors'));
              }
          } else {
              const newDebId = generateUUID();
              const newConsentDate = new Date().toISOString();
              const newDebtor: Debtor = { 
                id: newDebId, 
                name: clientName.trim(), 
                phone: clientPhone?.trim() || undefined, 
                debt: amount, 
                risk: 'low', 
                initial: clientName.trim().slice(0, 2).toUpperCase(), 
                days: 0, 
                payments: [],
                consentAccepted: consentAccepted ?? true,
                consentDate: newConsentDate
              };
              setDebtors(prev => {
                const updated = [newDebtor, ...prev];
                if (isGuest) localStorage.setItem('tf_local_debtors', JSON.stringify(updated));
                return updated;
              });
              if (!isGuest && auth.currentUser) {
                  const debtorRef = doc(db, 'debtors', newDebId);
                  await setDoc(debtorRef, { 
                    ...newDebtor, 
                    user_id: auth.currentUser.uid 
                  }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'debtors'));
              }
          }
        }
      }

      if (!isGuest && auth.currentUser) {
          const txRef = doc(db, 'transactions', txId);
          await setDoc(txRef, { 
              ...newTx, 
              date: new Date(nowTimestamp).toISOString(),
              user_id: auth.currentUser.uid 
          }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'transactions'));
      }
    } catch (e) {
      alert(getFriendlyErrorMessage(e));
    }
  };

  const handleRoleBadgeClick = () => {
    if (userRole === 'dependiente') {
      setShowPinModal(true);
      setPinInput('');
      setPinError(false);
    } else {
      const confirmSwitch = window.confirm('¿Deseas cambiar al rol de Dependiente (Modo Mostrador)? Las acciones administrativas y reportes quedarán restringidas.');
      if (confirmSwitch) {
        setUserRole('dependiente');
      }
    }
  };

  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.trim() === '2026') {
      setUserRole('admin');
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  if (isLoggingOut) return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
      <Loader2 className="animate-spin text-blue-500 w-16 h-16 mb-6" />
      <h2 className="text-2xl font-black text-white italic tracking-tighter">Cerrando Sesión...</h2>
      <p className="text-gray-400 mt-2 text-sm">Esperamos verte pronto en SIGA Zambrano</p>
    </div>
  );

  if (showLanding) return <LandingView onStart={() => { setShowLanding(false); localStorage.setItem('tf_landing_seen', 'true'); }} />;
  if (!sessionChecked) return (
    <div className="min-h-screen bg-blue-600 flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] overflow-hidden">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-24 h-24 bg-white/20 rounded-[35px] flex items-center justify-center backdrop-blur-xl mb-8 shadow-2xl border border-white/20 relative"
      >
        <Gem className="text-white w-12 h-12" />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -inset-4 bg-white/10 rounded-full blur-2xl"
        />
      </motion.div>
      <div className="flex flex-col items-center">
        <Loader2 className="animate-spin text-white w-10 h-10 mb-4 opacity-80" />
        <motion.h2 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-white font-black uppercase tracking-widest text-xs italic"
        >
          Cargando SIGA Zambrano...
        </motion.h2>
        <p className="text-blue-100/40 text-[10px] mt-2 font-medium tracking-tight">Preparando inventario y sincronización</p>
      </div>
    </div>
  );
  if (!session && !isGuest) return (
    <AuthScreen 
      onLoginSuccess={(role) => { if (role) setUserRole(role); }} 
      onGuestAccess={(role) => { if (role) setUserRole(role); setIsGuest(true); localStorage.setItem('tf_guest_mode', 'true'); fetchLocalData(); }} 
      onShowLanding={() => setShowLanding(true)}
      initialRole={userRole}
      onRoleSelect={(role) => setUserRole(role)}
    />
  );

  const getTabTitle = (tab: Tab) => {
    switch(tab) {
      case 'home': return 'Resumen de Hoy';
      case 'inventory': return 'Mi Inventario';
      case 'debtors': return 'Control de Fiados';
      case 'reports': return 'Reportes y Ganancias';
      default: return 'SIGA Zambrano';
    }
  };

  return (
    <div className="flex justify-center min-h-screen bg-gray-100 dark:bg-gray-950 font-sans pb-20">
      <div className="w-full max-w-xl h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col relative shadow-2xl overflow-hidden sm:h-[94vh] sm:rounded-[45px] sm:my-auto sm:border-[12px] sm:border-gray-900">
        
        {/* Header con Rol Badge */}
        <header className="bg-blue-600 text-white pt-12 pb-6 px-6 rounded-b-[35px] shadow-lg z-10 shrink-0 relative">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl shadow-inner border border-white/20 backdrop-blur-md">
                 <Gem className="text-yellow-300" size={28} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 overflow-hidden max-w-[210px]">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-blue-200 uppercase tracking-wider leading-none">
                      {isGuest ? '👤 Modo Offline' : '👋 Hola,'}
                    </span>
                    <span className="text-sm font-black text-white truncate max-w-[140px] mt-0.5 italic">
                      {isGuest ? 'Explorando' : (session?.user?.displayName || 'Mi Tienda')}
                    </span>
                  </div>

                  {/* Badge de Rol Interactivo */}
                  <button 
                    onClick={handleRoleBadgeClick}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm active:scale-95 ${
                      userRole === 'admin'
                        ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 hover:bg-emerald-500/40'
                        : 'bg-amber-400 text-amber-950 border border-amber-300 hover:bg-amber-300'
                    }`}
                    title={userRole === 'admin' ? 'Rol actual: Administrador (Clic para cambiar a Dependiente)' : 'Rol actual: Dependiente (Clic para PIN 2026 de Administrador)'}
                  >
                    {userRole === 'admin' ? <ShieldCheck size={11} /> : <Lock size={11} />}
                    <span>{userRole === 'admin' ? 'Rol: Admin' : 'Rol: Dependiente'}</span>
                  </button>
                </div>

                <div className="mt-2 h-px bg-white/10 w-full" />
                <div className="flex justify-between items-end mt-1">
                  <h1 className="text-2xl font-black tracking-tighter italic leading-tight font-display">{getTabTitle(activeTab)}</h1>
                  <span className="text-blue-100/50 text-[8px] font-black uppercase mb-1 whitespace-nowrap cursor-pointer hover:text-blue-200" onClick={() => setShowLanding(true)}>
                    {isGuest ? '• OFFLINE' : '• CLOUD'} | VER INFO
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setShowLanding(true)} 
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-95 group"
                title="Información del Proyecto UNAD"
              >
                <Info size={16} className="group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Info</span>
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 bg-blue-500/50 rounded-full text-white transition-colors">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
              <button onClick={handleLogout} className="p-2.5 bg-red-500/20 hover:bg-red-500/40 rounded-full text-white transition-colors"><LogOut size={18} /></button>
            </div>
          </div>

          {session && !isEmailVerified && (
            <div className="mt-4 bg-red-500/40 border border-red-500/50 p-4 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-3 text-red-50">
                <AlertTriangle size={20} className="shrink-0" />
                <div className="text-[10px] leading-tight font-bold uppercase italic">
                  Su cuenta no está verificada. <br/> No podrá sincronizar datos remotos.
                </div>
              </div>
              <button 
                onClick={reloadUser}
                disabled={isReloading}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all disabled:opacity-50"
              >
                {isReloading ? <RefreshCw className="animate-spin w-3 h-3" /> : 'Verificar'}
              </button>
            </div>
          )}
        </header>

        {/* Modal PIN de Administrador (PIN: 2026) */}
        {showPinModal && (
          <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl max-w-xs w-full animate-in zoom-in-95 text-center">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Lock size={26} />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Cambiar a Administrador</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Ingresa el PIN de Administrador para desbloquear reportes y auditoría (<b className="text-blue-600">2026</b>):
              </p>

              <form onSubmit={handleVerifyPin} className="space-y-3">
                <input 
                  type="password"
                  maxLength={6}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                  placeholder="••••"
                  className="w-full text-center text-2xl font-mono font-black tracking-widest p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
                />

                {pinError && (
                  <p className="text-[11px] text-red-500 font-bold">
                    PIN incorrecto. Acceso denegado (403).
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/30"
                  >
                    Verificar PIN
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Contenido según Tab y Control de Acceso 403 */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 overflow-y-auto no-scrollbar p-6 pb-28"
          >
              {activeTab === 'home' && <HomeView 
                sales={transactions.filter(t=>t.type==='venta').reduce((a,c)=>a+c.amount,0)} 
                expenses={transactions.filter(t=>t.type==='gasto').reduce((a,c)=>a+c.amount,0)} 
                onOpenCalc={(t) => { setCalcType(t); setIsCalcOpen(true); }} 
                setActiveTab={setActiveTab} 
                recentDebtors={debtors.filter(d => d.debt > 0)} 
                transactions={transactions} 
                userRole={userRole}
                onDeleteTransaction={async (id) => {
                  setTransactions(prev => {
                    const updated = prev.filter(t => t.id !== id);
                    if (isGuest) localStorage.setItem('tf_local_transactions', JSON.stringify(updated));
                    return updated;
                  });
                  if (!isGuest) await deleteDoc(doc(db, 'transactions', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, 'transactions'));
                }} 
                onEditTransaction={async (id, amt, desc) => {
                  setTransactions(prev => {
                    const updated = prev.map(t => t.id === id ? { ...t, amount: amt, description: desc } : t);
                    if (isGuest) localStorage.setItem('tf_local_transactions', JSON.stringify(updated));
                    return updated;
                  });
                  if (!isGuest) await updateDoc(doc(db, 'transactions', id), { amount: amt, description: desc }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'transactions'));
                }} 
              />}

              {activeTab === 'inventory' && <InventoryView 
                inventory={inventory} 
                setInventory={setInventory} 
                isGuest={isGuest} 
                transactions={transactions} 
                onConfirmTransaction={handleConfirmTransaction} 
                userRole={userRole}
              />}

              {activeTab === 'debtors' && <DebtorsView 
                debtors={debtors} 
                setDebtors={setDebtors} 
                isPro={isPro} 
                isGuest={isGuest} 
                onOpenPro={() => setShowSubModal(true)} 
              />}

              {/* Pantalla 403 para Reportes si el usuario es Dependiente */}
              {activeTab === 'reports' && (
                userRole === 'dependiente' ? (
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-amber-200 dark:border-amber-900/50 text-center animate-in zoom-in-95 flex flex-col items-center justify-center my-auto min-h-[360px]">
                    <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-amber-200 dark:border-amber-800">
                      <ShieldAlert size={40} />
                    </div>
                    <span className="text-[11px] font-mono font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 mb-3">
                      HTTP 403 Forbidden · Acceso Denegado
                    </span>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                      Módulo Reservado al Administrador
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 max-w-sm leading-relaxed mb-6 font-medium">
                      Solo el Administrador del establecimiento tiene autorización para consultar reportes financieros, márgenes de utilidad, balance de utilidades y auditoría contable.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                      <button
                        onClick={() => setActiveTab('home')}
                        className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 font-bold rounded-2xl text-xs transition-all active:scale-95"
                      >
                        Volver al Inicio
                      </button>
                      <button
                        onClick={() => { setShowPinModal(true); setPinInput(''); setPinError(false); }}
                        className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-blue-500/20 active:scale-95"
                      >
                        Desbloquear (PIN)
                      </button>
                    </div>
                  </div>
                ) : (
                  <ReportsView transactions={transactions} inventory={inventory} debtors={debtors} isPro={isPro} onOpenPro={() => setShowSubModal(true)} />
                )
              )}
          </motion.div>
        </AnimatePresence>

        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} />
        
        <CalculatorModal 
          isOpen={isCalcOpen} 
          type={calcType} 
          onClose={() => setIsCalcOpen(false)} 
          onConfirm={handleConfirmTransaction} 
          existingDebtors={debtors} 
          inventory={inventory} 
        />
        
        <SubscriptionModal 
          isOpen={showSubModal} 
          onClose={() => setShowSubModal(false)} 
          onUpgrade={() => setShowSubModal(false)} 
        />
      </div>
    </div>
  );
}

export default App;

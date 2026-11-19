import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Delete, ArrowRight, Check, Banknote, Calculator, User, CreditCard, Phone, Search, Grid, Minus, Plus, ShoppingBag, Trash2, ChevronUp, ChevronDown, PenTool, ClipboardList, ScanBarcode, QrCode, Box } from 'lucide-react';
import { TransactionType, Debtor, InventoryItem, Transaction } from '../types';
import { normalizeBarcode } from '../lib/firestoreUtils';
import BarcodeScanner from './BarcodeScanner';
import { generateInvoicePDF } from '../lib/pdfUtils';
import { FileText } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  icon?: string;
  unit: string;
  isBulk?: boolean;
  bulkUnit?: string;
  bulkUnits?: number;
  productId?: string;
}

interface CalculatorModalProps {
  isOpen: boolean;
  type: TransactionType;
  existingDebtors?: Debtor[];
  inventory?: InventoryItem[];
  onClose: () => void;
  onConfirm: (
    amount: number, 
    isCredit?: boolean, 
    clientName?: string, 
    clientPhone?: string, 
    cartItems?: CartItem[], 
    description?: string,
    type?: TransactionType,
    consentAccepted?: boolean
  ) => void;
}

const CalculatorModal: React.FC<CalculatorModalProps> = ({ 
  isOpen, 
  type, 
  existingDebtors = [], 
  inventory = [], 
  onClose, 
  onConfirm 
}) => {
  // Modes: 'pos' (Select Products), 'calculator' (Manual Entry), 'payment' (Finalize), 'success' (Done)
  const [mode, setMode] = useState<'pos' | 'calculator' | 'payment' | 'success'>('pos');
  const [completedTx, setCompletedTx] = useState<Partial<Transaction> | null>(null);
  
  // --- CALCULATOR STATE (Gastos / Manual) ---
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [lastWasResult, setLastWasResult] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState(''); // Concepto del Gasto
  
  // --- POS STATE (Ventas) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null); // ID del producto al que le estamos editando cantidad manual
  const [tempQty, setTempQty] = useState(''); // Estado temporal para el input de cantidad manual
  const [isCartExpanded, setIsCartExpanded] = useState(false); // Estado para expandir el carrito
  const [showScanner, setShowScanner] = useState<'qr' | 'barcode' | null>(null); // Scanner State
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedProductPending, setScannedProductPending] = useState<InventoryItem | null>(null); // State for quick bulk/unit choice
  
  // Manual Item Entry State
  const [showManualItemForm, setShowManualItemForm] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [manualItemQty, setManualItemQty] = useState('1');

  // --- PAYMENT STATE ---
  const [totalToPay, setTotalToPay] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [creditConsentAccepted, setCreditConsentAccepted] = useState(false);
  
  // Search Suggestions (Debtors)
  const [filteredDebtors, setFilteredDebtors] = useState<Debtor[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Determinar si es cliente nuevo para aplicar Ley 1581
  const isNewClient = useMemo(() => {
    if (paymentMethod !== 'credit' || !clientName.trim()) return false;
    return !existingDebtors.some(
      d => d.name.toLowerCase().trim() === clientName.toLowerCase().trim()
    );
  }, [paymentMethod, clientName, existingDebtors]);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      // Default to POS for Sales, Calculator for Expenses
      setMode(type === 'venta' ? 'pos' : 'calculator');
      setDisplay('0');
      setExpression('');
      setLastWasResult(false);
      setExpenseDescription('');
      
      setTotalToPay(0);
      setCashReceived('');
      setPaymentMethod('cash');
      setClientName('');
      setClientPhone('');
      setCreditConsentAccepted(false);
      setShowSuggestions(false);
      
      setCart([]);
      setSearchTerm('');
      setEditingQtyId(null);
      setIsCartExpanded(false);
      setShowScanner(null);
      
      setShowManualItemForm(false);
      setManualItemName('');
      setManualItemPrice('');
      setManualItemQty('1');
    }
  }, [isOpen, type]);

  // Inventory Ref for Scanner callback stability
  const inventoryRef = useRef(inventory);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  const handleScan = React.useCallback((decodedText: string) => {
    let cleanCode = decodedText.trim();
    setScanError(null);
    
    // Feedback de vibración si está disponible
    if ('vibrate' in navigator) {
        navigator.vibrate(100);
    }

    // 1. Try custom JSON format first
    try {
        if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
            const data = JSON.parse(cleanCode);
            if (data.id && data.type === 'product') {
                const product = inventoryRef.current.find(i => i.id === data.id);
                if (product) {
                    if (product.bulkUnit && product.bulkUnit.trim() !== '') {
                        setScannedProductPending(product);
                        setShowScanner(null);
                    } else {
                        addToCart(product);
                        setShowScanner(null);
                    }
                    return;
                }
            }
        }
    } catch (e) {
        // Not a valid JSON or other error, proceed to standard search
    }

    // 2. Try 'Name | Precio' format or variants (Legacy QR)
    if (cleanCode.toLowerCase().includes('precio:')) {
        const parts = cleanCode.split(/precio:/i);
        const namePart = parts[0].replace(/\|/g, '').toLowerCase().trim();
        const product = inventoryRef.current.find(i => i.name.toLowerCase().trim() === namePart);
        if (product) {
            if (product.bulkUnit && product.bulkUnit.trim() !== '') {
                setScannedProductPending(product);
                setShowScanner(null);
            } else {
                addToCart(product);
                setShowScanner(null);
            }
            return;
        }
    }

    // 3. Standard barcode/ID search
    const normalizedScannedCode = normalizeBarcode(cleanCode);
    
    let product = inventoryRef.current.find(i => {
        const itemBarcode = normalizeBarcode(i.barcode);
        return (itemBarcode === normalizedScannedCode && itemBarcode !== '') || (i.id === cleanCode);
    });

    // 4. Name fuzzy search as last resort
    if (!product) {
        product = inventoryRef.current.find(i => i.name.toLowerCase().trim() === cleanCode.toLowerCase().trim());
    }

    // 5. Substring search if no exact match
    if (!product && normalizedScannedCode.length > 4) {
        product = inventoryRef.current.find(i => {
            const itemBarcode = normalizeBarcode(i.barcode);
            return itemBarcode !== '' && (itemBarcode.includes(normalizedScannedCode) || normalizedScannedCode.includes(itemBarcode));
        });
    }

    if (product) {
        // Handle both undefined and null/empty string for bulkUnit
        if (product.bulkUnit && product.bulkUnit.trim() !== '') {
            setScannedProductPending(product);
            setShowScanner(null);
        } else {
            addToCart(product);
            setShowScanner(null);
        }
        return;
    }

    // Si llegamos aquí es que no se encontró nada
    const invCount = inventoryRef.current.length;
    const withBarcode = inventoryRef.current.filter(i => !!i.barcode).length;
    setScanError(`No encontrado: ${cleanCode} (Inv: ${invCount}, B: ${withBarcode})`);
    
    // Vibración larga para error si está disponible
    if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
    }

    // Limpiar error después de 3 segundos
    setTimeout(() => setScanError(null), 3000);
  }, []);

  if (!isOpen) return null;

  const formatMoney = (amount: number) => 
    '$ ' + amount.toLocaleString('es-CO');

  // --- POS LOGIC (PRODUCT SELECTION) ---
  
  const filteredProducts = inventory.filter(item => {
    const term = searchTerm.toLowerCase().trim();
    const normalizedTerm = normalizeBarcode(term);
    const itemBarcode = normalizeBarcode(item.barcode);
    
    return item.name.toLowerCase().includes(term) ||
           item.category.toLowerCase().includes(term) ||
           (normalizedTerm !== '' && itemBarcode.includes(normalizedTerm));
  });

  const topProducts = inventory.slice(0, 4);

  const addToCart = (item: InventoryItem, qty: number = 1, isBulk: boolean = false) => {
    setCart(prev => {
      const cartItemId = isBulk ? `${item.id}-bulk` : item.id;
      const existing = prev.find(i => i.id === cartItemId);
      
      const price = isBulk ? (item.bulkPrice || (item.price * (item.unitsPerPackage || 1))) : item.price;
      const name = isBulk ? `${item.name} (${item.bulkUnit || 'Caja'})` : item.name;

      if (existing) {
        // Just update quantity, ensuring we keep the bulk status
        return prev.map(i => i.id === cartItemId ? { ...i, quantity: parseFloat((i.quantity + qty).toFixed(2)) } : i);
      }
      return [...prev, { 
        id: cartItemId, 
        name: name, 
        price: price, 
        quantity: qty, 
        icon: item.icon, 
        unit: isBulk ? (item.bulkUnit || 'Caja') : item.unit,
        isBulk: isBulk,
        bulkUnit: item.bulkUnit,
        bulkUnits: item.unitsPerPackage,
        productId: item.id // Keep reference to original product
      }];
    });
  };

  const toggleItemBulk = (cartId: string) => {
      const item = cart.find(i => i.id === cartId);
      if (!item || !item.productId) return;

      const originalProduct = inventory.find(i => i.id === item.productId);
      if (!originalProduct || !originalProduct.bulkUnit) return;

      const newIsBulk = !item.isBulk;
      const newCartId = newIsBulk ? `${originalProduct.id}-bulk` : originalProduct.id;
      
      // Check if the other version already exists in cart
      const existingInCart = cart.find(i => i.id === newCartId);
      
      if (existingInCart) {
          // If already exists, just merge quantities
          setCart(prev => prev
              .filter(i => i.id !== cartId) // Remove current
              .map(i => i.id === newCartId ? { ...i, quantity: i.quantity + item.quantity } : i)
          );
      } else {
          // Convert current one
          const newPrice = newIsBulk ? (originalProduct.bulkPrice || (originalProduct.price * (originalProduct.unitsPerPackage || 1))) : originalProduct.price;
          const newUnit = newIsBulk ? originalProduct.bulkUnit : originalProduct.unit;
          const newName = newIsBulk ? `${originalProduct.name} (${originalProduct.bulkUnit})` : originalProduct.name;

          setCart(prev => prev.map(i => i.id === cartId ? {
              ...i,
              id: newCartId,
              name: newName,
              price: newPrice,
              unit: newUnit,
              isBulk: newIsBulk
          } : i));
      }
  };

  const addManualItemToCart = () => {
      const price = parseInt(manualItemPrice.replace(/\./g, ''));
      const qty = parseFloat(manualItemQty.replace(',', '.'));
      if (!manualItemName || !price || isNaN(qty) || qty <= 0) return;

      const newItem: CartItem = {
          id: String(Date.now()), // ID Temporal único (grande) para no colisionar con inventory.id (pequeños)
          name: manualItemName,
          price: price,
          quantity: qty,
          icon: '📝',
          unit: 'Und'
      };

      setCart(prev => [...prev, newItem]);
      setManualItemName('');
      setManualItemPrice('');
      setShowManualItemForm(false);
      setIsCartExpanded(true); // Abrir carrito para que vea que se guardó
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
    if (cart.length <= 1) setIsCartExpanded(false); // Colapsar si queda vacío
  };

  const adjustQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(0, i.quantity + delta);
        return { ...i, quantity: parseFloat(newQty.toFixed(2)) };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const startEditingQty = (item: CartItem) => {
      setEditingQtyId(item.id);
      setTempQty(item.quantity.toString());
  };

  const saveEditingQty = (id: string) => {
      // Reemplazar coma por punto para el parseo
      const val = parseFloat(tempQty.replace(',', '.'));
      if (!isNaN(val) && val > 0) {
          setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: val } : i));
      } else if (val === 0) {
          removeFromCart(id);
      }
      setEditingQtyId(null);
  };

  const getCartTotal = () => {
    return Math.round(cart.reduce((acc, item) => acc + (item.price * item.quantity), 0));
  };

  const handlePOSCheckout = () => {
    const total = getCartTotal();
    if (total > 0) {
      setTotalToPay(total);
      setCashReceived('0'); 
      setMode('payment');
    }
  };

  // --- CALCULATOR LOGIC ---

  const safeCalculate = (expr: string): number => {
    try {
      const result = new Function('return ' + expr.replace(/x/g, '*'))();
      return Math.round(result);
    } catch {
      return 0;
    }
  };

  const handleCalcPress = (val: string) => {
    if (val === 'C') {
      setDisplay('0');
      setExpression('');
      return;
    }
    if (val === 'DEL') {
      setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
      return;
    }
    if (['+', '-', 'x', '/'].includes(val)) {
      const currentVal = display;
      setExpression(prev => lastWasResult ? `${currentVal} ${val} ` : `${prev}${currentVal} ${val} `);
      setDisplay('0');
      setLastWasResult(false);
      return;
    }
    if (val === '=') {
      if (!expression && !display) return;
      const fullExpr = lastWasResult ? display : `${expression}${display}`;
      const result = safeCalculate(fullExpr);
      setDisplay(result.toString());
      setExpression('');
      setLastWasResult(true);
      return;
    }
    if (lastWasResult) {
      setDisplay(val);
      setLastWasResult(false);
    } else {
      setDisplay(prev => prev === '0' ? val : prev + val);
    }
  };

  const handleCalculatorProceed = () => {
    let finalAmount = parseInt(display);
    if (expression && !lastWasResult) {
        finalAmount = safeCalculate(`${expression}${display}`);
        setDisplay(finalAmount.toString());
    }
    if (finalAmount <= 0) return;

    if (type === 'gasto') {
      const txSummary = {
        id: String(Date.now()),
        amount: finalAmount,
        date: Date.now(),
        description: expenseDescription || 'Gasto General',
        items: [],
        type: 'gasto' as const
      };
      
      onConfirm(finalAmount, undefined, undefined, undefined, undefined, expenseDescription || 'Gasto General');
      setCompletedTx(txSummary);
      setMode('success');
    } else {
      // Para venta manual (calculadora)
      setTotalToPay(finalAmount);
      setCashReceived('0'); 
      setMode('payment');
      setCart([]); // Limpiamos el carrito porque es venta manual
    }
  };

  // --- PAYMENT LOGIC ---

  const handlePaymentInput = (val: string) => {
    if (paymentMethod === 'credit') return;
    if (val === 'DEL') {
        setCashReceived(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        return;
    }
    setCashReceived(prev => {
        if (prev === '0') return val;
        if (prev.length > 9) return prev; 
        return prev + val;
    });
  };

  const addBill = (amount: number) => {
    if (paymentMethod === 'credit') return;
    setCashReceived(prev => {
        const current = parseInt(prev) || 0;
        return (current + amount).toString();
    });
  };

  const handleConfirmAction = () => {
    const total = totalToPay;
    const isCredit = paymentMethod === 'credit';
    const cName = clientName;
    const cPhone = clientPhone;
    const items = [...cart];
    
    // Preparar el resumen para el PDF
    const txSummary = {
        id: String(Date.now()),
        amount: total,
        date: Date.now(),
        description: isCredit ? `Fiado: ${cName}` : 'Venta Efectivo',
        items: items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        type: 'venta' as const
    };

    onConfirm(total, isCredit, cName, cPhone, items, undefined, undefined, isNewClient ? true : undefined);

    if (type === 'venta') {
        setCompletedTx(txSummary);
        setMode('success');
    } else {
        onClose();
    }
  };

  // Debtor Search
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setClientName(val);
      if (val.length > 0) {
          const matches = existingDebtors.filter(d => d.name.toLowerCase().includes(val.toLowerCase()));
          setFilteredDebtors(matches);
          setShowSuggestions(true);
      } else {
          setShowSuggestions(false);
      }
  };

  const selectExistingDebtor = (debtor: Debtor) => {
      setClientName(debtor.name);
      setClientPhone(debtor.phone || '');
      setShowSuggestions(false);
  };

  const currentCash = parseInt(cashReceived) || 0;
  const change = currentCash - totalToPay;
  const isSufficient = currentCash >= totalToPay;

  const renderIcon = (iconString?: string) => {
    if (!iconString) return <span className="text-xl">📦</span>;
    if (iconString.startsWith('blob:') || iconString.startsWith('http')) {
      return <img src={iconString} alt="Icon" className="w-full h-full object-cover rounded-md" />;
    }
    return <span className="text-xl">{iconString}</span>;
  };

  return (
    <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-t-[30px] shadow-2xl animate-slide-in-up h-[94dvh] flex flex-col relative">
        
        {/* SCANNER OVERLAY */}
        {showScanner && (
            <BarcodeScanner 
              onScan={handleScan} 
              onClose={() => setShowScanner(null)} 
              title={showScanner === 'qr' ? "Venta Rápida QR" : "Venta Rápida Barras"}
              scannerId="pos-barcode-reader"
              mode={showScanner}
              errorMessage={scanError}
            />
        )}

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            {mode !== 'pos' && (type === 'venta' || mode === 'payment') && (
                <button 
                  onClick={() => setMode(type === 'venta' && mode === 'payment' ? 'pos' : 'pos')} 
                  className="p-1 -ml-2 mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <ArrowRight size={20} className="rotate-180"/>
                </button>
            )}
            <span className="text-sm text-gray-500 uppercase font-bold tracking-wide flex items-center gap-2">
              {mode === 'calculator' && <Calculator size={16}/>}
              {mode === 'pos' && <Grid size={16}/>}
              {mode === 'payment' && <Banknote size={16}/>}
              
              {mode === 'calculator' ? `Calculadora Manual` : 
               mode === 'pos' ? 'Seleccionar Productos' : 
               'Confirmar Pago'}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* --- VIEW 1: POS (PRODUCT SELECTION) --- */}
        {mode === 'pos' && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* 1. BARRA DE BÚSQUEDA (Full Width) */}
            <div className="px-4 py-2 mt-2 shrink-0">
               <div className="relative">
                  <input 
                     type="text"
                     placeholder="Buscar producto..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-white font-bold"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
               </div>
            </div>

            {/* 2. BOTONES DE ACCIÓN RÁPIDA (Grandes y Claros) */}
            <div className="px-4 py-2 grid grid-cols-3 gap-2 shrink-0">
               <button 
                  onClick={() => setShowScanner('barcode')}
                  className="bg-gray-800 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white py-3 px-1 rounded-xl font-bold transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1 text-[9px] uppercase"
               >
                  <ScanBarcode size={20} /> BARRAS
               </button>

               <button 
                  onClick={() => setShowScanner('qr')}
                  className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-1 rounded-xl font-bold transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1 text-[9px] uppercase"
               >
                  <QrCode size={20} /> QR
               </button>

               <button 
                  onClick={() => setShowManualItemForm(!showManualItemForm)}
                  className={`py-3 px-1 rounded-xl font-bold transition-all border-2 flex flex-col items-center justify-center gap-1 text-[9px] uppercase active:scale-95 ${
                      showManualItemForm 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/30 shadow-lg' 
                      : 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30 hover:bg-blue-50'
                  }`}
               >
                  <PenTool size={20} /> PESO
               </button>
            </div>

            {/* MANUAL ITEM FORM OVERLAY */}
            {showManualItemForm && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 relative z-20">
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-lg">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase">Agregar Compra Manual</span>
                            <button onClick={() => setShowManualItemForm(false)} className="text-blue-400 hover:text-blue-600"><X size={16}/></button>
                        </div>
                        <div className="flex flex-col gap-2 mb-3">
                            <input 
                                type="text" 
                                placeholder="Nombre (ej: Arroz suelto)" 
                                value={manualItemName}
                                onChange={(e) => setManualItemName(e.target.value)}
                                className="w-full bg-white dark:bg-gray-800 rounded-xl p-3 text-sm outline-none border border-blue-200 dark:border-blue-800 text-gray-900 dark:text-white font-bold placeholder:font-normal"
                                autoFocus
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        placeholder="Precio" 
                                        value={manualItemPrice}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/\D/g, '');
                                            setManualItemPrice(raw.replace(/\B(?=(\d{3})+(?!\d))/g, "."));
                                        }}
                                        className="w-full bg-white dark:bg-gray-800 rounded-xl p-3 pl-6 text-sm outline-none border border-blue-200 dark:border-blue-800 text-gray-900 dark:text-white text-right font-bold"
                                    />
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">CANT</span>
                                    <input 
                                        type="text" 
                                        inputMode="decimal"
                                        placeholder="1" 
                                        value={manualItemQty}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (/^[\d.,]*$/.test(val)) setManualItemQty(val);
                                        }}
                                        className="w-full bg-white dark:bg-gray-800 rounded-xl p-3 pl-10 text-sm outline-none border border-blue-200 dark:border-blue-800 text-gray-900 dark:text-white text-right font-bold"
                                        onKeyDown={(e) => e.key === 'Enter' && addManualItemToCart()}
                                    />
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={addManualItemToCart}
                            disabled={!manualItemName || !manualItemPrice}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 shadow-md active:scale-95 transition-transform"
                        >
                            + AGREGAR A LA VENTA
                        </button>
                    </div>
                </div>
            )}

            {/* Content: Products List - Flex-1 to take available space */}
            <div className="flex-1 overflow-y-auto p-4 pt-2">
              
              {/* Sección Más Vendidos (solo si no hay búsqueda activa) */}
              {!searchTerm && !showManualItemForm && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                    🔥 Más Vendidos
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {topProducts.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm flex items-center gap-3 text-left hover:scale-[1.02] active:scale-95 transition-all"
                      >
                         <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-600 flex items-center justify-center shrink-0">
                            {renderIcon(item.icon)}
                         </div>
                         <div className="min-w-0">
                            <p className="font-bold text-gray-800 dark:text-white text-sm truncate">{item.name}</p>
                            <p className="text-emerald-500 font-bold text-xs">{formatMoney(item.price)}</p>
                         </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Todos los Productos */}
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">
                 {searchTerm ? 'Resultados' : 'Todos los Productos'}
              </h4>
              <div className="space-y-2">
                 {filteredProducts.map(item => {
                   // Check quantity in cart
                   const inCart = cart.find(c => c.id === item.id);
                   const qty = inCart ? inCart.quantity : 0;
                   const isEditing = editingQtyId === item.id;

                   if (isEditing) {
                     return (
                        <div key={item.id} className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border-2 border-blue-400 dark:border-blue-500 shadow-md animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-blue-900 dark:text-blue-100 text-sm">{item.name}</span>
                                <button 
                                    onClick={() => saveEditingQty(item.id)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-full shadow-sm active:scale-90 transition-transform"
                                >
                                    <Check size={16} strokeWidth={3} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    type="text" 
                                    inputMode="decimal"
                                    value={tempQty}
                                    onFocus={(e) => e.target.select()} // Seleccionar todo al enfocar para reemplazar fácil
                                    onChange={(e) => {
                                        // Permitir números y un solo punto o coma
                                        const val = e.target.value;
                                        if (/^[\d.,]*$/.test(val)) setTempQty(val);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && saveEditingQty(item.id)}
                                    className="w-20 text-center font-bold text-xl bg-white dark:bg-gray-800 rounded-lg p-2 outline-none text-gray-900 dark:text-white border border-blue-200 dark:border-blue-700 shadow-inner"
                                />
                                <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar">
                                     <button 
                                        onClick={() => setTempQty('1.5')} 
                                        className="px-3 py-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold whitespace-nowrap active:bg-blue-100 dark:active:bg-blue-900/50"
                                     >
                                        1.5
                                     </button>
                                     <button 
                                        onClick={() => setTempQty('0.5')} 
                                        className="px-3 py-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold whitespace-nowrap active:bg-blue-100 dark:active:bg-blue-900/50"
                                     >
                                        ½ Media
                                     </button>
                                     <button 
                                        onClick={() => setTempQty('0.25')} 
                                        className="px-3 py-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold whitespace-nowrap active:bg-blue-100 dark:active:bg-blue-900/50"
                                     >
                                        ¼ Cuarto
                                     </button>
                                </div>
                            </div>
                        </div>
                     )
                   }

                   return (
                     <div key={item.id} className="flex items-center justify-between bg-white dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 overflow-hidden">
                           <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-600 flex items-center justify-center shrink-0">
                              {renderIcon(item.icon)}
                           </div>
                           <div className="min-w-0">
                              <p className="font-bold text-gray-800 dark:text-white text-sm truncate pr-2">{item.name}</p>
                              <div className="flex flex-col">
                                <p className="text-[10px] text-emerald-600 font-bold">{formatMoney(item.price)} / {item.unit} <span className="text-gray-400 font-normal">(Menudeo)</span></p>
                                {item.bulkUnit && item.bulkPrice && (
                                  <p className="text-[10px] text-orange-600 font-bold">{formatMoney(item.bulkPrice)} / {item.bulkUnit} <span className="text-gray-400 font-normal">(Mayorista)</span></p>
                                )}
                              </div>
                           </div>
                        </div>
                        
                        {qty === 0 ? (
                           <div className="flex gap-1">
                              {item.bulkUnit && item.bulkUnit.trim() !== '' && (
                                <button 
                                  onClick={() => addToCart(item, 1, true)}
                                  className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg border border-blue-200 dark:border-blue-800/30 hover:bg-blue-100 transition-colors flex items-center gap-1"
                                >
                                  <Box size={10} /> {item.bulkUnit.toUpperCase()}
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  // Al usar venta por peso, añadimos 1 y abrimos el editor decimal inmediatamente
                                  addToCart(item);
                                  startEditingQty({ 
                                    id: item.id, 
                                    name: item.name, 
                                    price: item.price, 
                                    quantity: 1, 
                                    unit: item.unit 
                                  });
                                }}
                                className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-lg border border-amber-200 dark:border-amber-800/30 hover:bg-amber-100 transition-colors"
                              >
                                ½ PESO
                              </button>
                              <button 
                                onClick={() => addToCart(item)}
                                className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all shadow-sm"
                              >
                                <Plus size={18} />
                              </button>
                           </div>
                        ) : (
                           <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full border border-blue-100 dark:border-blue-800/30">
                              {!inCart?.isBulk && item.bulkUnit && item.bulkUnit.trim() !== '' && (
                                  <button 
                                    onClick={() => addToCart(item, 1, true)}
                                    className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800 mr-1"
                                    title={`Añadir ${item.bulkUnit}`}
                                  >
                                    <Box size={10} />
                                  </button>
                              )}
                              <button 
                                onClick={() => adjustQuantity(item.id, -1)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-colors ${qty <= 1 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white dark:bg-gray-700 text-blue-600 hover:bg-gray-100'}`}
                              >
                                 {qty <= 1 ? <Trash2 size={12} /> : <Minus size={14} />}
                              </button>
                              
                              <button 
                                onClick={() => startEditingQty(inCart!)}
                                className="flex items-center gap-1 font-black text-blue-600 dark:text-blue-400 min-w-[2.8rem] justify-center text-sm px-2 py-1 rounded-lg bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-all border-2 border-blue-200 dark:border-blue-800 shadow-sm active:scale-95"
                                title="Toca para editar cantidad exacta"
                              >
                                {qty}
                                <PenTool size={10} strokeWidth={3} className="text-blue-400" />
                              </button>

                              <button 
                                onClick={() => adjustQuantity(item.id, 1)}
                                className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm active:scale-90"
                              >
                                 <Plus size={14} />
                              </button>
                           </div>
                        )}
                     </div>
                   );
                 })}
                 {filteredProducts.length === 0 && (
                   <div className="text-center py-8 text-gray-400">
                     <p>No se encontraron productos.</p>
                   </div>
                 )}
              </div>
            </div>

            {/* Bottom Bar: Cart & Checkout (Flex Shrink-0, naturally sits below list) */}
            <div className="shrink-0 z-30 flex flex-col justify-end shadow-[0_-4px_30px_rgba(0,0,0,0.1)] bg-white dark:bg-gray-800">
               
               {/* Cart Drawer */}
               {cart.length > 0 && (
                 <div className="bg-gray-50/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm flex flex-col animate-in slide-in-from-bottom-4 duration-300 transition-all">
                    
                    {/* Expand/Collapse Toggle */}
                    <button 
                        onClick={() => setIsCartExpanded(!isCartExpanded)}
                        className="w-full flex items-center justify-center py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                        {isCartExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        <span className="text-[10px] font-bold ml-1 uppercase tracking-wide">
                            {isCartExpanded ? 'Ocultar' : `Ver lista (${cart.length})`}
                        </span>
                    </button>

                    {isCartExpanded ? (
                         /* Expanded Vertical View */
                         <div className="max-h-[40vh] overflow-y-auto px-4 pb-4 pt-1 space-y-2">
                            {cart.map(item => (
                                <div key={item.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                     <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl shrink-0">
                                             {renderIcon(item.icon)}
                                         </div>
                                         <div>
                                             <p className="text-sm font-bold text-gray-800 dark:text-white line-clamp-1">{item.name}</p>
                                             <div className="flex items-center gap-1">
                                                {item.isBulk && (
                                                    <button 
                                                        onClick={() => toggleItemBulk(item.id)}
                                                        className="p-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                                                        title="Cambiar a Unidad"
                                                    >
                                                        <Box size={14} />
                                                    </button>
                                                )}
                                                {!item.isBulk && (inventory.find(inv => inv.id === item.productId)?.bulkUnit) && (
                                                    <button 
                                                        onClick={() => toggleItemBulk(item.id)}
                                                        className="p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-200 transition-colors"
                                                        title="Cambiar a Caja"
                                                    >
                                                        <Box size={14} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => startEditingQty(item)}
                                                    className={`flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-lg border hover:opacity-80 transition-colors ${item.isBulk ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'}`}
                                                >
                                                    {item.quantity} {item.unit} x {formatMoney(item.price)}
                                                    <PenTool size={10} strokeWidth={3} className="ml-0.5 opacity-70" />
                                                </button>
                                             </div>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-3">
                                         <span className="font-bold text-gray-800 dark:text-white text-sm">
                                             {formatMoney(item.quantity * item.price)}
                                         </span>
                                         <button 
                                            onClick={() => removeFromCart(item.id)} 
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                         >
                                            <Trash2 size={16} />
                                         </button>
                                     </div>
                                </div>
                            ))}
                         </div>
                    ) : (
                         /* Collapsed Horizontal View */
                         <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-4 pb-3">
                           {cart.map(item => (
                              <div key={item.id} className="shrink-0 flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-3 pr-1 py-2 rounded-xl shadow-sm min-w-[140px] justify-between group">
                                 <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[100px]">{item.name}</span>
                                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                       Cant: <span className="font-bold text-sm">{item.quantity}</span>
                                    </span>
                                 </div>
                                 <button 
                                   onClick={() => removeFromCart(item.id)} 
                                   className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                 >
                                   <X size={16} />
                                 </button>
                              </div>
                           ))}
                        </div>
                    )}
                 </div>
               )}

               {/* Action Buttons Area */}
               <div className="bg-white dark:bg-gray-800 p-4 pb-6 border-t border-gray-100 dark:border-gray-700">
                   <div className="flex gap-3">
                      <button 
                        onClick={() => setMode('calculator')}
                        className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 transition-colors"
                      >
                         <Calculator size={24} />
                      </button>
                      <button 
                        onClick={handlePOSCheckout}
                        disabled={cart.length === 0}
                        className={`flex-1 rounded-2xl font-bold text-lg text-white shadow-lg flex items-center justify-between px-6 transition-all active:scale-95 ${
                          cart.length > 0 
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' 
                          : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none'
                        }`}
                      >
                         <div className="flex flex-col items-start leading-none gap-1">
                           <span className="text-[10px] opacity-80 font-medium uppercase tracking-wider">Total a Cobrar</span>
                           <span className="text-xl">{formatMoney(getCartTotal())}</span>
                         </div>
                         <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
                           <ShoppingBag size={18} /> 
                           <span className="text-sm">{cart.reduce((a, b) => a + Math.ceil(b.quantity), 0)}</span>
                         </div>
                      </button>
                   </div>
               </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: CALCULATOR (MANUAL / EXPENSE) --- */}
        {mode === 'calculator' && (
            <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                {/* Expense Concept Input */}
                {type === 'gasto' && (
                     <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 ml-1 uppercase">Concepto / Motivo</label>
                        <div className="relative">
                            <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text"
                                value={expenseDescription}
                                onChange={(e) => setExpenseDescription(e.target.value)}
                                placeholder="Ej: Pago Luz, Transporte..."
                                className="w-full bg-white dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-red-400 text-gray-800 dark:text-white font-medium"
                                autoFocus
                            />
                        </div>
                     </div>
                )}

                <div className="flex-1 flex flex-col justify-end items-end mb-4 space-y-1 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border-2 border-transparent focus-within:border-blue-500 transition-colors min-h-[120px]">
                    <div className="text-gray-400 dark:text-gray-500 text-sm font-medium h-6 text-right w-full overflow-hidden text-ellipsis whitespace-nowrap">
                        {expression}
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-gray-800 dark:text-white tracking-tighter break-all text-right w-full">
                        {formatMoney(parseInt(display) || 0)}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:gap-3 shrink-0">
                    <button onClick={() => handleCalcPress('C')} className="h-14 sm:h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 font-bold text-xl hover:bg-red-100">C</button>
                    <button onClick={() => handleCalcPress('/')} className="h-14 sm:h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold text-xl hover:bg-blue-100">/</button>
                    <button onClick={() => handleCalcPress('x')} className="h-14 sm:h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold text-xl hover:bg-blue-100">x</button>
                    <button onClick={() => handleCalcPress('DEL')} className="h-14 sm:h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200"><Delete size={20} className="mx-auto"/></button>

                    <button onClick={() => handleCalcPress('7')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">7</button>
                    <button onClick={() => handleCalcPress('8')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">8</button>
                    <button onClick={() => handleCalcPress('9')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">9</button>
                    <button onClick={() => handleCalcPress('-')} className="h-14 sm:h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold text-xl hover:bg-blue-100">-</button>

                    <button onClick={() => handleCalcPress('4')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">4</button>
                    <button onClick={() => handleCalcPress('5')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">5</button>
                    <button onClick={() => handleCalcPress('6')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">6</button>
                    <button onClick={() => handleCalcPress('+')} className="h-14 sm:h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold text-xl hover:bg-blue-100">+</button>

                    <button onClick={() => handleCalcPress('1')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">1</button>
                    <button onClick={() => handleCalcPress('2')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">2</button>
                    <button onClick={() => handleCalcPress('3')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">3</button>
                    <button onClick={() => handleCalcPress('=')} className="h-14 sm:h-16 rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700">=</button>

                    <button onClick={() => handleCalcPress('0')} className="h-14 sm:h-16 col-span-2 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">0</button>
                    <button onClick={() => handleCalcPress('00')} className="h-14 sm:h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-2xl font-bold text-gray-700 dark:text-white hover:bg-gray-100">00</button>
                    
                    <button 
                        onClick={handleCalculatorProceed}
                        className={`h-14 sm:h-16 rounded-2xl font-bold text-lg text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
                            type === 'venta' 
                                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' 
                                : 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                        }`}
                    >
                        {type === 'venta' ? 'COBRAR' : 'GASTAR'}
                        {type === 'venta' && <ArrowRight size={20} />}
                    </button>
                </div>
            </div>
        )}

        {/* --- VIEW 3: PAYMENT (FINALIZE) --- */}
        {mode === 'payment' && (
            <div className="flex-1 flex flex-col p-4 animate-in slide-in-from-right duration-300 overflow-y-auto">
                
                {/* Selector de Método de Pago */}
                <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl mb-6 shrink-0">
                    <button 
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            paymentMethod === 'cash' 
                            ? 'bg-white dark:bg-gray-600 shadow-sm text-emerald-600 dark:text-emerald-400' 
                            : 'text-gray-400 dark:text-gray-400'
                        }`}
                    >
                        <Banknote size={16} /> Efectivo (Contado)
                    </button>
                    <button 
                        onClick={() => setPaymentMethod('credit')}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            paymentMethod === 'credit' 
                            ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' 
                            : 'text-gray-400 dark:text-gray-400'
                        }`}
                    >
                        <CreditCard size={16} /> Fiado (Crédito)
                    </button>
                </div>

                {/* Resumen Total */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl mb-4 border border-gray-100 dark:border-gray-700 shrink-0 text-center">
                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">Total a Pagar</p>
                    <p className="text-4xl font-black text-gray-800 dark:text-white">{formatMoney(totalToPay)}</p>
                </div>

                {/* --- CONTENIDO SEGÚN MÉTODO --- */}
                {paymentMethod === 'cash' ? (
                    <>
                        {/* Input Dinero Recibido */}
                        <div className="mb-4 relative shrink-0 animate-in fade-in">
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase ml-1">¿Cuánto paga el cliente?</label>
                            <div className={`relative flex items-center justify-between p-3 rounded-2xl border-2 transition-colors ${
                                isSufficient ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-red-300 bg-red-50/50 dark:bg-red-900/10'
                            }`}>
                                <div className="text-3xl font-black text-gray-800 dark:text-white">
                                    {formatMoney(currentCash)}
                                </div>
                                <div onClick={() => handlePaymentInput('DEL')} className="p-2 text-gray-400 cursor-pointer">
                                    <Delete size={24} />
                                </div>
                            </div>
                            {!isSufficient && currentCash > 0 && (
                                <p className="text-red-500 text-xs font-bold mt-1 ml-1">Faltan {formatMoney(totalToPay - currentCash)}</p>
                            )}
                        </div>

                        {/* Resultado Vueltas */}
                        <div className="mb-4 flex-1 flex flex-col justify-center min-h-[60px]">
                            {isSufficient ? (
                                <div className="text-center animate-in zoom-in duration-300">
                                    <span className="text-gray-500 text-sm font-bold uppercase block mb-1">Cambio (Vueltas) a dar</span>
                                    <span className="text-4xl sm:text-5xl font-black text-emerald-500">{formatMoney(change)}</span>
                                </div>
                            ) : (
                                <div className="text-center opacity-30">
                                    <span className="text-gray-400 text-sm font-bold uppercase block mb-1">Cambio</span>
                                    <span className="text-4xl font-black text-gray-400">$ 0</span>
                                </div>
                            )}
                        </div>

                        {/* Botones Billetes */}
                        <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
                            {[2000, 5000, 10000, 20000, 50000, 100000].map(bill => (
                                <button 
                                    key={bill}
                                    onClick={() => addBill(bill)}
                                    className="py-2 sm:py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95 transition-all shadow-sm"
                                >
                                    +{bill / 1000}k
                                </button>
                            ))}
                        </div>

                        {/* Teclado Numérico Simple */}
                        <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
                            {[1,2,3,4,5,6,7,8,9,0,'00'].map(num => (
                                <button 
                                    key={num}
                                    onClick={() => handlePaymentInput(num.toString())}
                                    className="py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-lg font-bold text-gray-700 dark:text-white hover:bg-gray-100"
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    /* --- MODO FIADO --- */
                    <div className="flex-1 flex flex-col animate-in fade-in space-y-4">
                        <div className="relative z-20">
                             <label className="block text-xs font-bold text-blue-500 mb-2 uppercase ml-1 flex items-center gap-1">
                                 <User size={14} /> Buscar o Crear Cliente
                             </label>
                             <div className="relative">
                                 <input 
                                    type="text"
                                    value={clientName}
                                    onChange={handleNameChange}
                                    placeholder="Ej: Vecino Luis"
                                    autoFocus
                                    className="w-full bg-white dark:bg-gray-700 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-4 pr-10 text-lg font-bold text-gray-800 dark:text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 placeholder:text-gray-300"
                                 />
                                 <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                             </div>
                             
                             {/* Suggestion Dropdown */}
                             {showSuggestions && filteredDebtors.length > 0 && (
                                 <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95">
                                     <div className="p-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Deudores Existentes</div>
                                     {filteredDebtors.map(debtor => (
                                         <button 
                                            key={debtor.id}
                                            onClick={() => selectExistingDebtor(debtor)}
                                            className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl flex items-center justify-between transition-colors group"
                                         >
                                             <div>
                                                 <p className="font-bold text-gray-800 dark:text-white">{debtor.name}</p>
                                                 <p className="text-xs text-gray-500">{debtor.phone || 'Sin teléfono'}</p>
                                             </div>
                                             <div className="bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs px-2 py-1 rounded-lg font-bold group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                                                 Seleccionar
                                             </div>
                                         </button>
                                     ))}
                                 </div>
                             )}
                        </div>

                        <div>
                             <label className="block text-xs font-bold text-blue-500 mb-2 uppercase ml-1 flex items-center gap-1">
                                 <Phone size={14} /> WhatsApp (Opcional)
                             </label>
                             <input 
                                type="tel"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value.replace(/\D/g, ''))}
                                placeholder="Ej: 3001234567"
                                className="w-full bg-white dark:bg-gray-700 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-lg font-bold text-gray-800 dark:text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 placeholder:text-gray-300"
                             />
                             <p className="text-xs text-gray-400 mt-2 ml-1">
                                 Útil para enviar recordatorios de cobro por WhatsApp.
                             </p>
                        </div>

                        {/* Checkbox Obligatorio Ley 1581 para clientes nuevos */}
                        {isNewClient && (
                          <div className="p-3.5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 animate-in fade-in">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                              <input 
                                type="checkbox" 
                                checked={creditConsentAccepted} 
                                onChange={(e) => setCreditConsentAccepted(e.target.checked)}
                                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                              />
                              <div className="text-[11px] leading-tight text-gray-800 dark:text-gray-200">
                                <span className="font-bold">El cliente autoriza el tratamiento de sus datos personales (Ley 1581 de 2012).</span>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                  Autorización legal requerida para registrar este nuevo cliente en el control de créditos de SIGA Zambrano.
                                </p>
                              </div>
                            </label>
                          </div>
                        )}
                        
                        <div className="flex-1"></div>
                    </div>
                )}

                {/* Confirmar Botón */}
                <button 
                    disabled={paymentMethod === 'cash' ? !isSufficient : (!clientName.trim() || (isNewClient && !creditConsentAccepted))}
                    onClick={handleConfirmAction}
                    className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95 ${
                        (paymentMethod === 'cash' ? isSufficient : (clientName.trim() && (!isNewClient || creditConsentAccepted)))
                            ? (paymentMethod === 'cash' 
                                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' 
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30')
                            : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none'
                    }`}
                >
                    <Check size={24} />
                    {paymentMethod === 'cash' ? 'CONFIRMAR VENTA' : 'GUARDAR FIADO'}
                </button>
            </div>
        )}

        {/* --- VIEW 4: SUCCESS (DONE) --- */}
        {mode === 'success' && completedTx && (
            <div className="flex-1 flex flex-col p-6 items-center justify-center text-center animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
                    <Check size={48} strokeWidth={3} />
                </div>
                <h3 className="text-3xl font-black text-gray-800 dark:text-white mb-2 italic">
                    {completedTx.type === 'gasto' ? '¡Gasto Registrado!' : '¡Venta Exitosa!'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">El registro ha sido guardado correctamente.</p>
                
                <div className="w-full bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 mb-8 flex items-center justify-between">
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">
                            {completedTx.type === 'gasto' ? 'Monto Gastado' : 'Total Cobrado'}
                        </p>
                        <p className="text-2xl font-black text-emerald-500">{formatMoney(completedTx.amount)}</p>
                    </div>
                    {paymentMethod === 'cash' && change > 0 && (
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Cambio dado</p>
                            <p className="text-xl font-bold text-gray-700 dark:text-white">{formatMoney(change)}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3 w-full">
                    {completedTx.type !== 'gasto' && (
                        <button 
                            onClick={() => generateInvoicePDF(completedTx as Transaction)}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-lg"
                        >
                            <FileText size={24} /> DESCARGAR FACTURA PDF
                        </button>
                    )}
                    
                    <button 
                        onClick={onClose}
                        className="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 active:scale-95 transition-all"
                    >
                        LISTO, VOLVER
                    </button>
                </div>
            </div>
        )}
        {/* Quick Selection Modal for Scanned Items with Bulk */}
        {scannedProductPending && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="p-6 text-center">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">{scannedProductPending.icon}</span>
                        </div>
                        <h3 className="text-xl font-black text-gray-800 dark:text-white mb-1">{scannedProductPending.name}</h3>
                        <p className="text-sm text-gray-500 mb-6 uppercase tracking-widest font-bold">¿Cómo quieres venderlo?</p>
                        
                        <div className="grid grid-cols-1 gap-3">
                            <button 
                                onClick={() => {
                                    addToCart(scannedProductPending, 1, false);
                                    setScannedProductPending(null);
                                }}
                                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
                            >
                                <ShoppingBag size={24} /> VENDER 1 UNIDAD
                            </button>
                            
                            <button 
                                onClick={() => {
                                    addToCart(scannedProductPending, 1, true);
                                    setScannedProductPending(null);
                                }}
                                className="w-full py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all border-b-4 border-orange-700"
                            >
                                <Box size={24} /> VENDER 1 {scannedProductPending.bulkUnit?.toUpperCase()}
                            </button>
                            
                            <button 
                                onClick={() => setScannedProductPending(null)}
                                className="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-bold mt-2"
                            >
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CalculatorModal;
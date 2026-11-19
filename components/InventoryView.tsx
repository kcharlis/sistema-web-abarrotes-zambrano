import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, X, Search, Calculator, AlertTriangle, ShoppingCart, ArrowRight, Loader2, Wallet, Box, QrCode, FileDown, ShieldAlert, Trash2, ScanBarcode, Calendar, Clock, Lock, CheckCircle2 } from 'lucide-react';
import { InventoryItem, Transaction, OperationType, TransactionType, UserRole } from '../types';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, getFriendlyErrorMessage, normalizeBarcode } from '../lib/firestoreUtils';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import BarcodeScanner from './BarcodeScanner';

interface InventoryViewProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  isGuest?: boolean;
  transactions: Transaction[];
  onConfirmTransaction: (amount: number, isCredit?: boolean, clientName?: string, clientPhone?: string, cartItems?: { id: string; name: string; quantity: number; price: number }[], description?: string, type?: TransactionType) => Promise<void>;
  userRole?: UserRole;
}

const RETAIL_UNITS = ['Und', 'Libra', 'Litro', 'Kg', 'Gramo', 'Onza', 'Pqt'];
const BULK_UNITS = ['Bulto', 'Paca', 'Caja', 'Saco', 'Display', 'Atado', 'Garrafa'];
const INVENTORY_CATEGORIES = [
  'Abarrotes',
  'Lácteos y Refrigerados',
  'Bebidas',
  'Panadería',
  'Aseo Hogar',
  'Cuidado Personal',
  'Snacks y Dulces',
  'General'
] as const;

const FILTER_CATEGORIES = ['Todas', ...INVENTORY_CATEGORIES];

export const getExpirationStatus = (expDate?: string) => {
  if (!expDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = expDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  const target = new Date(year, month - 1, day);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      status: 'expired',
      label: `Vencido (${Math.abs(diffDays)}d)`,
      badgeClass: 'bg-red-600 text-white font-black',
      days: diffDays
    };
  }
  if (diffDays <= 7) {
    return {
      status: 'critical',
      label: `Vence en ${diffDays}d`,
      badgeClass: 'bg-red-500 text-white font-black animate-pulse',
      days: diffDays
    };
  }
  if (diffDays <= 30) {
    return {
      status: 'warning',
      label: `Vence en ${diffDays}d`,
      badgeClass: 'bg-amber-400 text-amber-950 font-black',
      days: diffDays
    };
  }
  return {
    status: 'ok',
    label: `Vence: ${expDate}`,
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold',
    days: diffDays
  };
};

const InventoryView: React.FC<InventoryViewProps> = ({ 
  inventory, 
  setInventory, 
  isGuest = false, 
  onConfirmTransaction,
  userRole = 'admin'
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [isBulkMode, setIsBulkMode] = useState(true);
  const [profitPercent, setProfitPercent] = useState('30'); 
  const [bulkProfitPercent, setBulkProfitPercent] = useState('15');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGlobalScanner, setShowGlobalScanner] = useState<'qr' | 'barcode' | null>(null);
  const [showFormScanner, setShowFormScanner] = useState<'qr' | 'barcode' | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [detectedNotice, setDetectedNotice] = useState<string | null>(null);
  
  useEffect(() => {
    if (!detectedNotice) return;
    const timer = setTimeout(() => setDetectedNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [detectedNotice]);
  
  const [formData, setFormData] = useState({ 
    name: '', unit: 'Und', cost: '0', price: '0', stock: '0', 
    minStock: '5', abonoFactura: '0', abonoDeudaVieja: '0', icon: '📦', 
    category: 'General', unitsPerPackage: '1', bulkUnit: 'Bulto',
    barcode: '', bulkPrice: '0', bulkProfitPercent: '15',
    expirationDate: ''
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<InventoryItem[]>([]);

  const formatNumber = (val: string | number) => {
    if (val === '' || val === undefined || val === null) return '';
    const numStr = val.toString().replace(/\./g, '');
    const num = parseInt(numStr) || 0;
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumber = (val: string) => Math.round(parseFloat(val.toString().replace(/\./g, '')) || 0);
  const formatMoney = (amount: number) => '$ ' + Math.round(amount).toLocaleString('es-CO');

  const metrics = useMemo(() => {
    const rawCostInput = parseNumber(formData.cost); 
    const unitsInPack = Math.max(1, parseInt(formData.unitsPerPackage) || 1);
    const qtyNew = parseNumber(formData.stock);
    const abonoFact = parseNumber(formData.abonoFactura);
    const abonoDeuda = parseNumber(formData.abonoDeudaVieja);
    
    const unitCost = isBulkMode ? (rawCostInput / unitsInPack) : rawCostInput;
    const invoiceTotal = rawCostInput * qtyNew;
    const unitsEntering = isBulkMode ? (qtyNew * unitsInPack) : qtyNew;
    const currentPrice = parseNumber(formData.price);
    const currentBulkPrice = parseNumber(formData.bulkPrice);
    
    const existing = inventory.find(i => i.id === editingId || i.name.toLowerCase().trim() === formData.name.toLowerCase().trim());
    const previousDebt = existing?.supplierDebt || 0;
    const debtFromInvoice = Math.max(0, invoiceTotal - abonoFact);
    const finalDebt = Math.max(0, (previousDebt + debtFromInvoice) - abonoDeuda);

    const previousStock = existing?.stock || 0;
    const totalStock = previousStock + unitsEntering;
    const totalInversionInventario = totalStock * unitCost;
    const totalGananciaProyectada = totalStock * (currentPrice - unitCost);

    return { 
      unitCost, 
      rawCost: rawCostInput,
      unitsInPack,
      unitProfit: currentPrice - unitCost,
      bulkProfit: currentBulkPrice - rawCostInput,
      invoiceTotal,
      unitsEntering,
      previousStock, totalStock, previousDebt,
      finalDebt, debtFromInvoice,
      totalInversionInventario, totalGananciaProyectada,
      finalStockSum: totalStock
    };
  }, [formData, isBulkMode, editingId, inventory]);

  const alertStats = useMemo(() => {
    let lowStockCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    inventory.forEach(item => {
      if (item.stock <= (item.minStock || 0)) {
        lowStockCount++;
      }
      if (item.expirationDate) {
        const exp = getExpirationStatus(item.expirationDate);
        if (exp?.status === 'expired') expiredCount++;
        else if (exp?.status === 'critical' || exp?.status === 'warning') expiringSoonCount++;
      }
    });

    return { 
      lowStockCount, 
      expiringSoonCount, 
      expiredCount, 
      totalAlerts: lowStockCount + expiringSoonCount + expiredCount 
    };
  }, [inventory]);

  const formatPercent = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  };

  const computeSalePrice = (baseCost: number, margin: number) =>
    baseCost > 0 ? Math.ceil(baseCost * (1 + margin / 100)) : 0;

  const recalculatePrices = (rawCost: number, units: number, bulk: boolean, unitMargin: number, bulkMargin: number) => {
    const safeUnits = Math.max(1, units || 1);
    const unitCost = bulk ? rawCost / safeUnits : rawCost;
    const packageCost = bulk ? rawCost : rawCost * safeUnits;
    return {
      price: formatNumber(computeSalePrice(unitCost, unitMargin)),
      bulkPrice: formatNumber(computeSalePrice(packageCost, bulkMargin)),
    };
  };

  const handleCostChange = (val: string) => {
    if (userRole === 'dependiente') {
      alert('Acceso Denegado (Error 403): Solo el Administrador puede modificar los costos de compra.');
      return;
    }
    const newCost = parseNumber(val);
    setFormData(prev => {
      const units = Math.max(1, parseInt(prev.unitsPerPackage) || 1);
      const prices = recalculatePrices(
        newCost,
        units,
        isBulkMode,
        parseFloat(profitPercent) || 0,
        parseFloat(bulkProfitPercent) || 0
      );
      return { ...prev, cost: formatNumber(newCost), ...prices };
    });
  };

  const handleUnitsPerPackageChange = (val: string) => {
    setFormData(prev => {
      const units = Math.max(1, parseInt(val) || 1);
      const rawCost = parseNumber(prev.cost);
      const unitCost = isBulkMode ? rawCost / units : rawCost;
      return {
        ...prev,
        unitsPerPackage: val,
        price: formatNumber(computeSalePrice(unitCost, parseFloat(profitPercent) || 0)),
      };
    });
  };

  const handleModeSwitch = (nextBulk: boolean) => {
    if (nextBulk === isBulkMode) return;
    const units = Math.max(1, parseInt(formData.unitsPerPackage) || 1);
    const currentCost = parseNumber(formData.cost);
    const nextCost = nextBulk ? currentCost * units : currentCost / units;
    const prices = recalculatePrices(
      nextCost,
      units,
      nextBulk,
      parseFloat(profitPercent) || 0,
      parseFloat(bulkProfitPercent) || 0
    );
    setFormData(prev => ({ ...prev, cost: formatNumber(Math.round(nextCost)), ...prices }));
    setIsBulkMode(nextBulk);
  };

  const handlePriceChange = (val: string) => {
    const newPrice = parseNumber(val);
    setFormData(prev => ({ ...prev, price: formatNumber(newPrice) }));
    if (metrics.unitCost > 0) {
      const calculatedProfit = ((newPrice - metrics.unitCost) / metrics.unitCost) * 100;
      setProfitPercent(formatPercent(calculatedProfit));
    }
  };

  const handleBulkPriceChange = (val: string) => {
    const newPrice = parseNumber(val);
    setFormData(prev => ({ ...prev, bulkPrice: formatNumber(newPrice) }));
    const packageCost = parseNumber(formData.cost);
    if (packageCost > 0) {
        const calculatedProfit = ((newPrice - packageCost) / packageCost) * 100;
        setBulkProfitPercent(formatPercent(calculatedProfit));
    }
  };

  const handleProfitChange = (val: string) => {
    if (userRole === 'dependiente') {
      alert('Acceso Denegado (Error 403): Modificación de margen de ganancia restringida al Administrador.');
      return;
    }
    setProfitPercent(val);
    const p = parseFloat(val);
    if (!isNaN(p)) {
      setFormData(prev => {
        const units = Math.max(1, parseInt(prev.unitsPerPackage) || 1);
        const rawCost = parseNumber(prev.cost);
        const unitCost = isBulkMode ? rawCost / units : rawCost;
        return { ...prev, price: formatNumber(computeSalePrice(unitCost, p)) };
      });
    }
  };

  const handleBulkProfitChange = (val: string) => {
    if (userRole === 'dependiente') {
      alert('Acceso Denegado (Error 403): Modificación de margen mayorista restringida al Administrador.');
      return;
    }
    setBulkProfitPercent(val);
    const bp = parseFloat(val);
    if (!isNaN(bp)) {
      setFormData(prev => {
        const units = Math.max(1, parseInt(prev.unitsPerPackage) || 1);
        const rawCost = parseNumber(prev.cost);
        const packageCost = isBulkMode ? rawCost : rawCost * units;
        return { ...prev, bulkPrice: formatNumber(computeSalePrice(packageCost, bp)) };
      });
    }
  };

  const adjustProfit = (delta: number) => {
    if (userRole === 'dependiente') {
      alert('Acceso Denegado (Error 403): Solo el Administrador puede ajustar los márgenes.');
      return;
    }
    const current = parseFloat(profitPercent) || 0;
    handleProfitChange(formatPercent(current + delta));
  };

  const adjustBulkProfit = (delta: number) => {
    if (userRole === 'dependiente') {
      alert('Acceso Denegado (Error 403): Solo el Administrador puede ajustar los márgenes.');
      return;
    }
    const current = parseFloat(bulkProfitPercent) || 0;
    handleBulkProfitChange(formatPercent(current + delta));
  };

  const getSafeScannedBarcode = (value: string) => {
    const trimmed = (value || '').trim();
    if (!trimmed || (trimmed.startsWith('{') && trimmed.endsWith('}'))) return '';
    return normalizeBarcode(trimmed);
  };

  const findProductByCode = (rawCode: string): InventoryItem | undefined => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return undefined;

    // QR JSON generado por SIGA Zambrano: { id, type: 'product' }
    if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
      try {
        const data = JSON.parse(cleanCode) as { id?: string; type?: string };
        if (data.type === 'product' && data.id) {
          const byId = inventory.find(i => i.id === data.id);
          if (byId) return byId;
        }
      } catch {
        // No es un QR JSON válido; se intenta como código de barras normal.
      }
    }

    const normalizedCode = normalizeBarcode(cleanCode);
    if (!normalizedCode) return undefined;

    return inventory.find(i => {
      const storedCode = normalizeBarcode(i.barcode);
      return storedCode !== '' && storedCode === normalizedCode;
    });
  };

  const selectProduct = (item: InventoryItem, scannedBarcode?: string) => {
    setDetectedNotice(null);
    setEditingId(item.id);
    const costValue = item.cost * (item.unitsPerPackage || 1);
    const priceValue = item.price;
    const savedProfit = (item.profitPercent !== undefined && item.profitPercent !== null) ? item.profitPercent : (item.cost > 0 ? ((priceValue - item.cost) / item.cost) * 100 : 30);
    const savedBulkProfit = (item.bulkProfitPercent !== undefined && item.bulkProfitPercent !== null) ? item.bulkProfitPercent : (item.bulkPrice && costValue > 0 ? ((item.bulkPrice - costValue) / costValue) * 100 : 15);
    
    let displayBulkPrice = item.bulkPrice || 0;
    if (!displayBulkPrice && item.bulkUnit && costValue > 0) {
      displayBulkPrice = Math.ceil((costValue * (1 + savedBulkProfit / 100)) / 50) * 50;
    }

    setFormData({
      name: item.name,
      unit: item.unit,
      cost: formatNumber(costValue),
      price: formatNumber(priceValue),
      stock: '0',
      minStock: item.minStock.toString(),
      abonoFactura: '0',
      abonoDeudaVieja: '0',
      icon: item.icon || '📦',
      category: item.category || 'General',
      unitsPerPackage: (item.unitsPerPackage || 1).toString(),
      bulkUnit: item.bulkUnit || 'Bulto',
      barcode: item.barcode || (scannedBarcode ? normalizeBarcode(scannedBarcode) : ''),
      bulkPrice: formatNumber(displayBulkPrice),
      bulkProfitPercent: formatPercent(savedBulkProfit),
      expirationDate: item.expirationDate || ''
    });
    setProfitPercent(formatPercent(savedProfit));
    setBulkProfitPercent(formatPercent(savedBulkProfit));
    setIsBulkMode(!!item.bulkUnit);
    setShowSuggestions(false);
  };

  const loadExistingProduct = (item: InventoryItem, scannedBarcode?: string) => {
    // No cambiar automáticamente si el tendero ya estaba editando otro producto.
    if (editingId && editingId !== item.id) return false;
    selectProduct(item, scannedBarcode);
    setDetectedNotice('Producto existente detectado en inventario: cargando datos...');
    return true;
  };

  const handleBarcodeChange = (val: string) => {
    setFormData(prev => ({ ...prev, barcode: val }));
    const matchedItem = findProductByCode(val);
    if (matchedItem) {
      loadExistingProduct(matchedItem, getSafeScannedBarcode(val));
    }
  };

  const handleNameChange = (val: string) => {
    setFormData(prev => ({ ...prev, name: val }));
    const normalizedInput = val.toLowerCase().trim();
    if (val.length > 1) {
      const matches = inventory.filter(i => i.name.toLowerCase().includes(val.toLowerCase()));
      setFilteredSuggestions(matches);
      setShowSuggestions(matches.length > 0);

      const exactMatch = inventory.find(i => i.name.toLowerCase().trim() === normalizedInput);
      if (exactMatch) {
        loadExistingProduct(exactMatch, getSafeScannedBarcode(formData.barcode));
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const downloadQRPDF = async (itemsToProcess: InventoryItem[], filename: string) => {
    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const cols = 3;
      const cellWidth = (pageWidth - (margin * 2)) / cols;
      const cellHeight = 70;
      
      let x = margin;
      let y = margin;
      let count = 0;

      for (const item of itemsToProcess) {
        if (count > 0 && count % (cols * 4) === 0) {
          doc.addPage();
          x = margin;
          y = margin;
        }

        const qrData = JSON.stringify({ id: item.id, type: 'product' });
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          margin: 1,
          width: 200
        });

        doc.setDrawColor(220, 220, 220);
        doc.rect(x, y, cellWidth - 2, cellHeight - 5);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        const splitName = doc.splitTextToSize(item.name.toUpperCase(), cellWidth - 10);
        doc.text(splitName, x + (cellWidth / 2), y + 10, { align: 'center' });

        doc.setFontSize(16);
        doc.setTextColor(16, 185, 129); 
        doc.text(formatMoney(item.price), x + (cellWidth / 2), y + 22, { align: 'center' });

        doc.addImage(qrDataUrl, 'PNG', x + (cellWidth / 2) - 15, y + 26, 30, 30);

        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        // Actualizado según requerimiento oficial SIGA Zambrano
        doc.text(`SIGA Zambrano - ${item.unit}`, x + (cellWidth / 2), y + 60, { align: 'center' });

        x += cellWidth;
        if ((count + 1) % cols === 0) {
          x = margin;
          y += cellHeight;
        }
        count++;
      }

      doc.save(`${filename}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const downloadInventoryPDF = async (itemsToProcess: InventoryItem[], filename: string) => {
    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('REPORTE DE INVENTARIO · SIGA ZAMBRANO', pageWidth / 2, 22, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Generado: ${new Date().toLocaleString('es-CO')} · Categoría: ${selectedCategory}`, pageWidth / 2, 29, { align: 'center' });
      
      // Table Header
      let y = 40;
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y - 5, pageWidth - (margin * 2), 8, 'F');
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('PRODUCTO', margin + 2, y);
      doc.text('CAT.', margin + 55, y);
      doc.text('STOCK', margin + 85, y);
      doc.text('COSTO', margin + 105, y);
      doc.text('PRECIO UN.', margin + 130, y);
      doc.text('VENCE', margin + 158, y);
      
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      
      let totalStock = 0;
      let totalCostVal = 0;
      let totalPriceVal = 0;

      itemsToProcess.forEach((item, index) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        if (index % 2 === 0) {
          doc.setFillColor(252, 253, 254);
          doc.rect(margin, y - 5, pageWidth - (margin * 2), 7, 'F');
        }
        
        doc.setTextColor(0, 0, 0);
        const name = item.name.length > 28 ? item.name.substring(0, 26) + '...' : item.name;
        doc.text(name.toUpperCase(), margin + 2, y);
        doc.text((item.category || 'General').substring(0, 12), margin + 55, y);
        
        if (item.stock <= item.minStock) {
          doc.setTextColor(220, 38, 38);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        doc.text(item.stock.toString(), margin + 85, y);
        
        doc.setTextColor(0, 0, 0);
        doc.text(formatMoney(item.cost), margin + 105, y);
        doc.text(formatMoney(item.price), margin + 130, y);
        doc.text(item.expirationDate || '-', margin + 158, y);
        
        totalStock += item.stock;
        totalCostVal += (item.cost * item.stock);
        totalPriceVal += (item.price * item.stock);
        y += 7;
      });
      
      y += 8;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y - 5, pageWidth - margin, y - 5);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMEN DE INVENTARIO (VALORIZACIÓN)', margin, y + 4);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Productos: ${itemsToProcess.length} | Unidades en Bodega: ${totalStock}`, margin, y + 12);
      doc.text(`Inversión Total en Costos: ${formatMoney(totalCostVal)}`, margin, y + 19);
      doc.text(`Valor Venta Proyectada: ${formatMoney(totalPriceVal)}`, margin, y + 26);
      
      const profit = totalPriceVal - totalCostVal;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(`Utilidad Bruta Proyectada: ${formatMoney(profit)}`, margin, y + 33);

      doc.save(`${filename}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!formData.name) throw new Error("Nombre requerido");
      const existing = inventory.find(i => i.id === editingId || i.name.toLowerCase().trim() === formData.name.toLowerCase().trim());

      const newItemId = existing ? existing.id : crypto.randomUUID();
      const bPrice = parseNumber(formData.bulkPrice);
      const bProfit = parseFloat(bulkProfitPercent);
      const hasBulkInfo = isBulkMode && (bPrice > 0 || formData.bulkUnit);

      const newItemData: InventoryItem = {
        id: newItemId,
        name: formData.name.trim(),
        unit: formData.unit,
        cost: Math.round(metrics.unitCost), 
        price: Math.round(parseNumber(formData.price)),
        stock: metrics.totalStock,
        initialStock: metrics.totalStock, 
        minStock: parseNumber(formData.minStock),
        category: formData.category || 'General',
        icon: formData.icon,
        supplierDebt: Math.round(metrics.finalDebt),
        isPaid: metrics.finalDebt <= 0,
        unitsPerPackage: parseInt(formData.unitsPerPackage) || 1,
        bulkUnit: hasBulkInfo ? formData.bulkUnit : null,
        bulkPrice: hasBulkInfo ? bPrice : null,
        profitPercent: parseFloat(profitPercent) || 0,
        bulkProfitPercent: hasBulkInfo ? bProfit : null,
        barcode: normalizeBarcode(formData.barcode) || undefined,
        expirationDate: formData.expirationDate || undefined
      };

      if (!isGuest && auth.currentUser) {
        const dbPayload = {
            id: newItemData.id,
            name: newItemData.name,
            unit: newItemData.unit,
            cost: newItemData.cost,
            price: newItemData.price,
            stock: newItemData.stock,
            initialStock: newItemData.initialStock,
            minStock: newItemData.minStock,
            category: newItemData.category,
            icon: newItemData.icon,
            supplierDebt: newItemData.supplierDebt,
            isPaid: newItemData.isPaid,
            unitsPerPackage: newItemData.unitsPerPackage,
            bulkUnit: newItemData.bulkUnit,
            bulkPrice: newItemData.bulkPrice,
            profitPercent: newItemData.profitPercent,
            bulkProfitPercent: newItemData.bulkProfitPercent,
            barcode: newItemData.barcode || null,
            expirationDate: newItemData.expirationDate || null,
            user_id: auth.currentUser.uid
        };
        const itemRef = doc(db, 'inventory', newItemId);
        await setDoc(itemRef, dbPayload, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'inventory'));

        const totalPayment = parseNumber(formData.abonoFactura) + parseNumber(formData.abonoDeudaVieja);
        if (totalPayment > 0) {
          const desc = `Compra: ${newItemData.name} (${newItemData.stock - metrics.previousStock} ${newItemData.unit})`;
          await onConfirmTransaction(totalPayment, false, undefined, undefined, [], desc, 'gasto');
        }
      }

      setInventory(prev => {
          const index = prev.findIndex(p => p.id === newItemData.id);
          if (index !== -1) {
              const updated = [...prev];
              updated[index] = newItemData;
              return updated;
          }
          return [newItemData, ...prev];
      });
      setShowModal(false);
    } catch (e: unknown) { alert(getFriendlyErrorMessage(e)); } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (userRole === 'dependiente') {
      alert('Acceso Denegado (Error 403): Solo el Administrador puede eliminar productos del catálogo.');
      setShowDeleteConfirm(false);
      return;
    }
    if (!editingId) return;
    setIsSaving(true);
    try {
      if (!isGuest && auth.currentUser) {
        const itemRef = doc(db, 'inventory', editingId);
        await deleteDoc(itemRef).catch(e => handleFirestoreError(e, OperationType.DELETE, 'inventory'));
      }
      setInventory(prev => prev.filter(i => i.id !== editingId));
      setShowModal(false);
      setShowDeleteConfirm(false);
    } catch (e: unknown) { alert(getFriendlyErrorMessage(e)); } finally { setIsSaving(false); }
  };

  const filteredInventory = inventory.filter(i => {
    const term = searchTerm.toLowerCase().trim();
    const normalizedTerm = normalizeBarcode(term);
    const itemBarcode = normalizeBarcode(i.barcode);
    
    const matchesSearch = i.name.toLowerCase().includes(term) || 
           (normalizedTerm !== '' && itemBarcode.includes(normalizedTerm));

    const matchesCategory = selectedCategory === 'Todas' || (i.category || 'General') === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleGlobalScan = React.useCallback((code: string) => {
    const cleanCode = code.trim();
    if ('vibrate' in navigator) navigator.vibrate(100);
    
    let matchedItem: InventoryItem | undefined;
    try {
        if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
            const data = JSON.parse(cleanCode);
            if (data.id && data.type === 'product') {
                matchedItem = inventory.find(i => i.id === data.id);
            }
        }
    } catch (e) {}

    if (!matchedItem && cleanCode.toLowerCase().includes('precio:')) {
        const parts = cleanCode.split(/precio:/i);
        const namePart = parts[0].replace(/\|/g, '').toLowerCase().trim();
        matchedItem = inventory.find(i => i.name.toLowerCase().trim() === namePart);
    }

    if (!matchedItem) {
        const normalizedScannedCode = normalizeBarcode(cleanCode);
        matchedItem = inventory.find(i => {
          const itemBarcode = normalizeBarcode(i.barcode);
          return (itemBarcode === normalizedScannedCode && itemBarcode !== '') || 
                 (i.id === cleanCode) || 
                 (normalizedScannedCode.length > 4 && (itemBarcode.includes(normalizedScannedCode) || normalizedScannedCode.includes(itemBarcode)));
        });
    }

    if (!matchedItem) {
        matchedItem = inventory.find(i => i.name.toLowerCase().trim() === cleanCode.toLowerCase().trim());
    }
    
    if (matchedItem) {
      setSearchTerm(matchedItem.barcode || matchedItem.name);
      setShowGlobalScanner(null);
      setScanError(null);
    } else {
      const invCount = inventory.length;
      const withBarcode = inventory.filter(i => !!i.barcode).length;
      setScanError(`No encontrado: ${cleanCode} (Inv: ${invCount}, B: ${withBarcode})`);
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      setTimeout(() => setScanError(null), 3000);
    }
  }, [inventory]);

  const handleFormScan = (code: string) => {
    if ('vibrate' in navigator) navigator.vibrate(100);
    const cleanCode = code.trim();
    const matchedItem = findProductByCode(cleanCode);
    setShowFormScanner(null);

    if (matchedItem && loadExistingProduct(matchedItem, getSafeScannedBarcode(cleanCode))) {
      return;
    }

    const scannedBarcode = getSafeScannedBarcode(cleanCode);
    if (scannedBarcode) {
      setFormData(prev => ({ ...prev, barcode: scannedBarcode }));
    }
  };

  const resetFormDataForNewProduct = () => {
    setEditingId(null);
    setDetectedNotice(null);
    setFormData({
      name: '',
      unit: 'Und',
      cost: '0',
      price: '0',
      stock: '0',
      minStock: '5',
      abonoFactura: '0',
      abonoDeudaVieja: '0',
      icon: '📦',
      category: 'General',
      unitsPerPackage: '1',
      bulkUnit: 'Bulto',
      barcode: '',
      bulkPrice: '0',
      bulkProfitPercent: '15',
      expirationDate: ''
    });
    setProfitPercent('30');
    setBulkProfitPercent('15');
    setIsBulkMode(false);
    setShowModal(true);
  };

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      {/* Cabecera con Buscador y Descarga PDF Masivo */}
      <div className="flex gap-2">
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input 
              type="text" 
              placeholder="Buscar por nombre o código..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="w-full bg-white dark:bg-gray-800 rounded-2xl py-4 pl-12 pr-4 font-black shadow-md border-2 border-transparent focus:border-blue-500 outline-none transition-all text-sm" 
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
          <button 
            onClick={() => setShowGlobalScanner('barcode')}
            className="shrink-0 p-3.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-all border border-blue-500/20 bg-white dark:bg-gray-800 shadow-md"
            title="Escanear Barras"
          >
            <ScanBarcode size={22} strokeWidth={2.5} />
          </button>
          <button 
            onClick={() => setShowGlobalScanner('qr')}
            className="shrink-0 p-3.5 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-2xl transition-all border border-purple-500/20 bg-white dark:bg-gray-800 shadow-md"
            title="Escanear QR"
          >
            <QrCode size={22} />
          </button>
        </div>
        <button 
          onClick={() => downloadInventoryPDF(filteredInventory, 'Planilla_Inventario_Zambrano')}
          disabled={isGeneratingPDF || filteredInventory.length === 0}
          className="p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl shadow-lg active:scale-90 border-b-4 border-blue-200 dark:border-blue-900 transition-transform flex items-center gap-2"
          title="Descargar Planilla de Inventario"
        >
          {isGeneratingPDF ? <Loader2 size={24} className="animate-spin" /> : <FileDown size={24} />}
          <span className="hidden sm:inline text-[10px] font-black uppercase">LISTA PDF</span>
        </button>
        <button 
          onClick={() => downloadQRPDF(filteredInventory, 'QR_Inventario_Zambrano')}
          disabled={isGeneratingPDF || filteredInventory.length === 0}
          className="p-4 bg-gray-900 text-white rounded-2xl shadow-lg active:scale-90 border-b-4 border-black transition-transform flex items-center gap-2"
          title="Descargar todos los QR en PDF"
        >
          {isGeneratingPDF ? <Loader2 size={24} className="animate-spin" /> : <FileDown size={24} className="text-emerald-400" />}
          <span className="hidden sm:inline text-[10px] font-black uppercase">PDF QR</span>
        </button>
        <button 
          onClick={resetFormDataForNewProduct} 
          className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg active:scale-90 border-b-4 border-blue-800 transition-transform"
          title="Nuevo Producto"
        >
          <Plus size={28}/>
        </button>
      </div>

      {/* Barra de Filtro Rápido por Categoría */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
        {FILTER_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-100 dark:border-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Banner Superior de Resumen de Alertas (Stock Bajo / Vencimientos) */}
      {alertStats.totalAlerts > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-red-500/10 to-orange-500/10 dark:from-amber-950/30 dark:via-red-950/30 dark:to-orange-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="text-amber-500 shrink-0" size={18} />
            <div className="text-[11px] leading-tight text-gray-800 dark:text-gray-200">
              <span className="font-bold">Monitoreo de Almacén:</span>
              <div className="flex flex-wrap gap-2 mt-0.5 text-gray-600 dark:text-gray-300 font-medium">
                {alertStats.lowStockCount > 0 && (
                  <span className="text-red-500 font-bold">{alertStats.lowStockCount} con stock bajo</span>
                )}
                {alertStats.expiringSoonCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">{alertStats.expiringSoonCount} próximos a vencer (≤ 30d)</span>
                )}
                {alertStats.expiredCount > 0 && (
                  <span className="text-red-600 font-bold">{alertStats.expiredCount} ya vencidos</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Productos con Badges Cromáticos */}
      <div className="grid gap-3">
        {filteredInventory.map(item => {
          const expStatus = getExpirationStatus(item.expirationDate);

          return (
            <div 
              key={item.id} 
              className="bg-white dark:bg-gray-800 p-5 rounded-[30px] shadow-sm border-b-4 border-gray-100 dark:border-gray-900 active:scale-[0.99] cursor-pointer hover:shadow-md transition-all" 
              onClick={() => { selectProduct(item); setShowModal(true); }}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-3xl border shadow-inner overflow-hidden shrink-0">
                    {item.icon?.startsWith('data:image') || item.icon?.startsWith('blob:') ? <img src={item.icon} className="w-full h-full object-cover"/> : <span>{item.icon}</span>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-gray-950 dark:text-white uppercase leading-tight text-base">{item.name}</h4>
                      <span className="text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold px-2 py-0.5 rounded-md">
                        {item.category || 'General'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5 mt-1">
                      <div className="flex items-center gap-2">
                         <p className="text-sm font-black text-emerald-600 leading-none">{formatMoney(item.price)}</p>
                         <span className="text-[9px] text-gray-400 font-bold uppercase">{item.unit} (Menudeo)</span>
                      </div>
                      {item.bulkUnit && item.bulkPrice && (
                         <div className="flex items-center gap-2">
                           <p className="text-sm font-black text-orange-600 leading-none">{formatMoney(item.bulkPrice)}</p>
                           <span className="text-[9px] text-gray-400 font-bold uppercase">{item.bulkUnit} (Mayorista)</span>
                         </div>
                      )}
                    </div>
                    
                    {/* Badge Cromático de Caducidad */}
                    {expStatus && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 ${expStatus.badgeClass}`}>
                          <Clock size={10} />
                          {expStatus.label}
                        </span>
                      </div>
                    )}

                    {item.barcode && (
                      <div className="mt-1 flex items-center gap-1 opacity-60">
                        <ScanBarcode size={10} className="text-gray-400" />
                        <span className="text-[9px] font-mono font-bold text-gray-500">{item.barcode}</span>
                      </div>
                    )}

                    {item.supplierDebt && item.supplierDebt > 0 ? (
                      <div className="mt-1.5 flex items-center gap-1.5 bg-red-50 dark:bg-red-900/10 px-2 py-0.5 rounded-xl border border-red-100 dark:border-red-900/30 w-fit">
                        <AlertTriangle size={10} className="text-red-500" />
                        <span className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-tighter">
                          Deuda Proveedor: {formatMoney(item.supplierDebt)}
                        </span>
                      </div>
                    ) : null}
                    
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-2.5">
                  <div className="text-right">
                    <p className={`text-2xl font-black leading-none ${item.stock <= item.minStock ? 'text-red-500' : 'text-blue-600'}`}>{item.stock}</p>
                    <p className="text-[9px] font-black text-gray-400 uppercase mt-0.5">Disponible</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); downloadQRPDF([item], `QR_${item.name.replace(/\s+/g, '_')}`); }}
                    className="p-2 bg-gray-100 dark:bg-gray-700 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-90 border border-emerald-100 dark:border-emerald-900/30"
                    title="Descargar QR"
                  >
                    <QrCode size={18} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredInventory.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
            <Box size={40} className="mx-auto mb-2 opacity-30" />
            <p className="font-bold text-sm">No se encontraron productos</p>
            <p className="text-xs text-gray-400 mt-0.5">Prueba cambiando el filtro de categoría o buscando otro término.</p>
          </div>
        )}
      </div>

      {/* Scanners */}
      {showGlobalScanner && (
        <BarcodeScanner 
          onScan={handleGlobalScan} 
          onClose={() => setShowGlobalScanner(null)} 
          title={showGlobalScanner === 'qr' ? "Escaneando QR" : "Escaneando Barras"}
          scannerId="global-barcode-reader"
          mode={showGlobalScanner}
          errorMessage={scanError}
        />
      )}
      {showFormScanner && (
        <BarcodeScanner 
          onScan={handleFormScan} 
          onClose={() => setShowFormScanner(null)} 
          title={showFormScanner === 'qr' ? "Escaneando QR" : "Escaneando Barras"}
          scannerId="form-barcode-reader"
          mode={showFormScanner}
          errorMessage={scanError}
        />
      )}

      {/* Modal de Registro / Edición de Producto */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-2 backdrop-blur-md">
          {showDeleteConfirm && <DeleteConfirmModal name={formData.name} onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} />}
          <div className="bg-[#0f172a] text-white w-full max-w-lg rounded-[40px] flex flex-col h-[94vh] shadow-2xl overflow-hidden border-t-8 border-blue-600 animate-in zoom-in-95">
            <div className="p-5 border-b border-white/5 flex justify-between items-center shrink-0">
               <div className="min-w-0">
                 <h2 className="text-sm sm:text-base font-black italic uppercase flex items-center gap-2">
                   <Calculator size={22} className="text-blue-400 shrink-0" /> <span className="truncate">Centro de Control del Tendero</span>
                 </h2>
                 <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1 ml-8">
                   {editingId ? 'Actualizando producto existente' : 'Registro de nuevo producto'}
                 </p>
               </div>
               <div className="flex gap-2">
                 {editingId && (
                   userRole === 'admin' ? (
                     <button onClick={() => setShowDeleteConfirm(true)} className="p-2 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors" title="Eliminar producto">
                       <Trash2 size={18}/>
                     </button>
                   ) : (
                     <button 
                       onClick={() => alert('Acceso Denegado (Error 403): Solo el Administrador puede eliminar productos del catálogo.')} 
                       className="p-2 bg-gray-800 text-gray-500 rounded-full cursor-not-allowed" 
                       title="Eliminación bloqueada (403)"
                     >
                       <Lock size={18}/>
                     </button>
                   )
                 )}
                 <button onClick={() => { setShowModal(false); setDetectedNotice(null); }} className="p-2 bg-white/10 rounded-full hover:bg-red-500 transition-colors"><X size={18}/></button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 no-scrollbar space-y-5">

                {detectedNotice && (
                  <div className="flex items-center gap-2.5 p-3 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl animate-in fade-in">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-emerald-300 uppercase tracking-wide leading-tight">{detectedNotice}</p>
                      {formData.name && <p className="text-[9px] font-bold text-emerald-500/80 uppercase truncate mt-0.5">{formData.name}</p>}
                    </div>
                  </div>
                )}

                {/* ══════════════ TARJETA A · IDENTIFICACIÓN Y CADUCIDAD ══════════════ */}
                <section className="bg-white/5 border border-white/10 rounded-[30px] p-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 text-[11px] font-black flex items-center justify-center shrink-0">A</span>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Identificación y Caducidad</p>
                  </div>

                  {/* Nombre con autocompletado */}
                  <div className="relative">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Nombre del Producto *</label>
                    <input
                      value={formData.name}
                      onChange={e => handleNameChange(e.target.value)}
                      className="w-full mt-1 p-3.5 bg-white/5 rounded-2xl font-black border-2 border-transparent focus:border-blue-500 outline-none uppercase tracking-tight text-base"
                      placeholder="BUSCAR O ESCRIBIR..."
                    />
                    {showSuggestions && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-gray-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                        {filteredSuggestions.map(item => (
                          <button key={item.id} onClick={() => {
                            selectProduct(item, getSafeScannedBarcode(formData.barcode));
                            setDetectedNotice('Producto existente detectado en inventario: cargando datos...');
                          }} className="w-full text-left p-3.5 hover:bg-blue-600 transition-colors border-b border-white/5 flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{item.icon}</span>
                              <div><p className="font-black text-sm uppercase group-hover:text-white">{item.name}</p></div>
                            </div>
                            <ArrowRight size={14} className="text-gray-500 group-hover:text-white" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Código de barras / QR con botones externos */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest ml-1 flex items-center gap-1"><ScanBarcode size={10} /> Código de Barras / QR</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={formData.barcode}
                        onChange={e => handleBarcodeChange(e.target.value)}
                        className="flex-1 min-w-0 p-3.5 bg-white/5 rounded-2xl font-black border-2 border-transparent focus:border-emerald-500 outline-none text-xs tracking-wider"
                        placeholder="ESCANEA O ESCRIBE EL CÓDIGO..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormScanner('barcode')}
                        className="shrink-0 p-3.5 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-colors"
                        title="Escanear código de barras"
                      >
                        <ScanBarcode size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFormScanner('qr')}
                        className="shrink-0 p-3.5 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500 hover:text-white transition-colors"
                        title="Escanear código QR"
                      >
                        <QrCode size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Categoría y Vencimiento */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-1">Categoría</label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full p-3 bg-gray-800/80 rounded-xl font-black text-xs outline-none border border-white/10 focus:border-blue-500 transition-all text-white"
                      >
                        {INVENTORY_CATEGORIES.map(cat => (
                          <option key={cat} value={cat} className="bg-[#0f172a] text-white">
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Calendar size={10} /> Vencimiento
                      </label>
                      <input
                        type="date"
                        value={formData.expirationDate}
                        onChange={e => setFormData({...formData, expirationDate: e.target.value})}
                        className="w-full p-3 bg-gray-800/80 rounded-xl font-black text-xs outline-none border border-white/10 focus:border-purple-500 text-white"
                      />
                    </div>
                  </div>

                  {/* Presentación y Aviso de Stock Bajo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-1">Presentación / Unidad</label>
                      <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-3 bg-gray-800/50 rounded-xl font-black text-xs outline-none border border-white/10 focus:border-blue-500 transition-all">
                        {RETAIL_UNITS.map(u => <option key={u} value={u} className="bg-[#0f172a]">{u}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Aviso Stock Bajo</label>
                      <input value={formData.minStock} onChange={e => setFormData({...formData, minStock: formatNumber(e.target.value)})} className="w-full p-3 bg-gray-800/50 rounded-xl font-black text-base outline-none border border-white/10 focus:border-orange-500 transition-all" inputMode="numeric" />
                    </div>
                  </div>
                </section>

                {/* ══════════════ TARJETA B · ENTRADA DE MERCANCÍA Y DEUDA CON PROVEEDOR ══════════════ */}
                <section className="bg-white/5 border border-white/10 rounded-[30px] p-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                    <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 text-[11px] font-black flex items-center justify-center shrink-0">B</span>
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Entrada de Mercancía y Deuda con Proveedor</p>
                  </div>

                  {/* Selector UNIDAD / POR MAYOR */}
                  <div className="flex bg-black/20 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => handleModeSwitch(false)}
                      className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all ${!isBulkMode ? 'bg-blue-600 shadow-md text-white' : 'text-gray-400'}`}
                    >UNIDAD</button>
                    <button
                      type="button"
                      onClick={() => handleModeSwitch(true)}
                      className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all ${isBulkMode ? 'bg-orange-600 shadow-md text-white' : 'text-gray-400'}`}
                    >POR MAYOR (BULTO/CAJA)</button>
                  </div>

                  {isBulkMode ? (
                    <div className="bg-orange-500/5 border-2 border-orange-500/20 p-4 rounded-3xl space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                          <Box size={10} /> Tipo de Embalaje
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {BULK_UNITS.map(bu => (
                            <button
                              key={bu}
                              type="button"
                              onClick={() => setFormData({...formData, bulkUnit: bu})}
                              className={`px-2.5 py-1 rounded-xl text-[9px] font-black border transition-all ${formData.bulkUnit === bu ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                            >
                              {bu.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Costo de {formData.bulkUnit}</label>
                          <input
                            value={formData.cost}
                            disabled={userRole === 'dependiente'}
                            onChange={e => handleCostChange(e.target.value)}
                            className={`w-full p-3 bg-white/5 rounded-xl font-black text-base border-2 border-orange-500/30 outline-none focus:border-orange-500 ${userRole === 'dependiente' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            inputMode="numeric"
                          />
                          {userRole === 'dependiente' && <span className="text-[8px] text-amber-400 font-bold block">🔒 Restringido a Admin</span>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Und x {formData.bulkUnit}</label>
                          <input
                            type="number"
                            value={formData.unitsPerPackage}
                            onChange={e => handleUnitsPerPackageChange(e.target.value)}
                            className="w-full p-3 bg-white/5 rounded-xl font-black text-base border-2 border-orange-500/30 outline-none focus:border-orange-500"
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-3 py-2.5">
                        <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">Costo unitario calculado:</span>
                        <span className="text-sm font-black text-emerald-400">{formatMoney(metrics.unitCost)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Costo x Unidad</label>
                      <input
                        value={formData.cost}
                        disabled={userRole === 'dependiente'}
                        onChange={e => handleCostChange(e.target.value)}
                        className={`w-full p-3 bg-white/5 rounded-2xl font-black text-base border-2 border-orange-500/30 outline-none focus:border-orange-500 ${userRole === 'dependiente' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        inputMode="numeric"
                      />
                      {userRole === 'dependiente' && <span className="text-[8px] text-amber-400 font-bold block">🔒 Restringido a Admin</span>}
                    </div>
                  )}

                  {/* Entrada de mercancía */}
                  <div className="bg-black/20 p-4 rounded-3xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={14} /> Entrada de Mercancía</p>
                      <span className="text-[8px] font-black text-gray-500 uppercase">
                        {isBulkMode ? `1 ${formData.bulkUnit} = ${metrics.unitsInPack} ${formData.unit}` : `Unidades (${formData.unit})`}
                      </span>
                    </div>
                    <div className="grid grid-cols-[0.7fr_1.8fr_0.7fr] gap-3 items-center">
                      <div className="bg-gray-800/50 p-2 rounded-2xl text-center border border-white/5 h-full flex flex-col justify-center opacity-60">
                        <p className="text-[7px] font-black text-gray-500 uppercase mb-1">EXISTENTE</p>
                        <p className="text-base font-black text-gray-400">{metrics.previousStock}</p>
                      </div>
                      <div className="bg-blue-600/20 p-3 rounded-2xl text-center border-2 border-blue-500 shadow-xl shadow-blue-500/20 h-full flex flex-col justify-center">
                        <p className="text-[8px] font-black text-blue-400 uppercase mb-1 leading-tight">
                          {isBulkMode ? `¿CUÁNTOS ${formData.bulkUnit.toUpperCase()}S ENTRAN?` : '¿CUÁNTAS UNIDADES ENTRAN?'}
                        </p>
                        <input
                          value={formData.stock}
                          onChange={e => setFormData({...formData, stock: formatNumber(e.target.value)})}
                          className="w-full bg-black/60 rounded-xl text-3xl font-black text-center outline-none text-white border border-white/10 py-3 px-1 focus:border-blue-400 transition-all"
                          placeholder="0"
                          inputMode="numeric"
                        />
                        <p className="text-[8px] font-bold text-blue-200 mt-1">
                          {isBulkMode ? `= ${metrics.unitsEntering} ${formData.unit} reales` : `= ${metrics.unitsEntering} ${formData.unit}`}
                        </p>
                      </div>
                      <div className="bg-emerald-500/10 p-2 rounded-2xl text-center border border-emerald-500/30 h-full flex flex-col justify-center">
                        <p className="text-[7px] font-black text-emerald-400 uppercase mb-1">QUEDARÁ</p>
                        <p className="text-lg font-black text-emerald-400 leading-none">{metrics.finalStockSum}</p>
                        <p className="text-[7px] font-bold text-emerald-600 uppercase mt-1">{formData.unit}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bloque financiero del proveedor */}
                  <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-3">
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase ml-1">Total de esta compra</p>
                        <p className="text-2xl font-black text-white tracking-tighter leading-none mt-1">{formatMoney(metrics.invoiceTotal)}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-1">¿Cuánto pagas hoy?</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-bold">$</span>
                          <input value={formData.abonoFactura} onChange={e => setFormData({...formData, abonoFactura: formatNumber(e.target.value)})} className="w-full p-3 pl-7 bg-blue-500/10 rounded-xl font-black text-base border-2 border-blue-500/20 outline-none focus:border-blue-500 shadow-inner" placeholder="0" inputMode="numeric" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[9px] font-black uppercase flex items-center gap-1.5 text-gray-400"><Wallet size={12} /> SALDO ANTERIOR:</p>
                      <span className="text-xs font-black text-red-400">{formatMoney(metrics.previousDebt)}</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-red-400 uppercase tracking-widest ml-1">Abonar a saldo anterior</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 font-bold">$</span>
                        <input value={formData.abonoDeudaVieja} onChange={e => setFormData({...formData, abonoDeudaVieja: formatNumber(e.target.value)})} className="w-full p-2.5 pl-7 bg-black/20 rounded-xl font-black text-base outline-none border border-red-500/30 focus:border-red-500" placeholder="0" inputMode="numeric" />
                      </div>
                    </div>

                    <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-3 text-center">
                      <p className="text-[9px] font-black text-red-300 uppercase tracking-widest">Saldo Total que quedas debiendo al proveedor</p>
                      <p className="text-3xl font-black text-red-400 tracking-tighter leading-none mt-1">{formatMoney(metrics.finalDebt)}</p>
                    </div>
                  </div>
                </section>

                {/* ══════════════ TARJETA C · CALCULADORA BIDIRECCIONAL DE PRECIOS ══════════════ */}
                <section className="bg-emerald-500/5 border-2 border-emerald-500/20 rounded-[30px] p-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-emerald-500/10 pb-2.5">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-[11px] font-black flex items-center justify-center shrink-0">C</span>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Calculadora Bidireccional de Precios y Ganancia</p>
                  </div>

                  {/* Resumen de costos */}
                  <div className={`grid gap-2 ${isBulkMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="bg-black/20 p-2.5 rounded-2xl border border-white/5 text-center">
                      <p className="text-[8px] font-black text-blue-300 uppercase tracking-widest">Costo x Unidad</p>
                      <p className="text-sm font-black text-white mt-0.5">{formatMoney(metrics.unitCost)}</p>
                    </div>
                    {isBulkMode && (
                      <div className="bg-black/20 p-2.5 rounded-2xl border border-white/5 text-center">
                        <p className="text-[8px] font-black text-orange-300 uppercase tracking-widest">Costo x {formData.bulkUnit}</p>
                        <p className="text-sm font-black text-white mt-0.5">{formatMoney(metrics.rawCost)}</p>
                      </div>
                    )}
                  </div>

                  {/* Venta al menudeo */}
                  <div className="bg-emerald-500/10 p-3.5 rounded-[20px] border border-emerald-500/30 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tight">Venta al Menudeo (por {formData.unit})</span>
                        <span className="text-[8px] text-emerald-500/60 font-bold uppercase">Margen recomendado: 30-50%</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-emerald-500/20 shadow-inner">
                        <button
                          type="button"
                          disabled={userRole === 'dependiente'}
                          onClick={() => adjustProfit(-5)}
                          className={`w-8 h-8 flex items-center justify-center bg-gray-800 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all active:scale-95 ${userRole === 'dependiente' ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <Minus size={16} strokeWidth={3} />
                        </button>
                        <div className="flex items-center">
                          <input
                            type="number"
                            disabled={userRole === 'dependiente'}
                            value={profitPercent}
                            onChange={e => handleProfitChange(e.target.value)}
                            className={`w-12 bg-transparent text-center font-black text-lg outline-none text-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${userRole === 'dependiente' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            inputMode="decimal"
                          />
                          <span className="text-sm font-black text-emerald-600/60">%</span>
                        </div>
                        <button
                          type="button"
                          disabled={userRole === 'dependiente'}
                          onClick={() => adjustProfit(5)}
                          className={`w-8 h-8 flex items-center justify-center bg-gray-800 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all active:scale-95 ${userRole === 'dependiente' ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <Plus size={16} strokeWidth={3} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest ml-1">Precio de Venta Final</label>
                        <div className="flex items-center gap-1 bg-black/20 rounded-[18px] px-2 border border-emerald-500/30 focus-within:border-emerald-500 transition-all">
                          <span className="text-lg font-black text-emerald-500">$</span>
                          <input
                            value={formData.price}
                            onChange={e => handlePriceChange(e.target.value)}
                            className="w-full bg-transparent text-xl font-black outline-none tracking-tighter text-emerald-400 py-2 placeholder:text-emerald-900/20"
                            placeholder="0"
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                      <div className="bg-black/20 rounded-[18px] p-2.5 text-center border border-white/5">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Ganancia x {formData.unit}</p>
                        <p className={`text-lg font-black tracking-tighter ${metrics.unitProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(metrics.unitProfit)}</p>
                      </div>
                    </div>

                    {metrics.unitCost > 0 && metrics.unitProfit < 0 && (
                      <div className="flex items-center gap-2 p-2.5 bg-red-600/20 border-2 border-red-500/50 rounded-xl animate-in fade-in">
                        <AlertTriangle size={16} className="text-red-400 shrink-0" />
                        <p className="text-[10px] font-black text-red-300 uppercase leading-tight">¡Atención! Precio por debajo del costo (pérdida)</p>
                      </div>
                    )}
                  </div>

                  {/* Venta al por mayor */}
                  {isBulkMode && (
                    <div className="bg-orange-500/10 p-3.5 rounded-[20px] border border-orange-500/30 space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-orange-400 uppercase tracking-tight">Venta al Por Mayor (por {formData.bulkUnit})</span>
                          <span className="text-[8px] text-orange-500/60 font-bold uppercase">Margen recomendado: 10-25%</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-orange-500/20 shadow-inner">
                          <button
                            type="button"
                            disabled={userRole === 'dependiente'}
                            onClick={() => adjustBulkProfit(-5)}
                            className={`w-8 h-8 flex items-center justify-center bg-gray-800 text-orange-400 rounded-xl hover:bg-orange-500 hover:text-white transition-all active:scale-95 ${userRole === 'dependiente' ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <Minus size={16} strokeWidth={3} />
                          </button>
                          <div className="flex items-center">
                            <input
                              type="number"
                              disabled={userRole === 'dependiente'}
                              value={bulkProfitPercent}
                              onChange={e => handleBulkProfitChange(e.target.value)}
                              className={`w-12 bg-transparent text-center font-black text-lg outline-none text-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${userRole === 'dependiente' ? 'opacity-60 cursor-not-allowed' : ''}`}
                              inputMode="decimal"
                            />
                            <span className="text-sm font-black text-orange-600/60">%</span>
                          </div>
                          <button
                            type="button"
                            disabled={userRole === 'dependiente'}
                            onClick={() => adjustBulkProfit(5)}
                            className={`w-8 h-8 flex items-center justify-center bg-gray-800 text-orange-400 rounded-xl hover:bg-orange-500 hover:text-white transition-all active:scale-95 ${userRole === 'dependiente' ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Precio de Venta {formData.bulkUnit}</label>
                          <div className="flex items-center gap-1 bg-black/20 rounded-[18px] px-2 border border-orange-500/30 focus-within:border-orange-500 transition-all">
                            <span className="text-lg font-black text-orange-500">$</span>
                            <input
                              value={formData.bulkPrice}
                              onChange={e => handleBulkPriceChange(e.target.value)}
                              className="w-full bg-transparent text-xl font-black outline-none tracking-tighter text-orange-400 py-2 placeholder:text-orange-900/20"
                              placeholder="0"
                              inputMode="numeric"
                            />
                          </div>
                        </div>
                        <div className="bg-black/20 rounded-[18px] p-2.5 text-center border border-white/5">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Ganancia x {formData.bulkUnit}</p>
                          <p className={`text-lg font-black tracking-tighter ${metrics.bulkProfit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatMoney(metrics.bulkProfit)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
            </div>

            <div className="shrink-0 p-5 bg-[#0f172a] border-t border-white/5">
              <button 
                onClick={handleSave} 
                disabled={isSaving} 
                className={`w-full py-4 text-white font-black text-lg rounded-[24px] shadow-2xl active:scale-95 transition-all border-b-6 uppercase tracking-tighter italic flex items-center justify-center gap-3 ${isSaving ? 'bg-gray-600 border-gray-800' : 'bg-emerald-600 border-emerald-800 hover:bg-emerald-700'}`}
              >
                {isSaving ? <Loader2 className="animate-spin" /> : 'CONFIRMAR Y GUARDAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DeleteConfirmModal: React.FC<{ onConfirm: () => void; onCancel: () => void; name: string }> = ({ onConfirm, onCancel, name }) => (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 animate-in fade-in backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldAlert size={32} /></div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">¿Eliminar Producto?</h3>
            <p className="text-sm text-gray-500 mb-6">¿Estás seguro de eliminar <span className="font-bold">"{name}"</span>? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl">Cancelar</button>
                <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30">Sí, Eliminar</button>
            </div>
        </div>
    </div>
);

export default InventoryView;

import { Debtor, InventoryItem, ChartDataPoint, Transaction } from './types';

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

// Helper to generate consistent mock transactions
const generateMockTransactions = (): Transaction[] => {
  const txs: Transaction[] = [];
  // Last 30 days
  for (let i = 0; i < 30; i++) {
    const date = NOW - (i * DAY);
    // 2-5 transactions per day
    const count = Math.floor(Math.random() * 4) + 2; 
    for (let j = 0; j < count; j++) {
      const isSale = Math.random() > 0.3; // 70% sales
      txs.push({
        id: `mock-${i}-${j}`,
        type: isSale ? 'venta' : 'gasto',
        amount: isSale ? Math.round(Math.random() * 50000 + 2000) : Math.round(Math.random() * 20000 + 5000),
        date: date + Math.random() * (12 * 60 * 60 * 1000), // Random time during day
        description: isSale ? 'Venta General' : 'Gastos Varios'
      });
    }
  }
  return txs.sort((a, b) => b.date - a.date);
};

export const MOCK_TRANSACTIONS: Transaction[] = generateMockTransactions();

export const INVENTORY_DATA: InventoryItem[] = [
  { 
    id: '1', 
    name: 'Aceite 500ml', 
    category: 'Despensa', 
    stock: 24, 
    initialStock: 36,
    minStock: 10, 
    unit: 'Botella', 
    cost: 8000, 
    price: 12000, 
    icon: '🍾',
    unitsPerPackage: 12,
    bulkUnit: 'Caja',
    bulkCost: 96000,
    isPaid: true,
    supplierDebt: 0,
    purchaseDate: NOW - (DAY * 2),
    lastPurchaseDesc: '2 Cajas',
    paymentHistory: []
  },
  { 
    id: '2', 
    name: 'Arroz (Roa)', 
    category: 'Granos', 
    stock: 100, 
    initialStock: 100,
    minStock: 25, 
    unit: 'Libras', 
    cost: 2000, 
    price: 2800, 
    icon: '🍚',
    unitsPerPackage: 50,
    bulkUnit: 'Paca',
    bulkCost: 100000,
    isPaid: false,
    supplierDebt: 200000,
    purchaseDate: NOW,
    lastPurchaseDesc: '2 Pacas',
    paymentHistory: []
  },
  { 
    id: '3', 
    name: 'Huevos AA', 
    category: 'Huevos', 
    stock: 60, 
    initialStock: 90,
    minStock: 30, 
    unit: 'Unidades', 
    cost: 500, 
    price: 800, 
    icon: '🥚', 
    unitsPerPackage: 30, 
    bulkUnit: 'Carton', 
    bulkCost: 15000,
    isPaid: true, 
    supplierDebt: 0,
    purchaseDate: NOW - (DAY * 5),
    lastPurchaseDesc: '2 Cartones',
    paymentHistory: []
  },
  { 
    id: '4', 
    name: 'Pan Tajado', 
    category: 'Panadería', 
    stock: 5, 
    initialStock: 20,
    minStock: 8, 
    unit: 'Paquete', 
    cost: 3500, 
    price: 5500, 
    icon: '🍞', 
    isPaid: true, 
    supplierDebt: 0,
    purchaseDate: NOW - (DAY * 10),
    lastPurchaseDesc: '10 Paquetes',
    paymentHistory: []
  },
];

export const DEBTORS_DATA: Debtor[] = [
  { id: '1', name: 'Juan Martinez', phone: '3001234567', days: 3, debt: 45000, initial: 'JM', risk: 'low', payments: [] },
  { id: '2', name: 'Maria Rodriguez', phone: '3109876543', days: 15, debt: 12500, initial: 'MR', risk: 'medium', payments: [] },
  { id: '3', name: 'Pedro (Taller)', days: 25, debt: 80000, initial: 'PT', risk: 'high', payments: [] },
  { id: '4', name: 'Vecino Luis', days: 1, debt: 5000, initial: 'VL', risk: 'low', payments: [] },
  { id: '5', name: 'Ana la Peluquera', days: 8, debt: 22000, initial: 'AP', risk: 'medium', payments: [] },
];

export const CHART_DATA: ChartDataPoint[] = [
  { label: 'L', ventas: 150000, gastos: 50000 },
  { label: 'M', ventas: 200000, gastos: 40000 },
  { label: 'X', ventas: 180000, gastos: 80000 },
  { label: 'J', ventas: 220000, gastos: 60000 },
  { label: 'V', ventas: 250000, gastos: 65000 },
  { label: 'S', ventas: 300000, gastos: 90000 },
  { label: 'D', ventas: 120000, gastos: 20000 },
];

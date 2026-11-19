
export type Tab = 'home' | 'inventory' | 'debtors' | 'reports';
export type TransactionType = 'venta' | 'gasto';
export type UserRole = 'admin' | 'dependiente';

export interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface SaleItem {
  id?: number;
  transaction_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_manual: boolean;
  created_at?: string;
  user_id?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: number;
  description?: string;
  items?: TransactionItem[];
  sale_items?: SaleItem[];
  user_id?: string;
}

export interface PaymentRecord {
  id: string;
  date: number;
  amount: number;
  note?: string;
}

export interface PurchaseHistoryEntry {
  id: string;
  date: number;
  quantity: number;
  unitCost: number;
  totalInvoice: number;
  debtAdded: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  initialStock: number; // Requerido para ver stock usado
  minStock: number;
  unit: string;
  cost: number;
  price: number;
  icon?: string;
  purchaseDate?: number;
  lastPurchaseDesc?: string;
  
  unitsPerPackage?: number;
  bulkUnit?: string | null;
  bulkCost?: number;
  bulkPrice?: number | null;
  profitPercent?: number;
  bulkProfitPercent?: number | null;
  barcode?: string;
  expirationDate?: string;

  isPaid?: boolean;
  supplierDebt?: number;
  paymentHistory?: PaymentRecord[];
  purchaseHistory?: PurchaseHistoryEntry[];
  
  user_id?: string;
}

export interface Debtor {
  id: string;
  name: string;
  phone?: string;
  days: number;
  debt: number;
  initial: string;
  risk: 'low' | 'medium' | 'high';
  payments?: PaymentRecord[];
  consentAccepted?: boolean;
  consentDate?: string;
  user_id?: string;
}

export interface ChartDataPoint {
  label: string;
  ventas: number;
  gastos: number;
}

export type LogFunction = (message: string, type?: 'info' | 'error' | 'success') => void;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

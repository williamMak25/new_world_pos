export type TeamRole = "ADMIN" | "MANAGER" | "CASHIER";

export interface UserTeam {
  teamId: string;
  teamName: string;
  isOwner: boolean;
  role: TeamRole | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  isSuperuser: boolean;
  isActive: boolean;
  isVerified: boolean;
  teams: UserTeam[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Store {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  taxRate: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export interface Product {
  id: string;
  teamId: string;
  categoryId: string | null;
  sku: string;
  slug: string;
  barcode: string | null;
  name: string;
  description: string | null;
  price: string;
  cost: string;
  trackInventory: boolean;
  isActive: boolean;
}

export interface InventoryRecord {
  id: string;
  storeId: string;
  productId: string;
  productName: string | null;
  sku: string | null;
  quantity: number;
  lowStockThreshold: number;
}

export interface InventoryAdjustmentRecord {
  id: string;
  productId: string | null;
  productName: string;
  userLabel: string | null;
  delta: number;
  quantityAfter: number;
  reason: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  teamId: string;
  name: string;
  email: string | null;
  phone: string | null;
  loyaltyPoints: number;
  notes: string | null;
}

export interface SaleItem {
  id: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface Payment {
  id: string;
  method: string;
  amount: string;
  reference: string | null;
}

export interface Sale {
  id: string;
  storeId: string;
  cashierId: string | null;
  customerId: string | null;
  saleNumber: string;
  status: "COMPLETED" | "REFUNDED" | "VOIDED";
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
}

export interface TopProduct {
  productId: string | null;
  productName: string;
  quantitySold: number;
  revenue: string;
}

export interface LowStockItem {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  lowStockThreshold: number;
}

export interface SalesBreakdownRow {
  periodStart: string;
  saleCount: number;
  netSales: string;
  totalCost: string;
  grossProfit: string;
}

export interface SalesSummary {
  storeId: string;
  periodStart: string;
  periodEnd: string;
  saleCount: number;
  grossSales: string;
  discountTotal: string;
  taxTotal: string;
  netSales: string;
  totalCost: string;
  grossProfit: string;
  breakdownGranularity: "day" | "week" | "month";
  breakdown: SalesBreakdownRow[];
  capitalInStock: string;
}

export interface StoreDashboard {
  storeId: string;
  todaySales: string;
  todaySaleCount: number;
  weekSales: string;
  lowStockCount: number;
  topProducts: TopProduct[];
  lowStockItems: LowStockItem[];
}

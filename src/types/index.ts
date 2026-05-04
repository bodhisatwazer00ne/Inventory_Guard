export type PaymentStatus = 'PAID' | 'PAY_LATER';
export type LedgerStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface UserProfile {
  id: string;
  shopName: string;
  email: string;
  role: 'ADMIN' | 'SALES';
  shopId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  sku?: string;
  category?: string;
  price: number;
  quantity: number;
  lowStockThreshold?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  shopId: string;
  customerNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  totalDue: number;
  lastReminderSentAt?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Order {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  shopId: string;
  customerId: string;
  orderId: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: LedgerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  shopId: string;
  ledgerId?: string;
  customerId: string;
  amount: number;
  timestamp: string;
  type?: string;
}

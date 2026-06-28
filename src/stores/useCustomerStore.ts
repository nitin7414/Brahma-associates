import { create } from 'zustand';
import { db } from '@/db/client';
import { customers, transactions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  altPhone: string | null;
  businessName: string | null;
  address: string | null;
  gstNumber: string | null;
  outstandingBalance: number;
  purchasedScaleName: string | null;
  model: string | null;
  sellingPrice: number | null;
  gstCharged: number | null;
  photoUri: string | null;
  notes: string | null;
  isActive: number;
  isSynced: number;
  createdAt: number;
  updatedAt: number;
}

export interface CustomerTransaction {
  id: string;
  type: 'sale' | 'purchase' | 'return_in' | 'return_out' | 'payment';
  subtotal: number;
  discount: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  paymentMode: string | null;
  paymentStatus: string;
  notes?: string | null;
  createdAt: number;
}

interface CustomerState {
  customersList: Customer[];
  isLoading: boolean;

  loadCustomers: () => Promise<void>;
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'isSynced' | 'outstandingBalance'>) => Promise<string | null>;
  editCustomer: (id: string, updates: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'isSynced'>>) => Promise<boolean>;
  deactivateCustomer: (id: string) => Promise<boolean>;
  getCustomerTransactions: (customerId: string) => Promise<CustomerTransaction[]>;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customersList: [],
  isLoading: false,

  loadCustomers: async () => {
    try {
      set({ isLoading: true });
      const results = db.select().from(customers).where(eq(customers.isActive, 1)).all();
      set({ customersList: results as Customer[], isLoading: false });
    } catch (error) {
      console.error('Failed to load customers:', error);
      set({ isLoading: false });
    }
  },

  addCustomer: async (customerData) => {
    try {
      const id = `customer_${Date.now()}`;
      const now = Date.now();

      const newCustomer = {
        ...customerData,
        id,
        outstandingBalance: 0.0,
        isActive: 1,
        isSynced: 0,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(customers).values(newCustomer).run();
      await get().loadCustomers();
      return id;
    } catch (error) {
      console.error('Failed to add customer:', error);
      return null;
    }
  },

  editCustomer: async (id, updates) => {
    try {
      const now = Date.now();
      await db.update(customers)
        .set({
          ...updates,
          isSynced: 0,
          updatedAt: now,
        })
        .where(eq(customers.id, id))
        .run();
      await get().loadCustomers();
      return true;
    } catch (error) {
      console.error('Failed to update customer:', error);
      return false;
    }
  },

  deactivateCustomer: async (id) => {
    try {
      await db.update(customers)
        .set({
          isActive: 0,
          isSynced: 0,
          updatedAt: Date.now(),
        })
        .where(eq(customers.id, id))
        .run();
      await get().loadCustomers();
      return true;
    } catch (error) {
      console.error('Failed to soft delete customer:', error);
      return false;
    }
  },

  getCustomerTransactions: async (customerId) => {
    try {
      const results = db
        .select()
        .from(transactions)
        .where(eq(transactions.customerId, customerId))
        .orderBy(desc(transactions.createdAt))
        .all();

      return results as CustomerTransaction[];
    } catch (error) {
      console.error('Failed to load customer transactions:', error);
      return [];
    }
  },
}));

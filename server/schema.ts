import { pgTable, text, integer, doublePrecision, bigint } from 'drizzle-orm/pg-core';

export const staffUsers = pgTable('staff_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'owner' | 'staff'
  pinHash: text('pin_hash').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const stockItems = pgTable('stock_items', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  brand: text('brand'),
  name: text('name').notNull(),
  capacityLabel: text('capacity_label'),
  variant: text('variant'),
  quantity: integer('quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  costPrice: doublePrecision('cost_price'),
  sellingPrice: doublePrecision('selling_price'),
  photoUri: text('photo_uri'),
  notes: text('notes'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  altPhone: text('alt_phone'),
  businessName: text('business_name'),
  address: text('address'),
  gstNumber: text('gst_number'),
  outstandingBalance: doublePrecision('outstanding_balance').notNull().default(0.0),
  purchasedScaleName: text('purchased_scale_name'),
  model: text('model'),
  sellingPrice: doublePrecision('selling_price'),
  gstCharged: doublePrecision('gst_charged'),
  photoUri: text('photo_uri'),
  notes: text('notes'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'sale' | 'purchase' | 'return_in' | 'return_out'
  customerId: text('customer_id').references(() => customers.id),
  supplierName: text('supplier_name'),
  subtotal: doublePrecision('subtotal').notNull(),
  discount: doublePrecision('discount').notNull().default(0.0),
  taxAmount: doublePrecision('tax_amount').notNull().default(0.0),
  grandTotal: doublePrecision('grand_total').notNull(),
  amountPaid: doublePrecision('amount_paid').notNull().default(0.0),
  paymentMode: text('payment_mode'),
  paymentStatus: text('payment_status').notNull(),
  createdByStaffId: text('created_by_staff_id'),
  notes: text('notes'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const transactionItems = pgTable('transaction_items', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => transactions.id),
  stockItemId: text('stock_item_id').notNull().references(() => stockItems.id),
  quantity: integer('quantity').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  lineTotal: doublePrecision('line_total').notNull(),
});

export const deletedRecords = pgTable('deleted_records', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'transaction'
  deletedAt: bigint('deleted_at', { mode: 'number' }).notNull(),
});

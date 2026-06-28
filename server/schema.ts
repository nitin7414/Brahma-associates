import { pgTable, text, integer, doublePrecision, bigint, index } from 'drizzle-orm/pg-core';

export const staffUsers = pgTable('staff_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'owner' | 'staff'
  pinHash: text('pin_hash').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (table) => ({
  updatedAtIdx: index('staff_users_updated_at_idx').on(table.updatedAt),
}));

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
}, (table) => ({
  updatedAtIdx: index('stock_items_updated_at_idx').on(table.updatedAt),
}));

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
}, (table) => ({
  updatedAtIdx: index('customers_updated_at_idx').on(table.updatedAt),
}));

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
}, (table) => ({
  createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
  customerIdIdx: index('transactions_customer_id_idx').on(table.customerId),
}));

export const transactionItems = pgTable('transaction_items', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => transactions.id),
  stockItemId: text('stock_item_id').notNull().references(() => stockItems.id),
  quantity: integer('quantity').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  lineTotal: doublePrecision('line_total').notNull(),
}, (table) => ({
  transactionIdIdx: index('transaction_items_transaction_id_idx').on(table.transactionId),
  stockItemIdIdx: index('transaction_items_stock_item_id_idx').on(table.stockItemId),
}));

export const deletedRecords = pgTable('deleted_records', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'transaction'
  deletedAt: bigint('deleted_at', { mode: 'number' }).notNull(),
}, (table) => ({
  deletedAtIdx: index('deleted_records_deleted_at_idx').on(table.deletedAt),
}));

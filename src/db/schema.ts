import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const stockItems = sqliteTable('stock_items', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // 'scale' | 'loadcell' | 'pcb' | 'display' | 'spare_part'
  brand: text('brand'),                  // 'ASK' | 'Essae' | 'MIC' | null
  name: text('name').notNull(),          // e.g. "ASK Scale 50kg", "Loadcell 40kg Short"
  capacityLabel: text('capacity_label'), // e.g. "50", "7.5-15" — kept as string to support ranges
  variant: text('variant'),              // e.g. "Large", "Short", "Red", "Dual Range"
  quantity: integer('quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  costPrice: real('cost_price'),
  sellingPrice: real('selling_price'),
  photoUri: text('photo_uri'),
  notes: text('notes'),
  isActive: integer('is_active').notNull().default(1),
  isSynced: integer('is_synced').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  altPhone: text('alt_phone'),
  businessName: text('business_name'),
  address: text('address'),
  gstNumber: text('gst_number'),
  outstandingBalance: real('outstanding_balance').notNull().default(0.0),
  purchasedScaleName: text('purchased_scale_name'),
  model: text('model'),
  sellingPrice: real('selling_price'),
  gstCharged: real('gst_charged'),
  photoUri: text('photo_uri'),
  notes: text('notes'),
  isActive: integer('is_active').notNull().default(1),
  isSynced: integer('is_synced').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'sale' | 'purchase' | 'return_in' | 'return_out'
  customerId: text('customer_id').references(() => customers.id),
  supplierName: text('supplier_name'), // free text, used only for 'purchase' type
  subtotal: real('subtotal').notNull(),
  discount: real('discount').notNull().default(0.0),
  taxAmount: real('tax_amount').notNull().default(0.0),
  grandTotal: real('grand_total').notNull(),
  amountPaid: real('amount_paid').notNull().default(0.0),
  paymentMode: text('payment_mode'),     // 'cash' | 'upi' | 'bank' | 'credit'
  paymentStatus: text('payment_status').notNull(), // 'paid' | 'partial' | 'pending'
  createdByStaffId: text('created_by_staff_id'),
  notes: text('notes'),
  isSynced: integer('is_synced').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const transactionItems = sqliteTable('transaction_items', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => transactions.id),
  stockItemId: text('stock_item_id').notNull().references(() => stockItems.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  lineTotal: real('line_total').notNull(),
});

export const staffUsers = sqliteTable('staff_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'owner' | 'staff'
  pinHash: text('pin_hash').notNull(),
  isActive: integer('is_active').notNull().default(1),
  isSynced: integer('is_synced').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const deletedRecords = sqliteTable('deleted_records', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'transaction'
  deletedAt: integer('deleted_at').notNull(),
});

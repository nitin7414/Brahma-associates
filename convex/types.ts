import { v } from "convex/values";

// Validator for Staff Users
export const staffUserValidator = v.object({
  id: v.string(),
  name: v.string(),
  role: v.string(),
  pinHash: v.string(),
  isActive: v.float64(),
  createdAt: v.float64(),
  updatedAt: v.float64(),
  isSynced: v.optional(v.union(v.float64(), v.boolean(), v.null())),
});

// Validator for Stock Items
export const stockItemValidator = v.object({
  id: v.string(),
  category: v.string(),
  brand: v.union(v.string(), v.null()),
  name: v.string(),
  capacityLabel: v.union(v.string(), v.null()),
  variant: v.union(v.string(), v.null()),
  quantity: v.float64(),
  lowStockThreshold: v.float64(),
  costPrice: v.union(v.float64(), v.null()),
  sellingPrice: v.union(v.float64(), v.null()),
  photoUri: v.union(v.string(), v.null()),
  notes: v.union(v.string(), v.null()),
  isActive: v.float64(),
  createdAt: v.float64(),
  updatedAt: v.float64(),
  isSynced: v.optional(v.union(v.float64(), v.boolean(), v.null())),
});

// Validator for Customers
export const customerValidator = v.object({
  id: v.string(),
  name: v.string(),
  phone: v.union(v.string(), v.null()),
  altPhone: v.union(v.string(), v.null()),
  businessName: v.union(v.string(), v.null()),
  address: v.union(v.string(), v.null()),
  gstNumber: v.union(v.string(), v.null()),
  outstandingBalance: v.float64(),
  purchasedScaleName: v.union(v.string(), v.null()),
  model: v.union(v.string(), v.null()),
  sellingPrice: v.union(v.float64(), v.null()),
  gstCharged: v.union(v.float64(), v.null()),
  photoUri: v.union(v.string(), v.null()),
  notes: v.union(v.string(), v.null()),
  isActive: v.float64(),
  createdAt: v.float64(),
  updatedAt: v.float64(),
  isSynced: v.optional(v.union(v.float64(), v.boolean(), v.null())),
});

// Validator for Transaction Items
export const transactionItemValidator = v.object({
  id: v.string(),
  transactionId: v.string(),
  stockItemId: v.string(),
  quantity: v.float64(),
  unitPrice: v.float64(),
  lineTotal: v.float64(),
  isSynced: v.optional(v.union(v.float64(), v.boolean(), v.null())),
});

// Validator for Transactions
export const transactionValidator = v.object({
  id: v.string(),
  type: v.string(),
  customerId: v.union(v.string(), v.null()),
  supplierName: v.union(v.string(), v.null()),
  subtotal: v.float64(),
  discount: v.float64(),
  taxAmount: v.float64(),
  grandTotal: v.float64(),
  amountPaid: v.float64(),
  paymentMode: v.union(v.string(), v.null()),
  paymentStatus: v.string(),
  createdByStaffId: v.union(v.string(), v.null()),
  notes: v.union(v.string(), v.null()),
  createdAt: v.float64(),
  items: v.optional(v.array(transactionItemValidator)),
  isSynced: v.optional(v.union(v.float64(), v.boolean(), v.null())),
});

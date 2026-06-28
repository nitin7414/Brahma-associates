import { query, mutation } from "./_generated/server";
import { transactionValidator } from "./types";

// List all transactions including their items
export const list = query({
  args: {},
  handler: async (ctx) => {
    const txs = await ctx.db.query("transactions").collect();
    const result = [];
    for (const t of txs) {
      const items = await ctx.db
        .query("transaction_items")
        .withIndex("by_transactionId", (q) => q.eq("transactionId", t.id))
        .collect();
      result.push({
        ...t,
        items: items.map((item) => ({
          id: item.id,
          transactionId: item.transactionId,
          stockItemId: item.stockItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      });
    }
    return result;
  },
});

// Insert a transaction ledger record and its items (write once)
export const insert = mutation({
  args: transactionValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_client_id", (q) => q.eq("id", args.id))
      .unique();

    if (!existing) {
      await ctx.db.insert("transactions", {
        id: args.id,
        type: args.type,
        customerId: args.customerId,
        supplierName: args.supplierName,
        subtotal: args.subtotal,
        discount: args.discount,
        taxAmount: args.taxAmount,
        grandTotal: args.grandTotal,
        amountPaid: args.amountPaid,
        paymentMode: args.paymentMode,
        paymentStatus: args.paymentStatus,
        createdByStaffId: args.createdByStaffId,
        notes: args.notes,
        createdAt: args.createdAt,
      });

      if (args.items) {
        for (const item of args.items) {
          const existingItem = await ctx.db
            .query("transaction_items")
            .withIndex("by_client_id", (q) => q.eq("id", item.id))
            .unique();

          if (!existingItem) {
            await ctx.db.insert("transaction_items", {
              id: item.id,
              transactionId: item.transactionId,
              stockItemId: item.stockItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            });
          }
        }
      }
    }
  },
});

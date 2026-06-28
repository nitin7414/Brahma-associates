import { query, mutation } from "./_generated/server";
import { stockItemValidator } from "./types";

// List all stock items
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stock_items").collect();
  },
});

// Upsert a stock item (insert or patch based on clientId)
export const upsert = mutation({
  args: stockItemValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stock_items")
      .withIndex("by_client_id", (q) => q.eq("id", args.id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        category: args.category,
        brand: args.brand,
        name: args.name,
        capacityLabel: args.capacityLabel,
        variant: args.variant,
        quantity: args.quantity,
        lowStockThreshold: args.lowStockThreshold,
        costPrice: args.costPrice,
        sellingPrice: args.sellingPrice,
        photoUri: args.photoUri,
        notes: args.notes,
        isActive: args.isActive,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("stock_items", {
        id: args.id,
        category: args.category,
        brand: args.brand,
        name: args.name,
        capacityLabel: args.capacityLabel,
        variant: args.variant,
        quantity: args.quantity,
        lowStockThreshold: args.lowStockThreshold,
        costPrice: args.costPrice,
        sellingPrice: args.sellingPrice,
        photoUri: args.photoUri,
        notes: args.notes,
        isActive: args.isActive,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
      });
    }
  },
});

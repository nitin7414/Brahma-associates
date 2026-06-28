import { stockItems } from './schema';

interface CatalogItem {
  category: 'scale' | 'loadcell' | 'pcb' | 'display' | 'spare_part';
  brand: 'ASK' | 'Essae' | 'MIC' | null;
  capacityLabel: string | null;
  variant: string | null;
  name: string;
}

const catalog: CatalogItem[] = [
  // Scales
  { category: 'scale', brand: 'ASK', capacityLabel: '15 Kg', variant: null, name: 'ASK Scale 15 Kg' },
  { category: 'scale', brand: 'ASK', capacityLabel: '30 Kg', variant: null, name: 'ASK Scale 30 Kg' },
  { category: 'scale', brand: 'ASK', capacityLabel: '50 Kg', variant: null, name: 'ASK Scale 50 Kg' },
  { category: 'scale', brand: 'ASK', capacityLabel: '100 Kg', variant: null, name: 'ASK Scale 100 Kg' },
  { category: 'scale', brand: 'ASK', capacityLabel: '150 Kg', variant: null, name: 'ASK Scale 150 Kg' },
  { category: 'scale', brand: 'ASK', capacityLabel: '300 Kg', variant: null, name: 'ASK Scale 300 Kg' },
  { category: 'scale', brand: 'ASK', capacityLabel: '500 Kg', variant: null, name: 'ASK Scale 500 Kg' },
  { category: 'scale', brand: 'Essae', capacityLabel: '7.5-15 Kg', variant: 'Dual Range', name: 'Essae Scale 7.5-15 Kg Dual Range' },
  { category: 'scale', brand: 'Essae', capacityLabel: '15-30 Kg', variant: 'Dual Range', name: 'Essae Scale 15-30 Kg Dual Range' },
  { category: 'scale', brand: 'Essae', capacityLabel: '50 Kg', variant: null, name: 'Essae Scale 50 Kg' },
  { category: 'scale', brand: 'Essae', capacityLabel: '100 Kg', variant: null, name: 'Essae Scale 100 Kg' },
  { category: 'scale', brand: 'Essae', capacityLabel: '150 Kg', variant: null, name: 'Essae Scale 150 Kg' },
  { category: 'scale', brand: 'Essae', capacityLabel: '200 Kg', variant: null, name: 'Essae Scale 200 Kg' },
  { category: 'scale', brand: 'Essae', capacityLabel: '15 Kg', variant: 'Single Range', name: 'Essae Scale 15 Kg Single Range' },

  // Load Cells
  { category: 'loadcell', brand: null, capacityLabel: '20 Kg', variant: 'Large', name: 'Loadcell 20 Kg Large' },
  { category: 'loadcell', brand: null, capacityLabel: '20 Kg', variant: 'Short', name: 'Loadcell 20 Kg Short' },
  { category: 'loadcell', brand: null, capacityLabel: '40 Kg', variant: 'Large', name: 'Loadcell 40 Kg Large' },
  { category: 'loadcell', brand: null, capacityLabel: '40 Kg', variant: 'Short', name: 'Loadcell 40 Kg Short' },
  { category: 'loadcell', brand: null, capacityLabel: '150 Kg', variant: null, name: 'Loadcell 150 Kg' },
  { category: 'loadcell', brand: null, capacityLabel: '200 Kg', variant: null, name: 'Loadcell 200 Kg' },
  { category: 'loadcell', brand: null, capacityLabel: '300 Kg', variant: null, name: 'Loadcell 300 Kg' },
  { category: 'loadcell', brand: null, capacityLabel: '500 Kg', variant: null, name: 'Loadcell 500 Kg' },
  { category: 'loadcell', brand: null, capacityLabel: '1000 Kg', variant: null, name: 'Loadcell 1000 Kg' },

  // PCBs
  { category: 'pcb', brand: 'ASK', capacityLabel: null, variant: null, name: 'ASK PCB' },
  { category: 'pcb', brand: 'MIC', capacityLabel: null, variant: null, name: 'MIC PCB' },

  // Displays
  { category: 'display', brand: 'ASK', capacityLabel: null, variant: 'Red', name: 'ASK Display Red' },
  { category: 'display', brand: 'ASK', capacityLabel: null, variant: 'Green', name: 'ASK Display Green' },
  { category: 'display', brand: 'MIC', capacityLabel: null, variant: 'Red', name: 'MIC Display Red' },
  { category: 'display', brand: 'MIC', capacityLabel: null, variant: 'Green', name: 'MIC Display Green' },

  // Spare Parts
  { category: 'spare_part', brand: null, capacityLabel: null, variant: 'Battery', name: 'Spare Part Battery' },
  { category: 'spare_part', brand: null, capacityLabel: null, variant: 'Main Lead Cord', name: 'Spare Part Main Lead Cord' },
  { category: 'spare_part', brand: null, capacityLabel: null, variant: 'Connector Switch', name: 'Spare Part Connector Switch' },
  { category: 'spare_part', brand: null, capacityLabel: null, variant: 'Transformer', name: 'Spare Part Transformer' },
];

export async function seedInitialCatalog(db: any) {
  const now = Date.now();
  const valuesToInsert = catalog.map((item) => {
    // Generate clean deterministic slug ID
    const parts = [
      item.category,
      item.brand || 'none',
      item.capacityLabel || 'none',
      item.variant || 'none',
    ];
    const id = parts
      .join('_')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_');

    // Default low stock threshold: 10 for small spare parts, 5 for heavier items (scales, loadcells, PCBs, displays)
    const threshold = item.category === 'spare_part' ? 10 : 5;

    return {
      id,
      category: item.category,
      brand: item.brand,
      name: item.name,
      capacityLabel: item.capacityLabel,
      variant: item.variant,
      quantity: 0,
      lowStockThreshold: threshold,
      costPrice: 0.0,
      sellingPrice: 0.0,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Bulk insert stock items using drizzle insert
  await db.insert(stockItems).values(valuesToInsert);
}

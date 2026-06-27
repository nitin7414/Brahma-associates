export type UserRole = 'owner' | 'staff';

export type AppAction =
  | 'view_catalog'
  | 'view_customers'
  | 'view_transactions'
  | 'add_stock'
  | 'edit_stock_qty_photo'
  | 'edit_stock_prices_details'
  | 'delete_stock'
  | 'add_edit_customer'
  | 'delete_customer'
  | 'create_transaction'
  | 'void_transaction'
  | 'view_revenue_widgets'
  | 'view_reports'
  | 'manage_staff'
  | 'backup_restore'
  | 'app_settings';

const permissionsMatrix: Record<UserRole, Record<AppAction, boolean>> = {
  owner: {
    view_catalog: true,
    view_customers: true,
    view_transactions: true,
    add_stock: true,
    edit_stock_qty_photo: true,
    edit_stock_prices_details: true,
    delete_stock: true,
    add_edit_customer: true,
    delete_customer: true,
    create_transaction: true,
    void_transaction: true,
    view_revenue_widgets: true,
    view_reports: true,
    manage_staff: true,
    backup_restore: true,
    app_settings: true,
  },
  staff: {
    view_catalog: true,
    view_customers: true,
    view_transactions: true,
    add_stock: true,
    edit_stock_qty_photo: true,
    edit_stock_prices_details: false, // staff can't edit cost/selling prices, thresholds
    delete_stock: false,
    add_edit_customer: true,
    delete_customer: false,
    create_transaction: true,
    void_transaction: false,
    view_revenue_widgets: false,
    view_reports: false,
    manage_staff: false,
    backup_restore: false,
    app_settings: false,
  },
};

/**
 * Returns true if the user's role has permission to perform the action.
 */
export function hasPermission(role: UserRole | undefined | null, action: AppAction): boolean {
  if (!role) return false;
  return permissionsMatrix[role]?.[action] ?? false;
}

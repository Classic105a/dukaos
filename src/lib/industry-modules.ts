/**
 * DukaOS industry module registry.
 *
 * The platform core is industry-agnostic. Each industry simply enables a set of
 * modules; adding a new industry means adding an entry here — never touching
 * core code. Per-business overrides live in the `business_modules` table.
 */

export type ModuleKey =
  | 'pos'
  | 'inventory'
  | 'warehouse'
  | 'purchasing'
  | 'suppliers'
  | 'customers'
  | 'credit'
  | 'promotions'
  | 'forecasting'
  | 'expiry_tracking'
  | 'batch_tracking'
  | 'prescriptions'
  | 'tables_orders'
  | 'kitchen_display'
  | 'appointments'
  | 'rooms'
  | 'services'
  | 'reports'
  | 'accounting'
  | 'ai_assistant';

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
  /** Core modules cannot be disabled by a business. */
  core?: boolean;
}

export const MODULE_CATALOG: Record<ModuleKey, ModuleDefinition> = {
  pos: { key: 'pos', label: 'Point of Sale', description: 'Checkout, receipts and payments', core: true },
  inventory: { key: 'inventory', label: 'Inventory', description: 'Products, stock levels and movements', core: true },
  reports: { key: 'reports', label: 'Reports', description: 'Sales, profit and tax reporting', core: true },
  customers: { key: 'customers', label: 'Customers', description: 'Customer directory and loyalty' },
  credit: { key: 'credit', label: 'Customer Credit', description: 'Debt, installments and recovery' },
  suppliers: { key: 'suppliers', label: 'Suppliers', description: 'Supplier directory and payables' },
  purchasing: { key: 'purchasing', label: 'Purchasing', description: 'Purchase orders and goods received' },
  warehouse: { key: 'warehouse', label: 'Warehouse', description: 'Multi-warehouse stock control' },
  promotions: { key: 'promotions', label: 'Promotions', description: 'Discounts, BOGO and bulk pricing' },
  forecasting: { key: 'forecasting', label: 'Forecasting', description: 'Reorder points and dead stock' },
  expiry_tracking: { key: 'expiry_tracking', label: 'Expiry Tracking', description: 'Shelf-life and expiry alerts' },
  batch_tracking: { key: 'batch_tracking', label: 'Batch Tracking', description: 'Lot and batch traceability' },
  prescriptions: { key: 'prescriptions', label: 'Prescriptions', description: 'Dispensing and prescription records' },
  tables_orders: { key: 'tables_orders', label: 'Tables & Orders', description: 'Table service and open orders' },
  kitchen_display: { key: 'kitchen_display', label: 'Kitchen Display', description: 'Order routing to the kitchen' },
  appointments: { key: 'appointments', label: 'Appointments', description: 'Bookings and staff scheduling' },
  rooms: { key: 'rooms', label: 'Rooms', description: 'Room inventory and stays' },
  services: { key: 'services', label: 'Services', description: 'Non-stock service line items' },
  accounting: { key: 'accounting', label: 'Accounting', description: 'Expenses and financial statements' },
  ai_assistant: { key: 'ai_assistant', label: 'AI Assistant', description: 'Insights, summaries and predictions' },
};

export const CORE_MODULES: ModuleKey[] = (Object.values(MODULE_CATALOG) as ModuleDefinition[])
  .filter(m => m.core)
  .map(m => m.key);

export interface IndustryDefinition {
  key: string;
  label: string;
  modules: ModuleKey[];
}

const base: ModuleKey[] = ['pos', 'inventory', 'reports', 'customers'];

export const INDUSTRIES: IndustryDefinition[] = [
  { key: 'retail', label: 'Retail Shop', modules: [...base, 'suppliers', 'purchasing', 'credit'] },
  { key: 'mini_market', label: 'Mini Market', modules: [...base, 'suppliers', 'purchasing', 'promotions', 'expiry_tracking'] },
  { key: 'supermarket', label: 'Supermarket', modules: [...base, 'suppliers', 'purchasing', 'warehouse', 'promotions', 'forecasting', 'expiry_tracking'] },
  { key: 'electronics', label: 'Electronics', modules: [...base, 'suppliers', 'purchasing', 'credit', 'services'] },
  { key: 'hardware', label: 'Hardware', modules: [...base, 'suppliers', 'purchasing', 'warehouse', 'credit'] },
  { key: 'pharmacy', label: 'Pharmacy', modules: [...base, 'suppliers', 'purchasing', 'expiry_tracking', 'batch_tracking', 'prescriptions'] },
  { key: 'restaurant', label: 'Restaurant', modules: [...base, 'tables_orders', 'kitchen_display', 'suppliers', 'expiry_tracking'] },
  { key: 'bar', label: 'Bar', modules: [...base, 'tables_orders', 'suppliers', 'promotions'] },
  { key: 'hotel', label: 'Hotel', modules: [...base, 'rooms', 'tables_orders', 'services', 'suppliers'] },
  { key: 'salon', label: 'Salon', modules: [...base, 'appointments', 'services'] },
  { key: 'spa', label: 'Spa', modules: [...base, 'appointments', 'services'] },
  { key: 'clinic', label: 'Clinic', modules: [...base, 'appointments', 'services', 'prescriptions'] },
  { key: 'bakery', label: 'Bakery', modules: [...base, 'expiry_tracking', 'suppliers', 'purchasing'] },
  { key: 'wholesale', label: 'Wholesale', modules: [...base, 'suppliers', 'purchasing', 'warehouse', 'credit', 'forecasting'] },
  { key: 'fashion', label: 'Fashion', modules: [...base, 'suppliers', 'purchasing', 'promotions'] },
  { key: 'agrovet', label: 'Agrovet', modules: [...base, 'suppliers', 'purchasing', 'expiry_tracking', 'batch_tracking', 'credit'] },
  { key: 'service', label: 'Service Business', modules: [...base, 'services', 'appointments', 'credit'] },
];

export const getIndustry = (key: string | null | undefined): IndustryDefinition =>
  INDUSTRIES.find(i => i.key === key) ?? INDUSTRIES[0];

export const defaultModulesForIndustry = (key: string | null | undefined): ModuleKey[] =>
  Array.from(new Set([...CORE_MODULES, ...getIndustry(key).modules]));
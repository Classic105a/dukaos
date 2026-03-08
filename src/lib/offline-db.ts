import Dexie, { type Table } from 'dexie';

// ─── Local cached data types ───────────────────────────────────────

export interface LocalProduct {
  id: string;
  name: string;
  barcode: string | null;
  unit_price: number;
  cost_price: number | null;
  image_url: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  branch_id: string | null;
  is_shared_product: boolean;
  is_active: boolean;
  tax_rate: number | null;
  sku: string | null;
  unit_of_measure: string | null;
  track_inventory: boolean;
  low_stock_threshold: number | null;
  _synced_at: number; // timestamp of last server sync
}

export interface LocalStock {
  id: string; // composite: `${product_id}_${branch_id}`
  product_id: string;
  branch_id: string;
  quantity: number;
  _synced_at: number;
}

export interface LocalCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  credit_enabled: boolean;
  credit_limit: number;
  credit_balance: number;
  segment: string | null;
  _synced_at: number;
}

export interface LocalCategory {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  _synced_at: number;
}

export interface LocalSettings {
  key: string; // e.g. 'tax_settings', 'receipt_settings', 'branch_info'
  value: any;
  branch_id: string;
  _synced_at: number;
}

// ─── Sync Queue types ──────────────────────────────────────────────

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncQueueItem {
  id?: number; // auto-incremented
  entity_type: 'sale' | 'payment' | 'stock_movement' | 'credit_transaction' | 'customer_update';
  entity_id: string; // local reference ID
  payload: any; // the full data to send
  status: SyncStatus;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
  branch_id: string;
  user_id: string;
}

// ─── Offline Transactions (complete sale records) ──────────────────

export interface LocalTransaction {
  id: string; // offline receipt ID
  branch_id: string;
  cashier_id: string;
  receipt_number: string;
  customer_id: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }>;
  payments: Array<{
    payment_method: string;
    amount: number;
    mpesa_reference?: string;
    mpesa_phone?: string;
    customer_id?: string;
  }>;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  shift_id: string | null;
  status: 'completed' | 'voided';
  is_synced: boolean;
  server_id: string | null; // filled after sync
  created_at: string;
  synced_at: string | null;
}

// ─── Dexie Database ────────────────────────────────────────────────

class OfflineDatabase extends Dexie {
  products!: Table<LocalProduct, string>;
  stock!: Table<LocalStock, string>;
  customers!: Table<LocalCustomer, string>;
  categories!: Table<LocalCategory, string>;
  settings!: Table<LocalSettings, string>;
  transactions!: Table<LocalTransaction, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('DukaOS_OfflineDB');

    this.version(1).stores({
      products: 'id, name, barcode, category_id, branch_id, is_shared_product, _synced_at',
      stock: 'id, product_id, branch_id, _synced_at',
      customers: 'id, name, phone, credit_enabled, _synced_at',
      categories: 'id, name, is_active, _synced_at',
      settings: 'key, branch_id, _synced_at',
      transactions: 'id, branch_id, receipt_number, is_synced, created_at, status',
      syncQueue: '++id, entity_type, entity_id, status, created_at, branch_id',
    });
  }
}

export const offlineDB = new OfflineDatabase();

// ─── Helper utilities ──────────────────────────────────────────────

/** Bulk upsert products into local cache */
export async function cacheProducts(products: LocalProduct[]) {
  await offlineDB.products.bulkPut(products);
}

/** Bulk upsert stock data */
export async function cacheStock(stockItems: LocalStock[]) {
  await offlineDB.stock.bulkPut(stockItems);
}

/** Bulk upsert customers */
export async function cacheCustomers(customers: LocalCustomer[]) {
  await offlineDB.customers.bulkPut(customers);
}

/** Bulk upsert categories */
export async function cacheCategories(categories: LocalCategory[]) {
  await offlineDB.categories.bulkPut(categories);
}

/** Get products for a branch (includes shared) */
export async function getLocalProducts(branchId: string): Promise<LocalProduct[]> {
  return offlineDB.products
    .filter(p => p.is_active && (p.branch_id === branchId || p.is_shared_product))
    .toArray();
}

/** Get stock for a branch */
export async function getLocalStock(branchId: string): Promise<Map<string, number>> {
  const items = await offlineDB.stock.where('branch_id').equals(branchId).toArray();
  return new Map(items.map(s => [s.product_id, s.quantity]));
}

/** Get local categories */
export async function getLocalCategories(): Promise<LocalCategory[]> {
  return offlineDB.categories.where('is_active').equals(1).toArray();
}

/** Get local customers */
export async function getLocalCustomers(): Promise<LocalCustomer[]> {
  return offlineDB.customers.toArray();
}

/** Save a transaction locally */
export async function saveLocalTransaction(tx: LocalTransaction) {
  await offlineDB.transactions.put(tx);
}

/** Get unsynced transactions */
export async function getUnsyncedTransactions(): Promise<LocalTransaction[]> {
  return offlineDB.transactions.where('is_synced').equals(0).toArray();
}

/** Mark transaction as synced */
export async function markTransactionSynced(localId: string, serverId: string) {
  await offlineDB.transactions.update(localId, {
    is_synced: true,
    server_id: serverId,
    synced_at: new Date().toISOString(),
  });
}

/** Add item to sync queue */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>) {
  await offlineDB.syncQueue.add(item);
}

/** Get pending sync queue items */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return offlineDB.syncQueue
    .where('status')
    .anyOf('pending', 'failed')
    .filter(item => item.retry_count < item.max_retries)
    .sortBy('created_at');
}

/** Update sync queue item status */
export async function updateSyncQueueItem(id: number, updates: Partial<SyncQueueItem>) {
  await offlineDB.syncQueue.update(id, { ...updates, updated_at: Date.now() });
}

/** Get sync queue stats */
export async function getSyncQueueStats() {
  const all = await offlineDB.syncQueue.toArray();
  return {
    pending: all.filter(i => i.status === 'pending').length,
    syncing: all.filter(i => i.status === 'syncing').length,
    synced: all.filter(i => i.status === 'synced').length,
    failed: all.filter(i => i.status === 'failed' && i.retry_count >= i.max_retries).length,
    retryable: all.filter(i => i.status === 'failed' && i.retry_count < i.max_retries).length,
    total: all.length,
  };
}

/** Deduct stock locally after an offline sale */
export async function deductLocalStock(branchId: string, items: Array<{ product_id: string; quantity: number }>) {
  for (const item of items) {
    const key = `${item.product_id}_${branchId}`;
    const existing = await offlineDB.stock.get(key);
    if (existing) {
      await offlineDB.stock.update(key, {
        quantity: Math.max(0, existing.quantity - item.quantity),
      });
    }
  }
}

/** Clean up old synced queue items (older than 7 days) */
export async function cleanupSyncQueue() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await offlineDB.syncQueue
    .where('status')
    .equals('synced')
    .filter(item => item.synced_at !== null && item.synced_at < cutoff)
    .delete();
}

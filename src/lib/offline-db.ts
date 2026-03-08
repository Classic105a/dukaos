import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ─── Database Schema ───────────────────────────────────────────────

interface DukaOSDB extends DBSchema {
  products: {
    key: string;
    value: LocalProduct;
    indexes: {
      'by-branch': string;
      'by-category': string;
      'by-barcode': string;
    };
  };
  stock: {
    key: string;
    value: LocalStock;
    indexes: {
      'by-branch': string;
    };
  };
  customers: {
    key: string;
    value: LocalCustomer;
    indexes: {
      'by-name': string;
    };
  };
  categories: {
    key: string;
    value: LocalCategory;
  };
  settings: {
    key: string;
    value: LocalSettings;
  };
  transactions: {
    key: string;
    value: LocalTransaction;
    indexes: {
      'by-synced': number;
      'by-branch': string;
    };
  };
  syncQueue: {
    key: number;
    value: SyncQueueItem;
    indexes: {
      'by-status': string;
      'by-entity': string;
    };
  };
}

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
  _synced_at: number;
}

export interface LocalStock {
  id: string;
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
  key: string;
  value: any;
  branch_id: string;
  _synced_at: number;
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncQueueItem {
  id?: number;
  entity_type: 'sale' | 'payment' | 'stock_movement' | 'credit_transaction' | 'customer_update';
  entity_id: string;
  payload: any;
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

export interface LocalTransaction {
  id: string;
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
  server_id: string | null;
  created_at: string;
  synced_at: string | null;
}

// ─── Database initialization ───────────────────────────────────────

let dbInstance: IDBPDatabase<DukaOSDB> | null = null;

async function getDB(): Promise<IDBPDatabase<DukaOSDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DukaOSDB>('DukaOS_OfflineDB', 1, {
    upgrade(db) {
      // Products store
      const productStore = db.createObjectStore('products', { keyPath: 'id' });
      productStore.createIndex('by-branch', 'branch_id');
      productStore.createIndex('by-category', 'category_id');
      productStore.createIndex('by-barcode', 'barcode');

      // Stock store
      const stockStore = db.createObjectStore('stock', { keyPath: 'id' });
      stockStore.createIndex('by-branch', 'branch_id');

      // Customers store
      const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
      customerStore.createIndex('by-name', 'name');

      // Categories store
      db.createObjectStore('categories', { keyPath: 'id' });

      // Settings store
      db.createObjectStore('settings', { keyPath: 'key' });

      // Transactions store
      const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
      txStore.createIndex('by-synced', 'is_synced' as any);
      txStore.createIndex('by-branch', 'branch_id');

      // Sync queue
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      syncStore.createIndex('by-status', 'status');
      syncStore.createIndex('by-entity', 'entity_id');
    },
  });

  return dbInstance;
}

// ─── Helper functions ──────────────────────────────────────────────

export async function cacheProducts(products: LocalProduct[]) {
  const db = await getDB();
  const tx = db.transaction('products', 'readwrite');
  for (const p of products) {
    await tx.store.put(p);
  }
  await tx.done;
}

export async function cacheStock(stockItems: LocalStock[]) {
  const db = await getDB();
  const tx = db.transaction('stock', 'readwrite');
  for (const s of stockItems) {
    await tx.store.put(s);
  }
  await tx.done;
}

export async function cacheCustomers(customers: LocalCustomer[]) {
  const db = await getDB();
  const tx = db.transaction('customers', 'readwrite');
  for (const c of customers) {
    await tx.store.put(c);
  }
  await tx.done;
}

export async function cacheCategories(categories: LocalCategory[]) {
  const db = await getDB();
  const tx = db.transaction('categories', 'readwrite');
  for (const c of categories) {
    await tx.store.put(c);
  }
  await tx.done;
}

export async function getLocalProducts(branchId: string): Promise<LocalProduct[]> {
  const db = await getDB();
  const all = await db.getAll('products');
  return all.filter(p => p.is_active && (p.branch_id === branchId || p.is_shared_product));
}

export async function getLocalStock(branchId: string): Promise<Map<string, number>> {
  const db = await getDB();
  const items = await db.getAllFromIndex('stock', 'by-branch', branchId);
  return new Map(items.map(s => [s.product_id, s.quantity]));
}

export async function getLocalCategories(): Promise<LocalCategory[]> {
  const db = await getDB();
  const all = await db.getAll('categories');
  return all.filter(c => c.is_active);
}

export async function getLocalCustomers(): Promise<LocalCustomer[]> {
  const db = await getDB();
  return db.getAll('customers');
}

export async function saveLocalTransaction(tx: LocalTransaction) {
  const db = await getDB();
  await db.put('transactions', tx);
}

export async function getUnsyncedTransactions(): Promise<LocalTransaction[]> {
  const db = await getDB();
  const all = await db.getAll('transactions');
  return all.filter(t => !t.is_synced);
}

export async function markTransactionSynced(localId: string, serverId: string) {
  const db = await getDB();
  const tx = await db.get('transactions', localId);
  if (tx) {
    tx.is_synced = true;
    tx.server_id = serverId;
    tx.synced_at = new Date().toISOString();
    await db.put('transactions', tx);
  }
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>) {
  const db = await getDB();
  await db.add('syncQueue', item as SyncQueueItem);
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  const all = await db.getAll('syncQueue');
  return all
    .filter(item => (item.status === 'pending' || item.status === 'failed') && item.retry_count < item.max_retries)
    .sort((a, b) => a.created_at - b.created_at);
}

export async function updateSyncQueueItem(id: number, updates: Partial<SyncQueueItem>) {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    Object.assign(item, updates, { updated_at: Date.now() });
    await db.put('syncQueue', item);
  }
}

export async function getSyncQueueStats() {
  const db = await getDB();
  const all = await db.getAll('syncQueue');
  return {
    pending: all.filter(i => i.status === 'pending').length,
    syncing: all.filter(i => i.status === 'syncing').length,
    synced: all.filter(i => i.status === 'synced').length,
    failed: all.filter(i => i.status === 'failed' && i.retry_count >= i.max_retries).length,
    retryable: all.filter(i => i.status === 'failed' && i.retry_count < i.max_retries).length,
    total: all.length,
  };
}

export async function deductLocalStock(branchId: string, items: Array<{ product_id: string; quantity: number }>) {
  const db = await getDB();
  const tx = db.transaction('stock', 'readwrite');
  for (const item of items) {
    const key = `${item.product_id}_${branchId}`;
    const existing = await tx.store.get(key);
    if (existing) {
      existing.quantity = Math.max(0, existing.quantity - item.quantity);
      await tx.store.put(existing);
    }
  }
  await tx.done;
}

export async function cleanupSyncQueue() {
  const db = await getDB();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const all = await db.getAll('syncQueue');
  const tx = db.transaction('syncQueue', 'readwrite');
  for (const item of all) {
    if (item.status === 'synced' && item.synced_at !== null && item.synced_at < cutoff) {
      await tx.store.delete(item.id!);
    }
  }
  await tx.done;
}

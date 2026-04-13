/**
 * SQLite Durable Storage Layer
 * Source of truth for: sales, sale_items, payments, sync queue.
 * IndexedDB remains the UI cache for products/categories/customers.
 */

import { isNativeApp } from '@/lib/escpos';

// ─── Types ─────────────────────────────────────────────────────────

export interface SQLiteTransaction {
  id: string;
  branch_id: string;
  cashier_id: string;
  receipt_number: string;
  customer_id: string | null;
  shift_id: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: 'completed' | 'voided';
  is_synced: number; // 0 or 1 (SQLite has no boolean)
  server_id: string | null;
  created_at: string;
  synced_at: string | null;
  offline_id: string;
}

export interface SQLiteSaleItem {
  id: string;
  transaction_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

export interface SQLitePayment {
  id: string;
  transaction_id: string;
  payment_method: string;
  amount: number;
  mpesa_reference: string | null;
  mpesa_phone: string | null;
}

export interface SQLiteSyncQueueItem {
  id: number;
  entity_type: string;
  entity_id: string;
  status: string; // pending | syncing | synced | failed
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
  branch_id: string;
  user_id: string;
}

// ─── Database singleton ────────────────────────────────────────────

let db: any = null;
let sqlitePlugin: any = null;
let isInitialized = false;
const DB_NAME = 'DukaOS_Durable';

async function getPlugin() {
  if (sqlitePlugin) return sqlitePlugin;
  const mod = await import('@capacitor-community/sqlite');
  sqlitePlugin = mod.CapacitorSQLite;
  return sqlitePlugin;
}

/**
 * Check if SQLite is available (native app only).
 */
export function isSQLiteAvailable(): boolean {
  return isNativeApp();
}

/**
 * Initialize the SQLite database and create tables.
 */
export async function initSQLiteDB(): Promise<void> {
  if (isInitialized) return;
  if (!isSQLiteAvailable()) {
    console.log('[SQLite] Not a native app — skipping SQLite init');
    return;
  }

  try {
    const plugin = await getPlugin();

    // Check connection consistency (Android requirement)
    const ret = await plugin.checkConnectionsConsistency({ dbNames: [], openModes: [] });
    const isConn = (await plugin.isConnection({ database: DB_NAME, readonly: false })).result;

    if (ret.result && isConn) {
      db = await plugin.retrieveConnection({ database: DB_NAME, readonly: false });
    } else {
      db = await plugin.createConnection({
        database: DB_NAME,
        version: 1,
        encrypted: false,
        mode: 'no-encryption',
        readonly: false,
      });
    }

    await db.open();
    await createTables();
    isInitialized = true;
    console.log('[SQLite] Database initialized');
  } catch (error) {
    console.error('[SQLite] Init failed:', error);
    throw error;
  }
}

async function createTables(): Promise<void> {
  const statements = `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      branch_id TEXT NOT NULL,
      cashier_id TEXT NOT NULL,
      receipt_number TEXT NOT NULL,
      customer_id TEXT,
      shift_id TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      is_synced INTEGER NOT NULL DEFAULT 0,
      server_id TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT,
      offline_id TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY NOT NULL,
      transaction_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY NOT NULL,
      transaction_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      amount REAL NOT NULL,
      mpesa_reference TEXT,
      mpesa_phone TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 10,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      branch_id TEXT NOT NULL,
      user_id TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_synced ON transactions(is_synced);
    CREATE INDEX IF NOT EXISTS idx_transactions_branch ON transactions(branch_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_tx ON sale_items(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_payments_tx ON payments(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_id);
  `;

  await db.execute({ statements });
}

// ─── Transaction operations (crash-safe) ───────────────────────────

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save a complete sale atomically (transaction + items + payments + sync queue).
 * Wrapped in a SQLite transaction for crash safety — no partial writes.
 */
export async function saveSaleToSQLite(sale: {
  branch_id: string;
  cashier_id: string;
  receipt_number: string;
  customer_id: string | null;
  shift_id: string | null;
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
  }>;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
}): Promise<string> {
  if (!db) throw new Error('SQLite not initialized');

  const txId = `offline_${generateId()}`;
  const now = new Date().toISOString();
  const timestamp = Date.now();

  const set: any[] = [
    {
      statement: `INSERT INTO transactions 
        (id, branch_id, cashier_id, receipt_number, customer_id, shift_id,
         subtotal, tax_amount, discount_amount, total_amount, status,
         is_synced, server_id, created_at, synced_at, offline_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 0, NULL, ?, NULL, ?)`,
      values: [
        txId, sale.branch_id, sale.cashier_id, sale.receipt_number,
        sale.customer_id, sale.shift_id,
        sale.subtotal, sale.tax_amount, sale.discount_amount, sale.total_amount,
        now, txId,
      ],
    },
  ];

  // Items
  for (const item of sale.items) {
    set.push({
      statement: `INSERT INTO sale_items (id, transaction_id, product_id, product_name, quantity, unit_price, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        generateId(), txId, item.product_id, item.product_name,
        item.quantity, item.unit_price, item.total_amount,
      ],
    });
  }

  // Payments
  for (const payment of sale.payments) {
    set.push({
      statement: `INSERT INTO payments (id, transaction_id, payment_method, amount, mpesa_reference, mpesa_phone)
        VALUES (?, ?, ?, ?, ?, ?)`,
      values: [
        generateId(), txId, payment.payment_method, payment.amount,
        payment.mpesa_reference || null, payment.mpesa_phone || null,
      ],
    });
  }

  // Sync queue entry
  set.push({
    statement: `INSERT INTO sync_queue (entity_type, entity_id, status, retry_count, max_retries,
      error_message, created_at, updated_at, synced_at, branch_id, user_id)
      VALUES ('sale', ?, 'pending', 0, 10, NULL, ?, ?, NULL, ?, ?)`,
    values: [txId, timestamp, timestamp, sale.branch_id, sale.cashier_id],
  });

  // Execute as atomic transaction
  await db.executeSet({ set, transaction: true });

  console.log('[SQLite] Sale saved atomically:', txId);
  return txId;
}

// ─── Read operations ───────────────────────────────────────────────

/**
 * Get all unsynced transactions from SQLite.
 */
export async function getUnsyncedSQLiteTransactions(): Promise<SQLiteTransaction[]> {
  if (!db) return [];
  const result = await db.query({
    statement: 'SELECT * FROM transactions WHERE is_synced = 0 ORDER BY created_at ASC',
    values: [],
  });
  return result.values || [];
}

/**
 * Get sale items for a transaction.
 */
export async function getSQLiteSaleItems(transactionId: string): Promise<SQLiteSaleItem[]> {
  if (!db) return [];
  const result = await db.query({
    statement: 'SELECT * FROM sale_items WHERE transaction_id = ?',
    values: [transactionId],
  });
  return result.values || [];
}

/**
 * Get payments for a transaction.
 */
export async function getSQLitePayments(transactionId: string): Promise<SQLitePayment[]> {
  if (!db) return [];
  const result = await db.query({
    statement: 'SELECT * FROM payments WHERE transaction_id = ?',
    values: [transactionId],
  });
  return result.values || [];
}

/**
 * Get pending sync queue items (pending or retryable failed).
 */
export async function getPendingSQLiteSyncItems(): Promise<SQLiteSyncQueueItem[]> {
  if (!db) return [];
  const result = await db.query({
    statement: `SELECT * FROM sync_queue 
      WHERE (status = 'pending' OR (status = 'failed' AND retry_count < max_retries))
      ORDER BY created_at ASC`,
    values: [],
  });
  return result.values || [];
}

// ─── Update operations ─────────────────────────────────────────────

/**
 * Mark a transaction as synced after server confirmation.
 */
export async function markSQLiteTransactionSynced(localId: string, serverId: string): Promise<void> {
  if (!db) return;
  const now = new Date().toISOString();
  await db.executeSet({
    set: [
      {
        statement: 'UPDATE transactions SET is_synced = 1, server_id = ?, synced_at = ? WHERE id = ?',
        values: [serverId, now, localId],
      },
      {
        statement: `UPDATE sync_queue SET status = 'synced', synced_at = ?, updated_at = ? WHERE entity_id = ?`,
        values: [Date.now(), Date.now(), localId],
      },
    ],
    transaction: true,
  });
}

/**
 * Update sync queue item status (for retry tracking).
 */
export async function updateSQLiteSyncItem(
  entityId: string,
  updates: { status?: string; retry_count?: number; error_message?: string | null }
): Promise<void> {
  if (!db) return;
  const parts: string[] = ['updated_at = ?'];
  const values: any[] = [Date.now()];

  if (updates.status !== undefined) {
    parts.push('status = ?');
    values.push(updates.status);
  }
  if (updates.retry_count !== undefined) {
    parts.push('retry_count = ?');
    values.push(updates.retry_count);
  }
  if (updates.error_message !== undefined) {
    parts.push('error_message = ?');
    values.push(updates.error_message);
  }

  values.push(entityId);
  await db.run({
    statement: `UPDATE sync_queue SET ${parts.join(', ')} WHERE entity_id = ?`,
    values,
  });
}

// ─── Stats / Diagnostics ──────────────────────────────────────────

export async function getSQLiteSyncStats(): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  retryable: number;
  total: number;
  unsyncedSales: number;
}> {
  if (!db) {
    return { pending: 0, syncing: 0, synced: 0, failed: 0, retryable: 0, total: 0, unsyncedSales: 0 };
  }

  const queueResult = await db.query({
    statement: `SELECT status, retry_count, max_retries FROM sync_queue`,
    values: [],
  });
  const items: Array<{ status: string; retry_count: number; max_retries: number }> = queueResult.values || [];

  const salesResult = await db.query({
    statement: 'SELECT COUNT(*) as cnt FROM transactions WHERE is_synced = 0',
    values: [],
  });

  return {
    pending: items.filter(i => i.status === 'pending').length,
    syncing: items.filter(i => i.status === 'syncing').length,
    synced: items.filter(i => i.status === 'synced').length,
    failed: items.filter(i => i.status === 'failed' && i.retry_count >= i.max_retries).length,
    retryable: items.filter(i => i.status === 'failed' && i.retry_count < i.max_retries).length,
    total: items.length,
    unsyncedSales: salesResult.values?.[0]?.cnt ?? 0,
  };
}

/**
 * Cleanup old synced items (>7 days old).
 */
export async function cleanupSQLiteSyncQueue(): Promise<void> {
  if (!db) return;
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await db.run({
    statement: `DELETE FROM sync_queue WHERE status = 'synced' AND synced_at IS NOT NULL AND synced_at < ?`,
    values: [cutoff],
  });
}

/**
 * Get total count of unsynced sales (for UI badge).
 */
export async function getUnsyncedSaleCount(): Promise<number> {
  if (!db) return 0;
  const result = await db.query({
    statement: 'SELECT COUNT(*) as cnt FROM transactions WHERE is_synced = 0',
    values: [],
  });
  return result.values?.[0]?.cnt ?? 0;
}

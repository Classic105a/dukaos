/**
 * SQLite Recovery & Reconciliation
 * On app start, ensures SQLite and IndexedDB are consistent,
 * and rebuilds the IndexedDB sync queue from SQLite if needed.
 */

import { isSQLiteAvailable, initSQLiteDB, getUnsyncedSQLiteTransactions, getSQLiteSaleItems, getSQLitePayments } from '@/lib/sqlite-db';
import {
  saveLocalTransaction,
  getUnsyncedTransactions,
  addToSyncQueue,
  type LocalTransaction,
} from '@/lib/offline-db';

/**
 * Run on app startup: reconcile SQLite (source of truth) with IndexedDB (UI cache).
 * If SQLite has unsynced sales that IndexedDB doesn't know about, re-insert them.
 */
export async function reconcileStores(): Promise<{ recovered: number }> {
  if (!isSQLiteAvailable()) return { recovered: 0 };

  try {
    await initSQLiteDB();

    const sqliteUnsynced = await getUnsyncedSQLiteTransactions();
    if (sqliteUnsynced.length === 0) return { recovered: 0 };

    // Get IndexedDB unsynced IDs for comparison
    const idbUnsynced = await getUnsyncedTransactions();
    const idbIds = new Set(idbUnsynced.map(t => t.id));

    let recovered = 0;

    for (const sqlTx of sqliteUnsynced) {
      if (idbIds.has(sqlTx.id)) continue; // Already in IndexedDB

      // Rebuild from SQLite
      const items = await getSQLiteSaleItems(sqlTx.id);
      const payments = await getSQLitePayments(sqlTx.id);

      const localTx: LocalTransaction = {
        id: sqlTx.id,
        branch_id: sqlTx.branch_id,
        cashier_id: sqlTx.cashier_id,
        receipt_number: sqlTx.receipt_number,
        customer_id: sqlTx.customer_id,
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_amount: i.total_amount,
        })),
        payments: payments.map(p => ({
          payment_method: p.payment_method,
          amount: p.amount,
          mpesa_reference: p.mpesa_reference || undefined,
          mpesa_phone: p.mpesa_phone || undefined,
        })),
        subtotal: sqlTx.subtotal,
        tax_amount: sqlTx.tax_amount,
        discount_amount: sqlTx.discount_amount,
        total_amount: sqlTx.total_amount,
        shift_id: sqlTx.shift_id,
        status: sqlTx.status as 'completed' | 'voided',
        is_synced: false,
        server_id: null,
        created_at: sqlTx.created_at,
        synced_at: null,
      };

      await saveLocalTransaction(localTx);

      // Re-add to IndexedDB sync queue
      await addToSyncQueue({
        entity_type: 'sale',
        entity_id: sqlTx.id,
        payload: localTx,
        status: 'pending',
        retry_count: 0,
        max_retries: 10,
        error_message: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        synced_at: null,
        branch_id: sqlTx.branch_id,
        user_id: sqlTx.cashier_id,
      });

      recovered++;
    }

    if (recovered > 0) {
      console.log(`[SQLiteRecovery] Recovered ${recovered} unsynced sale(s) from SQLite → IndexedDB`);
    }

    return { recovered };
  } catch (error) {
    console.error('[SQLiteRecovery] Reconciliation error:', error);
    return { recovered: 0 };
  }
}

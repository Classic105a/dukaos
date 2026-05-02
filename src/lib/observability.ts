import { supabase } from '@/integrations/supabase/client';

type Severity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogErrorInput {
  message: string;
  severity?: Severity;
  source?: 'client' | 'rpc' | 'edge' | 'sync';
  stack?: string;
  context?: Record<string, unknown>;
  businessId?: string | null;
  branchId?: string | null;
}

interface LogMetricInput {
  metric: string;
  valueMs: number;
  context?: Record<string, unknown>;
  businessId?: string | null;
  branchId?: string | null;
}

/**
 * Fire-and-forget error logger. Never throws — observability must never break the app.
 * Dedupes identical messages within 30 seconds.
 */
const recentLogs = new Map<string, number>();
const DEDUPE_MS = 30_000;

export async function logError(input: LogErrorInput): Promise<void> {
  try {
    const key = `${input.severity ?? 'error'}|${input.message}`;
    const last = recentLogs.get(key);
    const now = Date.now();
    if (last && now - last < DEDUPE_MS) return;
    recentLogs.set(key, now);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // RLS would reject anyway

    await supabase.from('error_logs').insert({
      user_id: user.id,
      business_id: input.businessId ?? null,
      branch_id: input.branchId ?? null,
      severity: input.severity ?? 'error',
      source: input.source ?? 'client',
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 8000) ?? null,
      route: window.location.pathname,
      context: input.context ?? null,
      user_agent: navigator.userAgent,
    });
  } catch {
    // Swallow — never let observability crash the app
  }
}

export async function logMetric(input: LogMetricInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('perf_metrics').insert({
      user_id: user.id,
      business_id: input.businessId ?? null,
      branch_id: input.branchId ?? null,
      metric: input.metric,
      value_ms: Math.round(input.valueMs * 100) / 100,
      route: window.location.pathname,
      context: input.context ?? null,
    });
  } catch {
    // Swallow
  }
}

/**
 * Time an async operation and log the latency as a perf metric.
 * Returns the operation's return value.
 */
export async function timeOperation<T>(
  metric: string,
  fn: () => Promise<T>,
  meta?: { businessId?: string | null; branchId?: string | null; context?: Record<string, unknown> }
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    void logMetric({
      metric,
      valueMs: performance.now() - start,
      businessId: meta?.businessId,
      branchId: meta?.branchId,
      context: meta?.context,
    });
    return result;
  } catch (err) {
    void logMetric({
      metric: `${metric}_failed`,
      valueMs: performance.now() - start,
      businessId: meta?.businessId,
      branchId: meta?.branchId,
      context: { ...(meta?.context || {}), error: (err as Error)?.message },
    });
    throw err;
  }
}

/**
 * Install global handlers for unhandled errors and promise rejections.
 * Call once at app startup.
 */
export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;
  if ((window as any).__obsHandlersInstalled) return;
  (window as any).__obsHandlersInstalled = true;

  window.addEventListener('error', (e) => {
    void logError({
      message: e.message || 'Unhandled error',
      stack: e.error?.stack,
      source: 'client',
      severity: 'error',
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason: any = e.reason;
    void logError({
      message: reason?.message || String(reason) || 'Unhandled rejection',
      stack: reason?.stack,
      source: 'client',
      severity: 'error',
    });
  });
}
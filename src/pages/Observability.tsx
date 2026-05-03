import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, RefreshCw, Gauge, Database, Download, AlertCircle, Users, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useBusiness } from '@/hooks/useBusiness';
import { toast } from 'sonner';

const SEVERITY_COLOR: Record<string, string> = {
  fatal: 'bg-destructive text-destructive-foreground',
  error: 'bg-destructive/80 text-destructive-foreground',
  warn: 'bg-warning text-warning-foreground',
  info: 'bg-primary/20 text-primary',
  debug: 'bg-muted text-muted-foreground',
};

const Observability = () => {
  const [tab, setTab] = useState<'errors' | 'metrics' | 'backups' | 'conflicts' | 'staff'>('errors');
  const { currentBusiness } = useBusiness();
  const [backingUp, setBackingUp] = useState(false);

  const errorsQuery = useQuery({
    queryKey: ['observability', 'errors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const metricsQuery = useQuery({
    queryKey: ['observability', 'metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perf_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const backupsQuery = useQuery({
    queryKey: ['observability', 'backups', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const conflictsQuery = useQuery({
    queryKey: ['observability', 'sync-conflicts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_conflicts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const staffQuery = useQuery({
    queryKey: ['observability', 'staff-accountability'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: sales, error } = await supabase
        .from('sales')
        .select('id, cashier_id, total_amount, discount_amount, status, created_at')
        .gte('created_at', since)
        .limit(2000);
      if (error) throw error;
      const byCashier: Record<string, { sales: number; revenue: number; discounts: number; voids: number; }> = {};
      (sales ?? []).forEach((s: any) => {
        const k = s.cashier_id ?? 'unknown';
        const b = (byCashier[k] ||= { sales: 0, revenue: 0, discounts: 0, voids: 0 });
        b.sales += 1;
        b.revenue += Number(s.total_amount) || 0;
        b.discounts += Number(s.discount_amount) || 0;
        if (s.status === 'voided') b.voids += 1;
      });
      // Resolve names
      const ids = Object.keys(byCashier);
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
        (profs ?? []).forEach((p: any) => { names[p.id] = p.full_name || p.email || p.id.slice(0, 8); });
      }
      return Object.entries(byCashier).map(([id, v]) => ({
        id,
        name: names[id] ?? id.slice(0, 8),
        ...v,
        discountRate: v.revenue > 0 ? (v.discounts / (v.revenue + v.discounts)) * 100 : 0,
        abuse: v.voids >= 3 || (v.revenue > 0 && (v.discounts / (v.revenue + v.discounts)) * 100 > 15),
      })).sort((a, b) => b.revenue - a.revenue);
    },
    refetchInterval: 30_000,
  });

  const resolveConflict = async (id: string, status: 'resolved' | 'discarded') => {
    const { error } = await supabase
      .from('sync_conflicts')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success(`Marked ${status}`); void conflictsQuery.refetch(); }
  };

  const triggerBackup = async () => {
    if (!currentBusiness?.id) {
      toast.error('No business selected');
      return;
    }
    setBackingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('dr-backup', {
        body: { mode: 'on_demand', business_id: currentBusiness.id },
      });
      if (error) throw error;
      const url = (data as any)?.download_url;
      if (url) {
        toast.success('Backup ready — downloading…');
        window.open(url, '_blank');
      } else {
        toast.success('Backup created');
      }
      void backupsQuery.refetch();
    } catch (e: any) {
      toast.error(`Backup failed: ${e?.message ?? 'unknown'}`);
    } finally {
      setBackingUp(false);
    }
  };

  const downloadBackup = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('dr-backups')
      .createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Could not generate download link');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  // Aggregate metrics: p50 / p95 / count per metric name (last 500 samples)
  const metricStats = (() => {
    const byMetric: Record<string, number[]> = {};
    (metricsQuery.data ?? []).forEach((m: any) => {
      (byMetric[m.metric] ||= []).push(Number(m.value_ms));
    });
    return Object.entries(byMetric)
      .map(([metric, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
        const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        return { metric, count: values.length, p50, p95, avg };
      })
      .sort((a, b) => b.count - a.count);
  })();

  const errorCount = errorsQuery.data?.length ?? 0;
  const fatalCount = errorsQuery.data?.filter((e: any) => e.severity === 'fatal').length ?? 0;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Observability</h1>
            <p className="text-sm text-muted-foreground">Production errors and performance metrics</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void errorsQuery.refetch();
              void metricsQuery.refetch();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Errors (last 200)
            </div>
            <div className="text-2xl font-bold tabular-nums">{errorCount}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Fatal
            </div>
            <div className="text-2xl font-bold tabular-nums text-destructive">{fatalCount}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Gauge className="w-3.5 h-3.5" /> Tracked metrics
            </div>
            <div className="text-2xl font-bold tabular-nums">{metricStats.length}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="w-3.5 h-3.5" /> Samples
            </div>
            <div className="text-2xl font-bold tabular-nums">{metricsQuery.data?.length ?? 0}</div>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="metrics">Performance</TabsTrigger>
            <TabsTrigger value="backups">Backups</TabsTrigger>
            <TabsTrigger value="conflicts">
              Conflicts
              {(conflictsQuery.data?.filter((c: any) => c.status === 'pending').length ?? 0) > 0 && (
                <Badge className="ml-2 bg-destructive text-destructive-foreground text-[10px]">
                  {conflictsQuery.data!.filter((c: any) => c.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
          </TabsList>

          <TabsContent value="errors" className="space-y-2 mt-4">
            {errorsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground p-8 text-center">Loading…</div>
            ) : errorCount === 0 ? (
              <div className="text-sm text-muted-foreground p-8 text-center">No errors logged 🎉</div>
            ) : (
              <div className="space-y-2">
                {errorsQuery.data!.map((e: any) => (
                  <Card key={e.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <Badge className={cn('text-[10px] uppercase', SEVERITY_COLOR[e.severity] || '')}>
                        {e.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm break-words">{e.message}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                          <span className="uppercase font-semibold">{e.source}</span>
                          {e.route && <span>· {e.route}</span>}
                          <span>· {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                        </div>
                        {e.stack && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Stack trace
                            </summary>
                            <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                              {e.stack}
                            </pre>
                          </details>
                        )}
                        {e.context && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Context
                            </summary>
                            <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(e.context, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="mt-4">
            {metricsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground p-8 text-center">Loading…</div>
            ) : metricStats.length === 0 ? (
              <div className="text-sm text-muted-foreground p-8 text-center">No metrics yet</div>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Metric</th>
                      <th className="text-right p-3">Samples</th>
                      <th className="text-right p-3">p50</th>
                      <th className="text-right p-3">p95</th>
                      <th className="text-right p-3">avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricStats.map((m) => (
                      <tr key={m.metric} className="border-t">
                        <td className="p-3 font-mono text-xs">{m.metric}</td>
                        <td className="p-3 text-right tabular-nums">{m.count}</td>
                        <td className="p-3 text-right tabular-nums">{m.p50.toFixed(1)} ms</td>
                        <td className="p-3 text-right tabular-nums">{m.p95.toFixed(1)} ms</td>
                        <td className="p-3 text-right tabular-nums">{m.avg.toFixed(1)} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="backups" className="mt-4 space-y-3">
            <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <Database className="w-4 h-4" /> Disaster Recovery
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatic daily backups at 02:30 UTC · 30-day retention · stored in private bucket
                </p>
              </div>
              <Button onClick={triggerBackup} disabled={backingUp || !currentBusiness}>
                <Download className="w-4 h-4 mr-2" />
                {backingUp ? 'Backing up…' : 'Backup now'}
              </Button>
            </Card>

            {backupsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground p-8 text-center">Loading…</div>
            ) : (backupsQuery.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground p-8 text-center">No backups yet</div>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Started</th>
                      <th className="text-left p-3">Kind</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-right p-3">Tables</th>
                      <th className="text-right p-3">Rows</th>
                      <th className="text-right p-3">Size</th>
                      <th className="text-right p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupsQuery.data!.map((b: any) => (
                      <tr key={b.id} className="border-t">
                        <td className="p-3">
                          {formatDistanceToNow(new Date(b.started_at), { addSuffix: true })}
                        </td>
                        <td className="p-3 capitalize">{b.kind?.replace('_', ' ')}</td>
                        <td className="p-3">
                          <Badge
                            className={cn(
                              'text-[10px] uppercase',
                              b.status === 'success'
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                : b.status === 'failed'
                                ? 'bg-destructive text-destructive-foreground'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {b.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right tabular-nums">{b.tables_count ?? '—'}</td>
                        <td className="p-3 text-right tabular-nums">
                          {b.rows_count?.toLocaleString() ?? '—'}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {b.size_bytes ? `${(b.size_bytes / 1024).toFixed(1)} KB` : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {b.file_path && b.status === 'success' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadBackup(b.file_path)}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="conflicts" className="mt-4 space-y-2">
            {conflictsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground p-8 text-center">Loading…</div>
            ) : (conflictsQuery.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground p-8 text-center">No sync conflicts 🎉</div>
            ) : (
              conflictsQuery.data!.map((c: any) => (
                <Card key={c.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <Badge className={cn('text-[10px] uppercase',
                      c.conflict_type === 'oversell' ? 'bg-destructive text-destructive-foreground' :
                      c.conflict_type === 'duplicate' ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      <AlertCircle className="w-3 h-3 mr-1" />{c.conflict_type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium break-words">{c.error_message || '—'}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        offline_id <span className="font-mono">{c.offline_id}</span> ·{' '}
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </div>
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Sale payload</summary>
                        <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto max-h-64">
                          {JSON.stringify(c.payload, null, 2)}
                        </pre>
                      </details>
                    </div>
                    {c.status === 'pending' ? (
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="outline" onClick={() => resolveConflict(c.id, 'resolved')}>
                          <Check className="w-3.5 h-3.5 mr-1" /> Resolve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => resolveConflict(c.id, 'discarded')}>
                          <X className="w-3.5 h-3.5 mr-1" /> Discard
                        </Button>
                      </div>
                    ) : (
                      <Badge className="text-[10px] uppercase bg-muted text-muted-foreground">{c.status}</Badge>
                    )}
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="staff" className="mt-4">
            {staffQuery.isLoading ? (
              <div className="text-sm text-muted-foreground p-8 text-center">Loading…</div>
            ) : (staffQuery.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground p-8 text-center">No sales in last 24h</div>
            ) : (
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground border-b">
                  <Users className="w-3.5 h-3.5" /> Last 24 hours · flags trigger at 3+ voids or &gt;15% discount rate
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Cashier</th>
                      <th className="text-right p-3">Sales</th>
                      <th className="text-right p-3">Revenue</th>
                      <th className="text-right p-3">Discounts</th>
                      <th className="text-right p-3">Disc %</th>
                      <th className="text-right p-3">Voids</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffQuery.data!.map((r: any) => (
                      <tr key={r.id} className={cn('border-t', r.abuse && 'bg-destructive/5')}>
                        <td className="p-3 font-medium flex items-center gap-2">
                          {r.name}
                          {r.abuse && <Badge className="text-[9px] bg-destructive text-destructive-foreground">REVIEW</Badge>}
                        </td>
                        <td className="p-3 text-right tabular-nums">{r.sales}</td>
                        <td className="p-3 text-right tabular-nums">{r.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right tabular-nums">{r.discounts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right tabular-nums">{r.discountRate.toFixed(1)}%</td>
                        <td className="p-3 text-right tabular-nums">{r.voids}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Observability;
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, RefreshCw, Gauge } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const SEVERITY_COLOR: Record<string, string> = {
  fatal: 'bg-destructive text-destructive-foreground',
  error: 'bg-destructive/80 text-destructive-foreground',
  warn: 'bg-warning text-warning-foreground',
  info: 'bg-primary/20 text-primary',
  debug: 'bg-muted text-muted-foreground',
};

const Observability = () => {
  const [tab, setTab] = useState<'errors' | 'metrics'>('errors');

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

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'errors' | 'metrics')}>
          <TabsList>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="metrics">Performance</TabsTrigger>
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Observability;
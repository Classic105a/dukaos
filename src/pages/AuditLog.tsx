import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Search, Calendar, Download, User, Clock, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const actionColors: Record<string, string> = {
  SALE_COMPLETED: 'bg-success/10 text-success',
  SALE_VOIDED: 'bg-destructive/10 text-destructive',
  STOCK_ADDED: 'bg-primary/10 text-primary',
  STOCK_ADJUSTED: 'bg-warning/10 text-warning',
  APPROVAL_GRANTED: 'bg-success/10 text-success',
  APPROVAL_DENIED: 'bg-destructive/10 text-destructive',
  RETURN_PROCESSED: 'bg-warning/10 text-warning',
  PRICE_CHANGED: 'bg-info/10 text-info',
  USER_ROLE_CHANGED: 'bg-primary/10 text-primary',
};

const AuditLog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter, entityFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles:user_id(full_name, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    },
  });

  const logs = data?.logs || [];
  const totalCount = data?.total || 0;

  const filteredLogs = searchTerm
    ? logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.new_values).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  // Get unique actions and entities for filters
  const { data: filterOptions } = useQuery({
    queryKey: ['audit-log-filters'],
    queryFn: async () => {
      const { data: actions } = await supabase
        .from('audit_logs')
        .select('action')
        .limit(100);
      const { data: entities } = await supabase
        .from('audit_logs')
        .select('entity_type')
        .limit(100);

      const uniqueActions = [...new Set((actions || []).map(a => a.action))].sort();
      const uniqueEntities = [...new Set((entities || []).map(e => e.entity_type))].sort();
      return { actions: uniqueActions, entities: uniqueEntities };
    },
  });

  const exportCSV = () => {
    const headers = ['Date', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      (log as any).profiles?.full_name || (log as any).profiles?.email || log.user_id,
      log.action,
      log.entity_type,
      log.entity_id || '',
      JSON.stringify(log.new_values || {}),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Audit Trail
            </h1>
            <p className="text-muted-foreground">
              Complete log of all actions and changes
            </p>
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {filterOptions?.actions.map(a => (
                    <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {filterOptions?.entities.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No audit logs found</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[150px]">
                              {(log as any).profiles?.full_name || (log as any).profiles?.email || 'System'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', actionColors[log.action] || 'bg-muted text-muted-foreground')}>
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground capitalize">
                            {log.entity_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.new_values && (
                            <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                              {typeof log.new_values === 'object'
                                ? Object.entries(log.new_values as Record<string, unknown>)
                                    .slice(0, 3)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')
                                : String(log.new_values)}
                            </code>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= totalCount}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AuditLog;

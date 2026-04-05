import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBranch } from './useBranch';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SALE_COMPLETED'
  | 'SALE_VOIDED'
  | 'REFUND_PROCESSED'
  | 'REFUND_REQUESTED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'STOCK_ADJUSTED'
  | 'STOCK_ADDED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CREDIT_SALE'
  | 'CREDIT_PAYMENT'
  | 'SHIFT_OPENED'
  | 'SHIFT_CLOSED'
  | 'USER_ROLE_CHANGED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_DENIED'
  | 'PRICE_OVERRIDE'
  | 'DISCOUNT_APPLIED';

export type EntityType =
  | 'sale'
  | 'product'
  | 'customer'
  | 'stock_movement'
  | 'credit_transaction'
  | 'shift'
  | 'user'
  | 'approval'
  | 'return';

interface AuditLogEntry {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export const useAuditLog = () => {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const _queryClient = useQueryClient();

  const logAction = useMutation({
    mutationFn: async (entry: AuditLogEntry) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        old_values: entry.oldValues || null,
        new_values: entry.newValues || null,
        branch_id: currentBranch?.id || null,
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error('Audit log error:', error);
        // Don't throw - audit logging should not block operations
      }
    },
  });

  const log = (
    action: AuditAction,
    entityType: EntityType,
    entityId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ) => {
    logAction.mutate({ action, entityType, entityId, oldValues, newValues });
  };

  // Query audit logs (for managers/admins)
  const useAuditLogs = (filters?: {
    action?: AuditAction;
    entityType?: EntityType;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) => {
    return useQuery({
      queryKey: ['audit-logs', filters],
      queryFn: async () => {
        let query = supabase
          .from('audit_logs')
          .select('*, profiles:user_id(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(filters?.limit || 100);

        if (filters?.action) {
          query = query.eq('action', filters.action);
        }
        if (filters?.entityType) {
          query = query.eq('entity_type', filters.entityType);
        }
        if (filters?.userId) {
          query = query.eq('user_id', filters.userId);
        }
        if (filters?.startDate) {
          query = query.gte('created_at', filters.startDate.toISOString());
        }
        if (filters?.endDate) {
          query = query.lte('created_at', filters.endDate.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
    });
  };

  return {
    log,
    logAction,
    useAuditLogs,
    isLogging: logAction.isPending,
  };
};

export default useAuditLog;

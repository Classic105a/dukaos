 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { format } from 'date-fns';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { ArrowDownLeft, ArrowUpRight, RefreshCw, Loader2 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface CreditTransaction {
   id: string;
   transaction_type: 'CREDIT_SALE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND';
   amount: number;
   running_balance: number;
   payment_method: string | null;
   reference: string | null;
   notes: string | null;
   created_at: string;
 }
 
 interface CreditHistoryPanelProps {
   customerId: string;
 }
 
 const CreditHistoryPanel = ({ customerId }: CreditHistoryPanelProps) => {
   const { data: transactions = [], isLoading } = useQuery({
     queryKey: ['credit-history', customerId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('credit_transactions')
         .select('*')
         .eq('customer_id', customerId)
         .order('created_at', { ascending: false })
         .limit(50);
       if (error) throw error;
       return data as CreditTransaction[];
     },
     enabled: !!customerId,
   });
 
   const getTransactionIcon = (type: string) => {
     switch (type) {
       case 'CREDIT_SALE':
         return <ArrowUpRight className="w-4 h-4 text-destructive" />;
       case 'PAYMENT':
         return <ArrowDownLeft className="w-4 h-4 text-success" />;
       case 'ADJUSTMENT':
       case 'REFUND':
         return <RefreshCw className="w-4 h-4 text-warning" />;
       default:
         return null;
     }
   };
 
   const getTransactionLabel = (type: string) => {
     switch (type) {
       case 'CREDIT_SALE': return 'Credit Sale';
       case 'PAYMENT': return 'Payment';
       case 'ADJUSTMENT': return 'Adjustment';
       case 'REFUND': return 'Refund';
       default: return type;
     }
   };
 
   if (isLoading) {
     return (
       <div className="flex items-center justify-center py-8">
         <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
       </div>
     );
   }
 
   if (transactions.length === 0) {
     return (
       <div className="text-center py-8 text-muted-foreground">
         <p>No credit transactions yet</p>
       </div>
     );
   }
 
   return (
     <ScrollArea className="h-[250px]">
       <div className="space-y-2 pr-4">
         {transactions.map((tx) => (
           <div
             key={tx.id}
             className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
           >
             <div className="flex items-center gap-3">
               <div className={cn(
                 "w-8 h-8 rounded-full flex items-center justify-center",
                 tx.transaction_type === 'CREDIT_SALE' ? "bg-destructive/10" : 
                 tx.transaction_type === 'PAYMENT' ? "bg-success/10" : "bg-warning/10"
               )}>
                 {getTransactionIcon(tx.transaction_type)}
               </div>
               <div>
                 <p className="text-sm font-medium">{getTransactionLabel(tx.transaction_type)}</p>
                 <p className="text-xs text-muted-foreground">
                   {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                 </p>
                 {tx.reference && (
                   <Badge variant="outline" className="text-xs mt-1">
                     {tx.reference}
                   </Badge>
                 )}
               </div>
             </div>
             <div className="text-right">
               <p className={cn(
                 "font-medium tabular-nums",
                 tx.amount > 0 ? "text-destructive" : "text-success"
               )}>
                 {tx.amount > 0 ? '+' : ''}{tx.amount < 0 ? '-' : ''}KES {Math.abs(tx.amount).toLocaleString()}
               </p>
               <p className="text-xs text-muted-foreground tabular-nums">
                 Bal: KES {tx.running_balance.toLocaleString()}
               </p>
             </div>
           </div>
         ))}
       </div>
     </ScrollArea>
   );
 };
 
 export default CreditHistoryPanel;
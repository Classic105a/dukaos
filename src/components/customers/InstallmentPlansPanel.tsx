 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { format, isPast } from 'date-fns';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Calendar, CreditCard, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { useAuth } from '@/hooks/useAuth';
 import { useToast } from '@/hooks/use-toast';
 
 interface InstallmentPlan {
   id: string;
   total_amount: number;
   installments_count: number;
   installment_amount: number;
   paid_installments: number;
   remaining_amount: number;
   status: 'active' | 'completed' | 'cancelled' | 'overdue';
   start_date: string;
   next_due_date: string;
   created_at: string;
 }
 
 interface InstallmentPlansPanelProps {
   customerId: string;
   onRecordPayment: () => void;
 }
 
 const InstallmentPlansPanel = ({ customerId, onRecordPayment }: InstallmentPlansPanelProps) => {
   const { user } = useAuth();
   const { toast } = useToast();
   const queryClient = useQueryClient();
 
   const { data: plans = [], isLoading } = useQuery({
     queryKey: ['installment-plans', customerId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('installment_plans')
         .select('*')
         .eq('customer_id', customerId)
         .order('created_at', { ascending: false });
       if (error) throw error;
       return data as InstallmentPlan[];
     },
     enabled: !!customerId,
   });
 
   const recordInstallmentPayment = useMutation({
     mutationFn: async (plan: InstallmentPlan) => {
       if (!user?.id) throw new Error('Not authenticated');
 
       // Get customer current balance
       const { data: customer } = await supabase
         .from('customers')
         .select('credit_balance')
         .eq('id', customerId)
         .single();
 
       if (!customer) throw new Error('Customer not found');
 
       const paymentAmount = plan.installment_amount;
       const newBalance = Math.max(0, customer.credit_balance - paymentAmount);
       const newPaidInstallments = plan.paid_installments + 1;
       const newRemaining = Math.max(0, plan.remaining_amount - paymentAmount);
       const isComplete = newPaidInstallments >= plan.installments_count;
 
       // Record credit transaction
       await supabase.from('credit_transactions').insert({
         customer_id: customerId,
         transaction_type: 'PAYMENT',
         amount: -paymentAmount,
         running_balance: newBalance,
         payment_method: 'installment',
         reference: `Installment ${newPaidInstallments}/${plan.installments_count}`,
         processed_by: user.id,
         installment_plan_id: plan.id,
       });
 
       // Update customer balance
       await supabase
         .from('customers')
         .update({ credit_balance: newBalance })
         .eq('id', customerId);
 
       // Update installment plan
       await supabase
         .from('installment_plans')
         .update({
           paid_installments: newPaidInstallments,
           remaining_amount: newRemaining,
           status: isComplete ? 'completed' : 'active',
         })
         .eq('id', plan.id);
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['installment-plans'] });
       queryClient.invalidateQueries({ queryKey: ['credit-history'] });
       queryClient.invalidateQueries({ queryKey: ['customers'] });
       queryClient.invalidateQueries({ queryKey: ['credit-customers'] });
       toast({ title: 'Installment payment recorded' });
     },
     onError: (error: Error) => {
       toast({ title: 'Payment failed', description: error.message, variant: 'destructive' });
     },
   });
 
   const getStatusBadge = (plan: InstallmentPlan) => {
     const isOverdue = isPast(new Date(plan.next_due_date)) && plan.status === 'active';
     
     if (plan.status === 'completed') {
       return <Badge className="bg-success/10 text-success border-success/30">Completed</Badge>;
     }
     if (isOverdue || plan.status === 'overdue') {
       return <Badge variant="destructive">Overdue</Badge>;
     }
     if (plan.status === 'cancelled') {
       return <Badge variant="secondary">Cancelled</Badge>;
     }
     return <Badge variant="outline">Active</Badge>;
   };
 
   if (isLoading) {
     return (
       <div className="flex items-center justify-center py-8">
         <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
       </div>
     );
   }
 
   if (plans.length === 0) {
     return (
       <div className="text-center py-8 text-muted-foreground">
         <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
         <p>No installment plans</p>
       </div>
     );
   }
 
   return (
     <ScrollArea className="h-[300px]">
       <div className="space-y-4 pr-4">
         {plans.map((plan) => {
           const progress = (plan.paid_installments / plan.installments_count) * 100;
           const isOverdue = isPast(new Date(plan.next_due_date)) && plan.status === 'active';
 
           return (
             <div
               key={plan.id}
               className={cn(
                 "p-4 rounded-lg border",
                 isOverdue ? "border-destructive/50 bg-destructive/5" : "bg-muted/30"
               )}
             >
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                   <CreditCard className="w-4 h-4 text-primary" />
                   <span className="font-medium">
                     KES {plan.total_amount.toLocaleString()}
                   </span>
                 </div>
                 {getStatusBadge(plan)}
               </div>
 
               <div className="space-y-2">
                 <div className="flex justify-between text-sm">
                   <span className="text-muted-foreground">Progress</span>
                   <span className="font-medium">
                     {plan.paid_installments} of {plan.installments_count} paid
                   </span>
                 </div>
                 <Progress value={progress} className="h-2" />
               </div>
 
               <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                 <div>
                   <p className="text-xs text-muted-foreground">Each Payment</p>
                   <p className="font-medium">KES {plan.installment_amount.toLocaleString()}</p>
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground">Remaining</p>
                   <p className="font-medium text-destructive">
                     KES {plan.remaining_amount.toLocaleString()}
                   </p>
                 </div>
               </div>
 
               {plan.status === 'active' && (
                 <div className="mt-3 pt-3 border-t flex items-center justify-between">
                   <div className="flex items-center gap-2 text-sm">
                     {isOverdue ? (
                       <AlertTriangle className="w-4 h-4 text-destructive" />
                     ) : (
                       <Calendar className="w-4 h-4 text-muted-foreground" />
                     )}
                     <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                       {isOverdue ? 'Overdue: ' : 'Next: '}
                       {format(new Date(plan.next_due_date), 'MMM d, yyyy')}
                     </span>
                   </div>
                   <Button
                     size="sm"
                     onClick={() => recordInstallmentPayment.mutate(plan)}
                     disabled={recordInstallmentPayment.isPending}
                   >
                     {recordInstallmentPayment.isPending ? (
                       <Loader2 className="w-4 h-4 animate-spin" />
                     ) : (
                       <>
                         <CheckCircle2 className="w-4 h-4 mr-1" />
                         Pay
                       </>
                     )}
                   </Button>
                 </div>
               )}
 
               {plan.status === 'completed' && (
                 <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm text-success">
                   <CheckCircle2 className="w-4 h-4" />
                   Fully paid on {format(new Date(plan.next_due_date), 'MMM d, yyyy')}
                 </div>
               )}
             </div>
           );
         })}
       </div>
     </ScrollArea>
   );
 };
 
 export default InstallmentPlansPanel;
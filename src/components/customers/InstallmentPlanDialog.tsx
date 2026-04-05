 import { useState } from 'react';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { useToast } from '@/hooks/use-toast';
 import { Calendar, Calculator } from 'lucide-react';
 import { addWeeks, addMonths, format } from 'date-fns';
 
 interface InstallmentPlanDialogProps {
   isOpen: boolean;
   onClose: () => void;
   customer: {
     id: string;
     name: string;
     credit_balance: number;
   } | null;
 }
 
 const InstallmentPlanDialog = ({ isOpen, onClose, customer }: InstallmentPlanDialogProps) => {
   const { user } = useAuth();
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const [amount, setAmount] = useState('');
   const [installmentCount, setInstallmentCount] = useState('3');
   const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
 
   const createPlan = useMutation({
     mutationFn: async () => {
       if (!customer || !user?.id) throw new Error('Missing data');
 
       const totalAmount = parseFloat(amount);
       const count = parseInt(installmentCount);
       const installmentAmount = Math.ceil(totalAmount / count);
 
       // Calculate first due date
       const startDate = new Date();
       let nextDue: Date;
       switch (frequency) {
         case 'weekly':
           nextDue = addWeeks(startDate, 1);
           break;
         case 'biweekly':
           nextDue = addWeeks(startDate, 2);
           break;
         case 'monthly':
         default:
           nextDue = addMonths(startDate, 1);
           break;
       }
 
       const { error } = await supabase.from('installment_plans').insert({
         customer_id: customer.id,
         total_amount: totalAmount,
         installments_count: count,
         installment_amount: installmentAmount,
         remaining_amount: totalAmount,
         next_due_date: nextDue.toISOString().split('T')[0],
         created_by: user.id,
       });
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['installment-plans'] });
       queryClient.invalidateQueries({ queryKey: ['credit-customers'] });
       toast({ title: 'Installment plan created successfully' });
       resetForm();
       onClose();
     },
     onError: (error: Error) => {
       toast({ title: 'Failed to create plan', description: error.message, variant: 'destructive' });
     },
   });
 
   const resetForm = () => {
     setAmount('');
     setInstallmentCount('3');
     setFrequency('monthly');
   };
 
   if (!customer) return null;
 
   const parsedAmount = parseFloat(amount) || 0;
   const parsedCount = parseInt(installmentCount) || 3;
   const installmentAmount = parsedAmount > 0 ? Math.ceil(parsedAmount / parsedCount) : 0;
 
   // Calculate schedule preview
   const getSchedulePreview = () => {
     const schedule: Date[] = [];
     let date = new Date();
     for (let i = 0; i < parsedCount; i++) {
       switch (frequency) {
         case 'weekly':
           date = addWeeks(date, 1);
           break;
         case 'biweekly':
           date = addWeeks(date, 2);
           break;
         case 'monthly':
         default:
           date = addMonths(date, 1);
           break;
       }
       schedule.push(new Date(date));
     }
     return schedule;
   };
 
   const schedule = parsedAmount > 0 ? getSchedulePreview() : [];
 
   return (
     <Dialog open={isOpen} onOpenChange={onClose}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Calculator className="w-5 h-5 text-primary" />
             Create Installment Plan
           </DialogTitle>
           <DialogDescription>
             Set up a payment schedule for {customer.name}'s outstanding balance.
           </DialogDescription>
         </DialogHeader>
 
         <div className="bg-secondary/50 rounded-lg p-3 my-2">
           <div className="flex justify-between">
             <span className="text-sm text-muted-foreground">Outstanding Balance</span>
             <span className="font-bold text-destructive tabular-nums">
               KES {customer.credit_balance.toLocaleString()}
             </span>
           </div>
         </div>
 
         <div className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="planAmount">Amount to Schedule</Label>
             <Input
               id="planAmount"
               type="number"
               min="0"
               max={customer.credit_balance}
               value={amount}
               onChange={(e) => setAmount(e.target.value)}
               placeholder="0.00"
               className="text-lg font-mono"
             />
             <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={() => setAmount(customer.credit_balance.toString())}
             >
               Full Balance
             </Button>
           </div>
 
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Number of Installments</Label>
               <Select value={installmentCount} onValueChange={setInstallmentCount}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="2">2 installments</SelectItem>
                   <SelectItem value="3">3 installments</SelectItem>
                   <SelectItem value="4">4 installments</SelectItem>
                   <SelectItem value="6">6 installments</SelectItem>
                   <SelectItem value="12">12 installments</SelectItem>
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-2">
               <Label>Payment Frequency</Label>
               <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="weekly">Weekly</SelectItem>
                   <SelectItem value="biweekly">Bi-weekly</SelectItem>
                   <SelectItem value="monthly">Monthly</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>
 
           {parsedAmount > 0 && (
             <div className="bg-primary/5 rounded-lg p-4 space-y-3">
               <div className="flex justify-between items-center">
                 <span className="text-sm font-medium">Each Payment</span>
                 <span className="text-lg font-bold text-primary">
                   KES {installmentAmount.toLocaleString()}
                 </span>
               </div>
 
               <div className="border-t pt-3">
                 <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                   <Calendar className="w-3 h-3" />
                   Payment Schedule
                 </p>
                 <div className="space-y-1 max-h-32 overflow-y-auto">
                   {schedule.map((date, i) => (
                     <div key={i} className="flex justify-between text-sm">
                       <span className="text-muted-foreground">Payment {i + 1}</span>
                       <span className="font-medium">{format(date, 'MMM d, yyyy')}</span>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           )}
 
           <div className="flex gap-2 pt-2">
             <Button type="button" variant="outline" onClick={onClose} className="flex-1">
               Cancel
             </Button>
             <Button
               onClick={() => createPlan.mutate()}
               disabled={createPlan.isPending || parsedAmount <= 0}
               className="flex-1"
             >
               {createPlan.isPending ? 'Creating...' : 'Create Plan'}
             </Button>
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default InstallmentPlanDialog;
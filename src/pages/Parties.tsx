import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useParties, Party } from '@/hooks/useParties';
import { usePayables } from '@/hooks/usePayables';
import {
  Plus, Search, Truck, Store, Building2, Landmark, Phone, Mail,
  ArrowUpRight, ArrowDownLeft, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const Parties = () => {
  const { parties, suppliers, dealers, wholesalers, totalPayables, isLoading, createParty } = useParties();
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const { recordTransaction } = usePayables();

  const [form, setForm] = useState({
    name: '', party_type: 'supplier', phone: '', email: '', address: '',
    opening_balance: '0', pricing_tier: 'standard', notes: '',
  });

  const [txForm, setTxForm] = useState({
    type: 'PURCHASE', amount: '', payment_method: 'cash', reference: '', notes: '',
  });

  const filtered = parties.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  const handleCreate = () => {
    createParty.mutate({
      name: form.name,
      party_type: form.party_type,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
      current_balance: parseFloat(form.opening_balance) || 0,
      pricing_tier: form.pricing_tier,
      notes: form.notes || null,
    } as any, {
      onSuccess: () => {
        setDialogOpen(false);
        setForm({ name: '', party_type: 'supplier', phone: '', email: '', address: '', opening_balance: '0', pricing_tier: 'standard', notes: '' });
      },
    });
  };

  const handleRecordTx = () => {
    if (!selectedParty) return;
    recordTransaction.mutate({
      partyId: selectedParty.id,
      type: txForm.type,
      amount: parseFloat(txForm.amount) || 0,
      paymentMethod: txForm.payment_method,
      reference: txForm.reference,
      notes: txForm.notes,
    }, {
      onSuccess: () => {
        setTxDialogOpen(false);
        setTxForm({ type: 'PURCHASE', amount: '', payment_method: 'cash', reference: '', notes: '' });
      },
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'supplier': return <Truck className="w-4 h-4" />;
      case 'dealer': return <Store className="w-4 h-4" />;
      case 'wholesaler': return <Building2 className="w-4 h-4" />;
      case 'bank': return <Landmark className="w-4 h-4" />;
      default: return <Store className="w-4 h-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Parties & Suppliers</h1>
            <p className="text-muted-foreground">Manage suppliers, dealers, wholesalers & payables</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Party</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Party</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Party name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.party_type} onValueChange={v => setForm({ ...form, party_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="supplier">Supplier</SelectItem>
                        <SelectItem value="dealer">Dealer</SelectItem>
                        <SelectItem value="wholesaler">Wholesaler</SelectItem>
                        <SelectItem value="retailer">Retailer</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Pricing Tier</Label>
                    <Select value={form.pricing_tier} onValueChange={v => setForm({ ...form, pricing_tier: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="wholesale">Wholesale</SelectItem>
                        <SelectItem value="dealer">Dealer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+254..." />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                  </div>
                </div>
                <div>
                  <Label>Opening Balance (KES)</Label>
                  <Input type="number" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!form.name || createParty.isPending}>
                  {createParty.isPending ? 'Creating...' : 'Create Party'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Payables</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">KES {totalPayables.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">You owe</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Suppliers</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{suppliers.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Dealers</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{dealers.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Wholesalers</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{wholesalers.length}</div></CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search parties..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All ({parties.length})</TabsTrigger>
            <TabsTrigger value="supplier">Suppliers ({suppliers.length})</TabsTrigger>
            <TabsTrigger value="dealer">Dealers ({dealers.length})</TabsTrigger>
            <TabsTrigger value="wholesaler">Wholesalers ({wholesalers.length})</TabsTrigger>
          </TabsList>

          {['all', 'supplier', 'dealer', 'wholesaler'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tab === 'all' ? filtered : filtered.filter(p => p.party_type === tab)).map(party => (
                        <TableRow key={party.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(party.party_type)}
                              {party.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{party.party_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {party.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{party.phone}</div>}
                              {party.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{party.email}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">{party.pricing_tier}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn('font-semibold', party.current_balance > 0 ? 'text-destructive' : 'text-success')}>
                              KES {Math.abs(party.current_balance).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => { setSelectedParty(party); setTxDialogOpen(true); }}>
                                <Wallet className="w-3 h-3 mr-1" />Record
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No parties found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Record Transaction Dialog */}
        <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Transaction - {selectedParty?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={txForm.type} onValueChange={v => setTxForm({ ...txForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PURCHASE">Purchase (You owe more)</SelectItem>
                    <SelectItem value="PAYMENT">Payment (You paid)</SelectItem>
                    <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (KES)</Label>
                <Input type="number" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={txForm.payment_method} onValueChange={v => setTxForm({ ...txForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference</Label>
                <Input value={txForm.reference} onChange={e => setTxForm({ ...txForm, reference: e.target.value })} placeholder="e.g. Invoice #123" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={txForm.notes} onChange={e => setTxForm({ ...txForm, notes: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleRecordTx} className="w-full" disabled={!txForm.amount || recordTransaction.isPending}>
                {recordTransaction.isPending ? 'Recording...' : 'Record Transaction'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Parties;

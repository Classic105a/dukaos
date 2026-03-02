import { useState } from 'react';
import { useBusiness } from '@/hooks/useBusiness';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Store, ChevronDown, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BusinessSwitcher = () => {
  const { businesses, currentBusiness, setCurrentBusiness, createBusiness, isLoading } = useBusiness();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('retail');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createBusiness(newName.trim(), newType);
      toast.success('Business created');
      setShowCreate(false);
      setNewName('');
      setNewType('retail');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create business');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading || businesses.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2 sm:px-3 max-w-[160px]">
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-xs font-medium">
              {currentBusiness?.name || 'Business'}
            </span>
            <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {businesses.map(biz => (
            <DropdownMenuItem
              key={biz.id}
              onClick={() => setCurrentBusiness(biz)}
              className={cn(
                'text-sm flex items-center justify-between',
                currentBusiness?.id === biz.id && 'bg-primary/10 text-primary font-medium'
              )}
            >
              <span className="truncate">{biz.name}</span>
              {currentBusiness?.id === biz.id && <Check className="w-3.5 h-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreate(true)} className="text-sm">
            <Plus className="w-3.5 h-3.5 mr-2" />
            New Business
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Business</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="biz-name">Business Name</Label>
              <Input
                id="biz-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. My Supermarket"
                required
              />
            </div>
            <div>
              <Label htmlFor="biz-type">Business Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger id="biz-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newName.trim()}>
                {creating ? 'Creating...' : 'Create Business'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BusinessSwitcher;

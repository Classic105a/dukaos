import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { useAuth } from '@/hooks/useAuth';
import { useStockMovements } from '@/hooks/useStockMovements';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StockHistoryDialog from '@/components/inventory/StockHistoryDialog';
import BarcodeGenerator from '@/components/inventory/BarcodeGenerator';
import ProfitIntelligence from '@/components/inventory/ProfitIntelligence';
import StockTransferDialog from '@/components/inventory/StockTransferDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Calendar,
  Barcode,
  Edit,
  Filter,
  ScanLine,
  History,
  Share2,
  Trash2,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price: number;
  cost_price: number | null;
  category_id: string | null;
  low_stock_threshold: number | null;
  is_active: boolean;
  image_url: string | null;
  description: string | null;
  branch_id: string | null;
  is_shared_product: boolean;
  categories?: { name: string; color: string } | null;
}

interface InventoryItem {
  id: string;
  product_id: string;
  quantity: number;
  expiry_date: string | null;
  batch_number: string | null;
  products: Product;
  has_real_inventory: boolean;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
}

const Inventory = () => {
  const { currentBranch } = useBranch();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addStock, adjustStock } = useStockMovements();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeGenerator, setShowBarcodeGenerator] = useState(false);
  const [showTransfers, setShowTransfers] = useState(false);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch products for current branch (branch-specific + shared products ONLY)
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      
      // Fetch products visible to this branch (branch-specific OR shared) - NO legacy null branch support
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .or(`branch_id.eq.${currentBranch.id},is_shared_product.eq.true`)
        .order('name')
        .limit(2000);
      
      if (productsError) throw productsError;
      
      // Fetch categories separately
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, color');
      
      const categoriesMap = new Map(
        (categoriesData || []).map(cat => [cat.id, cat])
      );
      
      // Fetch stock from stock_movements view
      const { data: stockData } = await supabase
        .from('current_stock')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .limit(5000);
      
      // Create a map of stock by product_id
      const stockMap = new Map(
        (stockData || []).map(s => [s.product_id, s])
      );
      
      // Combine products with their stock
      return (productsData || []).map(product => {
        const stock = stockMap.get(product.id);
        const quantity = stock?.quantity ?? 0;
        
        return {
          id: product.id, // Use product id directly
          product_id: product.id,
          quantity,
          expiry_date: stock?.latest_expiry_date || null,
          batch_number: stock?.latest_batch_number || null,
          has_real_inventory: !!stock,
          products: {
            ...product,
            categories: product.category_id ? categoriesMap.get(product.category_id) || null : null,
          },
        } as InventoryItem;
      });
    },
    enabled: !!currentBranch?.id,
  });

  // Create product mutation with branch_id
  const createProduct = useMutation({
    mutationFn: async (productData: Partial<Product> & { initialStock?: number }) => {
      if (!currentBranch?.id) throw new Error('No branch selected');
      if (!user?.id) throw new Error('User not authenticated');
      
      const { initialStock, ...productFields } = productData;
      
      // Insert product with branch_id
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: productFields.name!,
          unit_price: productFields.unit_price!,
          business_id: currentBranch.business_id,
          sku: productFields.sku,
          barcode: productFields.barcode,
          cost_price: productFields.cost_price,
          category_id: productFields.category_id,
          low_stock_threshold: productFields.low_stock_threshold,
          description: productFields.description,
          is_shared_product: productFields.is_shared_product,
          branch_id: productFields.is_shared_product ? null : currentBranch.id,
        }] as any)
        .select()
        .single();
      
      if (error) throw error;
      
      // If initial stock is provided, record it as a movement
      if (initialStock && initialStock > 0) {
        await supabase.from('stock_movements').insert({
          product_id: data.id,
          branch_id: currentBranch.id,
          business_id: currentBranch.business_id,
          quantity_change: initialStock,
          movement_type: 'INITIAL',
          created_by: user.id,
          notes: 'Initial stock on product creation',
        } as any);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'Product created successfully' });
      setProductDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating product', description: error.message, variant: 'destructive' });
    },
  });

  // Create category mutation
  const createCategory = useMutation({
    mutationFn: async (categoryData: Partial<Category>) => {
      if (!currentBranch?.business_id) throw new Error('No business');
      const { data, error } = await supabase
        .from('categories')
        .insert([{ ...categoryData, business_id: currentBranch.business_id } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Category created successfully' });
      setCategoryDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating category', description: error.message, variant: 'destructive' });
    },
  });

  // Delete product mutation
  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      if (!currentBranch?.id) throw new Error('No branch selected');
      
      // First delete stock movements for this product
      await supabase
        .from('stock_movements')
        .delete()
        .eq('product_id', productId);
      
      // Then delete the product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'Product deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting product', description: error.message, variant: 'destructive' });
    },
  });

  // Update stock using stock_movements (audit trail)
  const updateStock = useMutation({
    mutationFn: async ({ 
      productId, 
      currentQuantity,
      newQuantity, 
      expiryDate, 
      batchNumber,
      notes,
    }: { 
      productId: string; 
      currentQuantity: number;
      newQuantity: number; 
      expiryDate?: string;
      batchNumber?: string;
      notes?: string;
    }) => {
      if (!currentBranch?.id) throw new Error('No branch selected');
      if (!user?.id) throw new Error('User not authenticated');
      
      // Validate productId is a real UUID
      if (productId.startsWith('temp_') || productId.startsWith('virtual_')) {
        throw new Error('Cannot update stock: product not yet saved');
      }
      
      const difference = newQuantity - currentQuantity;
      
      if (difference === 0 && !batchNumber && !expiryDate) {
        return; // No change needed
      }
      
      // Record the stock movement
      const { error } = await supabase.from('stock_movements').insert({
        product_id: productId,
        branch_id: currentBranch.id,
        business_id: currentBranch.business_id,
        quantity_change: difference,
        movement_type: difference === 0 ? 'ADJUSTMENT' : (difference > 0 ? 'ADD' : 'ADJUSTMENT'),
        batch_number: batchNumber || null,
        expiry_date: expiryDate || null,
        created_by: user.id,
        notes: notes || `Stock ${difference >= 0 ? 'added' : 'adjusted'}: ${currentQuantity} → ${newQuantity}`,
      } as any);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast({ title: 'Stock updated successfully' });
      setStockDialogOpen(false);
      setSelectedProduct(null);
      setSelectedInventoryItem(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating stock', description: error.message, variant: 'destructive' });
    },
  });

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.products.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.products.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.products.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.products.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Low stock items
  const lowStockItems = inventory.filter(item => 
    item.quantity <= (item.products.low_stock_threshold || 10)
  );

  // Expiring items (within 30 days)
  const expiringItems = inventory.filter(item => {
    if (!item.expiry_date) return false;
    const daysUntilExpiry = differenceInDays(new Date(item.expiry_date), new Date());
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  });

  // Handle barcode scan
  const handleBarcodeScan = () => {
    const item = inventory.find(i => i.products.barcode === barcodeInput);
    if (item) {
      setSelectedProduct(item.products);
      setSelectedInventoryItem(item);
      setStockDialogOpen(true);
    } else {
      toast({ title: 'Product not found', description: 'No product matches this barcode', variant: 'destructive' });
    }
    setBarcodeInput('');
  };

  const handleOpenStockDialog = (item: InventoryItem) => {
    // Prevent editing if product isn't saved yet
    if (item.id.startsWith('virtual_') && !item.has_real_inventory) {
      // This is fine - we can still add stock
    }
    setSelectedProduct(item.products);
    setSelectedInventoryItem(item);
    setStockDialogOpen(true);
  };

  const handleOpenHistoryDialog = (item: InventoryItem) => {
    setSelectedProduct(item.products);
    setSelectedInventoryItem(item);
    setHistoryDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">
              Manage products and stock for {currentBranch?.name || 'your branch'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="shrink-0">
                  <Plus className="w-4 h-4 mr-2" />
                  Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Category</DialogTitle>
                </DialogHeader>
                <CategoryForm onSubmit={(data) => createCategory.mutate(data)} />
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="shrink-0" onClick={() => setShowBarcodeGenerator(true)}>
              <Barcode className="w-4 h-4 mr-2" />
              Labels
            </Button>
            <Button variant="outline" className="shrink-0" onClick={() => setShowTransfers(true)}>
              <Truck className="w-4 h-4 mr-2" />
              Transfers
            </Button>
            <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!currentBranch} className="shrink-0">
                  <Plus className="w-4 h-4 mr-2" />
                  Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Product</DialogTitle>
                </DialogHeader>
                <ProductForm 
                  categories={categories} 
                  onSubmit={(data) => createProduct.mutate(data)}
                  isLoading={createProduct.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* No Branch Warning */}
        {!currentBranch && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="p-4">
              <p className="text-warning font-medium">
                Please select a branch to manage inventory
              </p>
            </CardContent>
          </Card>
        )}

        {/* Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={cn(lowStockItems.length > 0 && 'border-warning')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className={cn('w-4 h-4', lowStockItems.length > 0 ? 'text-warning' : 'text-muted-foreground')} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockItems.length}</div>
              <p className="text-xs text-muted-foreground">Items below threshold</p>
            </CardContent>
          </Card>
          <Card className={cn(expiringItems.length > 0 && 'border-destructive')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <Calendar className={cn('w-4 h-4', expiringItems.length > 0 ? 'text-destructive' : 'text-muted-foreground')} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expiringItems.length}</div>
              <p className="text-xs text-muted-foreground">Within 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventory.length}</div>
              <p className="text-xs text-muted-foreground">In this branch</p>
            </CardContent>
          </Card>
        </div>

        {/* Barcode Scanner */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Scan barcode or enter product code..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeScan()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleBarcodeScan} variant="secondary">
                <Barcode className="w-4 h-4 mr-2" />
                Lookup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <TabsList className="max-w-full overflow-x-auto scrollbar-hide justify-start">
              <TabsTrigger value="all">All Products</TabsTrigger>
              <TabsTrigger value="low-stock" className="gap-2">
                Low Stock
                {lowStockItems.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {lowStockItems.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="expiring" className="gap-2">
                Expiring
                {expiringItems.length > 0 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-xs border-warning text-warning">
                    {expiringItems.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="profit">Profit Intel</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="all" className="space-y-4">
            <InventoryTable 
              items={filteredInventory} 
              isLoading={isLoading}
              onUpdateStock={handleOpenStockDialog}
              onViewHistory={handleOpenHistoryDialog}
              onDelete={(item) => deleteProduct.mutate(item.product_id)}
            />
          </TabsContent>

          <TabsContent value="low-stock" className="space-y-4">
            <InventoryTable 
              items={lowStockItems} 
              isLoading={isLoading}
              onUpdateStock={handleOpenStockDialog}
              onViewHistory={handleOpenHistoryDialog}
              onDelete={(item) => deleteProduct.mutate(item.product_id)}
            />
          </TabsContent>

          <TabsContent value="expiring" className="space-y-4">
            <InventoryTable 
              items={expiringItems} 
              isLoading={isLoading}
              onUpdateStock={handleOpenStockDialog}
              onViewHistory={handleOpenHistoryDialog}
              onDelete={(item) => deleteProduct.mutate(item.product_id)}
              showExpiry
            />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(category => (
                <Card key={category.id} className="hover:shadow-soft transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${category.color}20`, color: category.color || '#10B981' }}
                    >
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {inventory.filter(i => i.products.category_id === category.id).length} products
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="profit">
            <ProfitIntelligence />
          </TabsContent>
        </Tabs>

        {/* Stock Update Dialog */}
        <Dialog open={stockDialogOpen} onOpenChange={(open) => {
          setStockDialogOpen(open);
          if (!open) {
            setSelectedProduct(null);
            setSelectedInventoryItem(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Update Stock - {selectedProduct?.name}
                {selectedProduct?.is_shared_product && (
                  <Badge variant="secondary" className="ml-2">
                    <Share2 className="w-3 h-3 mr-1" />
                    Shared
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedProduct && selectedInventoryItem && (
              <StockUpdateForm 
                product={selectedProduct}
                currentStock={selectedInventoryItem}
                branchName={currentBranch?.name || ''}
                onSubmit={(data) => updateStock.mutate({ 
                  productId: selectedProduct.id,
                  currentQuantity: selectedInventoryItem.quantity,
                  ...data 
                })}
                isLoading={updateStock.isPending}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Stock History Dialog */}
        {selectedProduct && currentBranch && (
          <StockHistoryDialog
            isOpen={historyDialogOpen}
            onClose={() => {
              setHistoryDialogOpen(false);
              setSelectedProduct(null);
              setSelectedInventoryItem(null);
            }}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            branchId={currentBranch.id}
            branchName={currentBranch.name}
          />
        )}

        {/* Barcode Generator */}
        <BarcodeGenerator
          isOpen={showBarcodeGenerator}
          onClose={() => setShowBarcodeGenerator(false)}
          products={inventory.map(i => ({
            id: i.product_id,
            name: i.products.name,
            sku: i.products.sku,
            barcode: i.products.barcode,
            unit_price: i.products.unit_price,
          }))}
        />

        {/* Stock Transfer Dialog */}
        <StockTransferDialog
          isOpen={showTransfers}
          onClose={() => setShowTransfers(false)}
        />
      </div>
    </DashboardLayout>
  );
};

// Inventory Table Component
const InventoryTable = ({ 
  items, 
  isLoading, 
  onUpdateStock,
  onViewHistory,
  onDelete,
  showExpiry = false 
}: { 
  items: InventoryItem[]; 
  isLoading: boolean;
  onUpdateStock: (item: InventoryItem) => void;
  onViewHistory: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
  showExpiry?: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Package className="w-12 h-12 mb-2 opacity-50" />
          <p>No products found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 font-medium text-muted-foreground">Product</th>
              <th className="text-left p-4 font-medium text-muted-foreground">SKU</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Category</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Price</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Stock</th>
              {showExpiry && <th className="text-left p-4 font-medium text-muted-foreground">Expiry</th>}
              <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isLowStock = item.quantity <= (item.products.low_stock_threshold || 10);
              const daysUntilExpiry = item.expiry_date 
                ? differenceInDays(new Date(item.expiry_date), new Date())
                : null;
              
              return (
                <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        {item.products.image_url ? (
                          <img 
                            src={item.products.image_url} 
                            alt={item.products.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.products.name}</p>
                          {item.products.is_shared_product && (
                            <span title="Shared product">
                              <Share2 className="w-3 h-3 text-muted-foreground" />
                            </span>
                          )}
                        </div>
                        {item.products.barcode && (
                          <p className="text-xs text-muted-foreground">{item.products.barcode}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{item.products.sku || '-'}</td>
                  <td className="p-4">
                    {item.products.categories && (
                      <Badge 
                        variant="secondary"
                        style={{ 
                          backgroundColor: `${item.products.categories.color}20`,
                          color: item.products.categories.color 
                        }}
                      >
                        {item.products.categories.name}
                      </Badge>
                    )}
                  </td>
                  <td className="p-4 text-right font-medium">
                    KES {item.products.unit_price.toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <Badge variant={isLowStock ? 'destructive' : 'secondary'}>
                      {item.quantity}
                    </Badge>
                  </td>
                  {showExpiry && (
                    <td className="p-4">
                      {item.expiry_date ? (
                        <div className={cn(
                          'text-sm',
                          daysUntilExpiry !== null && daysUntilExpiry <= 7 ? 'text-destructive' : 
                          daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'text-warning' : 'text-muted-foreground'
                        )}>
                          {format(new Date(item.expiry_date), 'MMM d, yyyy')}
                          {daysUntilExpiry !== null && (
                            <span className="block text-xs">
                              {daysUntilExpiry === 0 ? 'Expires today' : 
                               daysUntilExpiry < 0 ? 'Expired' :
                               `${daysUntilExpiry} days left`}
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                  )}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onViewHistory(item)}
                        title="View stock history"
                      >
                        <History className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onUpdateStock(item)}
                        title="Update stock"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {onDelete && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete "${item.products.name}"?`)) {
                              onDelete(item);
                            }
                          }}
                          title="Delete product"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// Product Form Component
const ProductForm = ({ 
  categories, 
  onSubmit,
  isLoading,
}: { 
  categories: Category[];
  onSubmit: (data: Partial<Product> & { initialStock?: number }) => void;
  isLoading?: boolean;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    unit_price: '',
    cost_price: '',
    category_id: '',
    low_stock_threshold: '10',
    description: '',
    is_shared_product: false,
    initialStock: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      sku: formData.sku || null,
      barcode: formData.barcode || null,
      unit_price: parseFloat(formData.unit_price),
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      category_id: formData.category_id || null,
      low_stock_threshold: parseInt(formData.low_stock_threshold),
      description: formData.description || null,
      is_shared_product: formData.is_shared_product,
      initialStock: formData.initialStock ? parseInt(formData.initialStock) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            disabled={isLoading}
          />
        </div>
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            disabled={isLoading}
          />
        </div>
        <div>
          <Label htmlFor="barcode">Barcode</Label>
          <Input
            id="barcode"
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            disabled={isLoading}
          />
        </div>
        <div>
          <Label htmlFor="unit_price">Selling Price (KES) *</Label>
          <Input
            id="unit_price"
            type="number"
            value={formData.unit_price}
            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
            required
            disabled={isLoading}
          />
        </div>
        <div>
          <Label htmlFor="cost_price">Cost Price (KES)</Label>
          <Input
            id="cost_price"
            type="number"
            value={formData.cost_price}
            onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
            disabled={isLoading}
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select 
            value={formData.category_id} 
            onValueChange={(v) => setFormData({ ...formData, category_id: v })}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="threshold">Low Stock Threshold</Label>
          <Input
            id="threshold"
            type="number"
            value={formData.low_stock_threshold}
            onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
            disabled={isLoading}
          />
        </div>
        <div>
          <Label htmlFor="initialStock">Initial Stock</Label>
          <Input
            id="initialStock"
            type="number"
            value={formData.initialStock}
            onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
            placeholder="0"
            disabled={isLoading}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="shared"
            checked={formData.is_shared_product}
            onCheckedChange={(checked) => setFormData({ ...formData, is_shared_product: checked })}
            disabled={isLoading}
          />
          <Label htmlFor="shared" className="flex items-center gap-1 cursor-pointer">
            <Share2 className="w-4 h-4" />
            Shared across branches
          </Label>
        </div>
        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            disabled={isLoading}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Product'}
      </Button>
    </form>
  );
};

// Category Form Component
const CategoryForm = ({ onSubmit }: { onSubmit: (data: Partial<Category>) => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    color: '#10B981',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Category Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>Color</Label>
        <div className="flex gap-2 mt-2">
          {colors.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-transform',
                formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>
      <Button type="submit" className="w-full">Create Category</Button>
    </form>
  );
};

// Stock Update Form Component
const ADJUSTMENT_REASONS = [
  { value: 'recount', label: 'Physical Recount' },
  { value: 'damage', label: 'Damaged / Broken' },
  { value: 'expired', label: 'Expired' },
  { value: 'theft', label: 'Theft / Shrinkage' },
  { value: 'restock', label: 'Restock / Purchase' },
  { value: 'correction', label: 'Data Correction' },
  { value: 'other', label: 'Other' },
];

const StockUpdateForm = ({ 
  product, 
  currentStock,
  branchName,
  onSubmit,
  isLoading,
}: { 
  product: Product;
  currentStock: InventoryItem;
  branchName: string;
  onSubmit: (data: { newQuantity: number; expiryDate?: string; batchNumber?: string; notes?: string }) => void;
  isLoading?: boolean;
}) => {
  const [formData, setFormData] = useState({
    newQuantity: currentStock.quantity.toString(),
    expiryDate: currentStock.expiry_date || '',
    batchNumber: currentStock.batch_number || '',
    reason: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reasonLabel = ADJUSTMENT_REASONS.find(r => r.value === formData.reason)?.label || formData.reason;
    const fullNotes = reasonLabel 
      ? `[${reasonLabel}] ${formData.notes}`.trim()
      : formData.notes;
    onSubmit({
      newQuantity: parseInt(formData.newQuantity),
      expiryDate: formData.expiryDate || undefined,
      batchNumber: formData.batchNumber || undefined,
      notes: fullNotes || undefined,
    });
  };

  const quantityDiff = parseInt(formData.newQuantity || '0') - currentStock.quantity;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-muted rounded-lg text-sm">
        <p><strong>Branch:</strong> {branchName}</p>
        <p><strong>Current Stock:</strong> {currentStock.quantity}</p>
      </div>
      
      <div>
        <Label htmlFor="newQuantity">New Quantity *</Label>
        <Input
          id="newQuantity"
          type="number"
          value={formData.newQuantity}
          onChange={(e) => setFormData({ ...formData, newQuantity: e.target.value })}
          required
          disabled={isLoading}
        />
        {quantityDiff !== 0 && (
          <p className={cn(
            'text-sm mt-1',
            quantityDiff > 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {quantityDiff > 0 ? '+' : ''}{quantityDiff} units
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="reason">Reason for Change *</Label>
        <Select 
          value={formData.reason} 
          onValueChange={(v) => setFormData({ ...formData, reason: v })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select reason..." />
          </SelectTrigger>
          <SelectContent>
            {ADJUSTMENT_REASONS.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="batchNumber">Batch Number</Label>
        <Input
          id="batchNumber"
          value={formData.batchNumber}
          onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
          disabled={isLoading}
        />
      </div>
      <div>
        <Label htmlFor="expiryDate">Expiry Date</Label>
        <Input
          id="expiryDate"
          type="date"
          value={formData.expiryDate}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
          disabled={isLoading}
        />
      </div>
      <div>
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          placeholder="Any additional details..."
          disabled={isLoading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || !formData.reason}>
        {isLoading ? 'Updating...' : 'Update Stock'}
      </Button>
    </form>
  );
};

export default Inventory;

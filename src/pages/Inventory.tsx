import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Trash2,
  Filter,
  ScanLine,
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
  categories?: { name: string; color: string } | null;
}

interface InventoryItem {
  id: string;
  product_id: string;
  quantity: number;
  expiry_date: string | null;
  batch_number: string | null;
  products: Product;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
}

const Inventory = () => {
  const { currentBranch } = useBranch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');

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

  // Fetch all products with their inventory for current branch
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      
      // Fetch all active products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*, categories(name, color)')
        .eq('is_active', true)
        .order('name');
      
      if (productsError) throw productsError;
      
      // Fetch inventory for current branch
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('branch_inventory')
        .select('*')
        .eq('branch_id', currentBranch.id);
      
      if (inventoryError) throw inventoryError;
      
      // Create a map of inventory by product_id
      const inventoryMap = new Map(
        inventoryData?.map(inv => [inv.product_id, inv]) || []
      );
      
      // Combine products with their inventory (defaulting to 0 if no record)
      return (productsData || []).map(product => {
        const inv = inventoryMap.get(product.id);
        return {
          id: inv?.id || `temp_${product.id}`,
          product_id: product.id,
          quantity: inv?.quantity || 0,
          expiry_date: inv?.expiry_date || null,
          batch_number: inv?.batch_number || null,
          products: product
        } as InventoryItem;
      });
    },
    enabled: !!currentBranch?.id,
  });

  // Fetch all products
  const { data: allProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name, color)')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
  });

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: async (productData: Partial<Product>) => {
      const { data, error } = await supabase
        .from('products')
        .insert([productData as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
      const { data, error } = await supabase
        .from('categories')
        .insert([categoryData as any])
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

  // Update stock mutation
  const updateStock = useMutation({
    mutationFn: async ({ productId, quantity, expiryDate, batchNumber }: { 
      productId: string; 
      quantity: number; 
      expiryDate?: string;
      batchNumber?: string;
    }) => {
      if (!currentBranch?.id) throw new Error('No branch selected');
      
      const existing = inventory.find(i => i.product_id === productId);
      
      if (existing) {
        const { error } = await supabase
          .from('branch_inventory')
          .update({ 
            quantity, 
            expiry_date: expiryDate || null,
            batch_number: batchNumber || null,
            last_restocked_at: new Date().toISOString() 
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('branch_inventory')
          .insert({
            branch_id: currentBranch.id,
            product_id: productId,
            quantity,
            expiry_date: expiryDate || null,
            batch_number: batchNumber || null,
            last_restocked_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'Stock updated successfully' });
      setStockDialogOpen(false);
      setSelectedProduct(null);
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
    const product = allProducts.find(p => p.barcode === barcodeInput);
    if (product) {
      setSelectedProduct(product);
      setStockDialogOpen(true);
    } else {
      toast({ title: 'Product not found', description: 'No product matches this barcode', variant: 'destructive' });
    }
    setBarcodeInput('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">
              Manage products, stock levels, and categories for {currentBranch?.name || 'your branch'}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
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
            <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Product</DialogTitle>
                </DialogHeader>
                <ProductForm 
                  categories={categories} 
                  onSubmit={(data) => createProduct.mutate(data)} 
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
            <TabsList>
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
              onUpdateStock={(product) => {
                setSelectedProduct(product);
                setStockDialogOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="low-stock" className="space-y-4">
            <InventoryTable 
              items={lowStockItems} 
              isLoading={isLoading}
              onUpdateStock={(product) => {
                setSelectedProduct(product);
                setStockDialogOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="expiring" className="space-y-4">
            <InventoryTable 
              items={expiringItems} 
              isLoading={isLoading}
              onUpdateStock={(product) => {
                setSelectedProduct(product);
                setStockDialogOpen(true);
              }}
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
        </Tabs>

        {/* Stock Update Dialog */}
        <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Stock - {selectedProduct?.name}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <StockUpdateForm 
                product={selectedProduct}
                currentStock={inventory.find(i => i.product_id === selectedProduct.id)}
                onSubmit={(data) => updateStock.mutate({ 
                  productId: selectedProduct.id, 
                  ...data 
                })}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Inventory Table Component
const InventoryTable = ({ 
  items, 
  isLoading, 
  onUpdateStock,
  showExpiry = false 
}: { 
  items: InventoryItem[]; 
  isLoading: boolean;
  onUpdateStock: (product: Product) => void;
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
                        <p className="font-medium">{item.products.name}</p>
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
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onUpdateStock(item.products)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
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
  onSubmit 
}: { 
  categories: Category[];
  onSubmit: (data: Partial<Product>) => void;
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
          />
        </div>
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="barcode">Barcode</Label>
          <Input
            id="barcode"
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
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
          />
        </div>
        <div>
          <Label htmlFor="cost_price">Cost Price (KES)</Label>
          <Input
            id="cost_price"
            type="number"
            value={formData.cost_price}
            onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
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
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>
      </div>
      <Button type="submit" className="w-full">Create Product</Button>
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
const StockUpdateForm = ({ 
  product, 
  currentStock,
  onSubmit 
}: { 
  product: Product;
  currentStock?: InventoryItem;
  onSubmit: (data: { quantity: number; expiryDate?: string; batchNumber?: string }) => void;
}) => {
  const [formData, setFormData] = useState({
    quantity: currentStock?.quantity?.toString() || '0',
    expiryDate: currentStock?.expiry_date || '',
    batchNumber: currentStock?.batch_number || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      quantity: parseInt(formData.quantity),
      expiryDate: formData.expiryDate || undefined,
      batchNumber: formData.batchNumber || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="quantity">Quantity *</Label>
        <Input
          id="quantity"
          type="number"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="batchNumber">Batch Number</Label>
        <Input
          id="batchNumber"
          value={formData.batchNumber}
          onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="expiryDate">Expiry Date</Label>
        <Input
          id="expiryDate"
          type="date"
          value={formData.expiryDate}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full">Update Stock</Button>
    </form>
  );
};

export default Inventory;

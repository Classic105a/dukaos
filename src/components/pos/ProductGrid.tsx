import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Barcode, Package, Plus, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  unit_price: number;
  image_url: string | null;
  category_id: string | null;
  category?: { name: string; color: string } | null;
  stock?: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface ProductGridProps {
  onProductSelect: (product: Product) => void;
}

const ProductGrid = ({ onProductSelect }: ProductGridProps) => {
  const { currentBranch } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [currentBranch?.id]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, color')
      .eq('is_active', true)
      .order('name');
    
    setCategories(data || []);
  };

  const fetchProducts = async () => {
    if (!currentBranch?.id) return;

    setLoading(true);
    try {
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          id,
          name,
          barcode,
          unit_price,
          image_url,
          category_id,
          categories (name, color)
        `)
        .eq('is_active', true)
        .order('name');

      const { data: inventoryData } = await supabase
        .from('branch_inventory')
        .select('product_id, quantity')
        .eq('branch_id', currentBranch.id);

      const inventoryMap = new Map(
        inventoryData?.map(inv => [inv.product_id, inv.quantity]) || []
      );

      const productsWithStock = productsData?.map(product => ({
        ...product,
        category: product.categories,
        stock: inventoryMap.get(product.id) || 0
      })) || [];

      setProducts(productsWithStock);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeSearch = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      onProductSelect(product);
      setSearchQuery('');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.barcode?.includes(searchQuery);
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (/^\d{8,13}$/.test(e.target.value)) {
                handleBarcodeSearch(e.target.value);
              }
            }}
            className="pl-9 h-11 bg-card border-border rounded-xl text-sm"
          />
        </div>
        <Button variant="secondary" size="icon" className="shrink-0 h-11 w-11 rounded-xl">
          <ScanLine className="w-5 h-5" />
        </Button>
      </div>

      {/* Category Filter - Scrollable pills */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
            selectedCategory === null 
              ? 'bg-primary text-primary-foreground shadow-md' 
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          )}
        >
          All Items
        </button>
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
              selectedCategory === category.id 
                ? 'text-white shadow-md' 
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
            style={{
              backgroundColor: selectedCategory === category.id ? category.color : undefined,
            }}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Products */}
      <ScrollArea className="flex-1 -mx-3 px-3">
        {loading ? (
          <>
            {/* Mobile loading skeleton */}
            <div className="flex flex-col gap-2 lg:hidden">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-secondary animate-pulse rounded-xl h-20" />
              ))}
            </div>
            {/* Desktop loading skeleton */}
            <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-secondary animate-pulse rounded-xl h-32" />
              ))}
            </div>
          </>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-3">
              <Package className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-sm font-medium text-foreground">No products found</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different search or category</p>
          </div>
        ) : (
          <>
            {/* Mobile/Tablet List View */}
            <div className="flex flex-col gap-2 lg:hidden pb-32">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className={cn(
                    'bg-card rounded-xl border border-border flex items-center gap-3 p-3 transition-all',
                    product.stock === 0 ? 'opacity-50' : 'active:scale-[0.99]'
                  )}
                >
                  {/* Product Image */}
                  <div className="w-14 h-14 rounded-lg bg-secondary flex-shrink-0 overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <button
                    onClick={() => onProductSelect(product)}
                    className="flex-1 min-w-0 text-left"
                    disabled={product.stock === 0}
                  >
                    <h3 className="font-semibold text-sm truncate text-foreground">{product.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.category && (
                        <span 
                          className="text-xs font-medium"
                          style={{ color: product.category.color }}
                        >
                          {product.category.name}
                        </span>
                      )}
                      <span className={cn(
                        'text-xs',
                        product.stock === 0 ? 'text-destructive font-medium' : 'text-muted-foreground'
                      )}>
                        {product.stock === 0 ? 'Out of stock' : `${product.stock} in stock`}
                      </span>
                    </div>
                  </button>

                  {/* Price & Add Button */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="font-bold text-primary text-base tabular-nums">
                        {product.unit_price.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground block">KES</span>
                    </div>
                    <Button
                      size="icon"
                      variant="accent"
                      className="h-10 w-10 rounded-xl shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onProductSelect(product);
                      }}
                      disabled={product.stock === 0}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Grid View */}
            <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => onProductSelect(product)}
                  disabled={product.stock === 0}
                  className={cn(
                    'bg-card rounded-xl p-3 text-left transition-all border border-border hover:shadow-elevated hover:border-primary/30 active:scale-[0.98] group',
                    product.stock === 0 && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {product.image_url ? (
                    <div className="w-full aspect-square rounded-lg mb-2 overflow-hidden bg-secondary">
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-lg mb-2 bg-secondary flex items-center justify-center">
                      <Package className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1.5 leading-tight">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary tabular-nums text-base">
                      KES {product.unit_price.toLocaleString()}
                    </span>
                    <Badge 
                      variant={product.stock && product.stock > 0 ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {product.stock || 0}
                    </Badge>
                  </div>
                  {product.category && (
                    <div 
                      className="mt-2 text-xs px-2 py-1 rounded-md inline-block font-medium"
                      style={{ 
                        backgroundColor: `${product.category.color}15`,
                        color: product.category.color
                      }}
                    >
                      {product.category.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
};

export default ProductGrid;
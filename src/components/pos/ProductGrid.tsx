import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Barcode, Package, Plus } from 'lucide-react';
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
            placeholder="Search or scan barcode..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (/^\d{8,13}$/.test(e.target.value)) {
                handleBarcodeSearch(e.target.value);
              }
            }}
            className="pl-9 h-10 bg-card"
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0 h-10 w-10">
          <Barcode className="w-4 h-4" />
        </Button>
      </div>

      {/* Category Filter - Scrollable pills */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            selectedCategory === null 
              ? 'bg-primary text-primary-foreground shadow-soft' 
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          )}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              selectedCategory === category.id 
                ? 'text-white shadow-soft' 
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
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <>
            {/* Mobile loading skeleton */}
            <div className="flex flex-col gap-1.5 sm:hidden">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-secondary animate-pulse rounded-lg h-14" />
              ))}
            </div>
            {/* Desktop loading skeleton */}
            <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-secondary animate-pulse rounded-xl h-28" />
              ))}
            </div>
          </>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Package className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm font-medium">No products found</p>
          </div>
        ) : (
          <>
            {/* Mobile List View */}
            <div className="flex flex-col gap-1.5 sm:hidden">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className={cn(
                    'bg-card rounded-lg border border-border flex items-center gap-2 p-2 transition-all',
                    product.stock === 0 ? 'opacity-50' : 'active:scale-[0.98]'
                  )}
                >
                  <button
                    onClick={() => onProductSelect(product)}
                    className="flex-1 min-w-0 text-left py-1"
                    disabled={product.stock === 0}
                  >
                    <h3 className="font-medium text-sm truncate">{product.name}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      {product.category && (
                        <span style={{ color: product.category.color }}>
                          {product.category.name}
                        </span>
                      )}
                      <span className={cn(
                        'text-muted-foreground',
                        product.stock === 0 && 'text-destructive'
                      )}>
                        Stock: {product.stock || 0}
                      </span>
                    </div>
                  </button>
                  <span className="font-bold text-primary text-sm shrink-0 tabular-nums">
                    {product.unit_price.toLocaleString()}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="accent"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProductSelect(product);
                    }}
                    disabled={product.stock === 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Desktop Grid View */}
            <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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
                      <Package className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <h3 className="font-medium text-sm line-clamp-2 mb-1 leading-tight">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary tabular-nums">
                      {product.unit_price.toLocaleString()}
                    </span>
                    <Badge 
                      variant={product.stock && product.stock > 0 ? 'secondary' : 'destructive'}
                      className="text-2xs h-5"
                    >
                      {product.stock || 0}
                    </Badge>
                  </div>
                  {product.category && (
                    <div 
                      className="mt-1.5 text-2xs px-1.5 py-0.5 rounded inline-block font-medium"
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
      </div>
    </div>
  );
};

export default ProductGrid;
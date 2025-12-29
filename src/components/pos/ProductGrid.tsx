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
      // Fetch products with their inventory for current branch
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

      // Fetch inventory for current branch
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
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products or scan barcode..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Check if it's a barcode (numeric and specific length)
              if (/^\d{8,13}$/.test(e.target.value)) {
                handleBarcodeSearch(e.target.value);
              }
            }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0">
          <Barcode className="w-4 h-4" />
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        <Button
          size="sm"
          variant={selectedCategory === null ? 'default' : 'outline'}
          onClick={() => setSelectedCategory(null)}
          className="shrink-0"
        >
          All
        </Button>
        {categories.map(category => (
          <Button
            key={category.id}
            size="sm"
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(category.id)}
            className="shrink-0"
            style={{
              backgroundColor: selectedCategory === category.id ? category.color : undefined,
              borderColor: category.color
            }}
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Products - List on mobile, Grid on desktop */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <>
            {/* Mobile loading skeleton - list */}
            <div className="flex flex-col gap-2 sm:hidden">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-muted animate-pulse rounded-lg h-14" />
              ))}
            </div>
            {/* Desktop loading skeleton - grid */}
            <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-muted animate-pulse rounded-xl h-32" />
              ))}
            </div>
          </>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Package className="w-12 h-12 mb-2" />
            <p>No products found</p>
          </div>
        ) : (
          <>
            {/* Mobile List View - No photos, with quick-add button */}
            <div className="flex flex-col gap-2 sm:hidden">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className={cn(
                    'bg-card rounded-lg p-3 transition-all border border-border flex items-center justify-between gap-2',
                    product.stock === 0 && 'opacity-50'
                  )}
                >
                  <button
                    onClick={() => onProductSelect(product)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <h3 className="font-medium text-sm truncate">{product.name}</h3>
                    <div className="flex items-center gap-2">
                      {product.category && (
                        <span 
                          className="text-xs"
                          style={{ color: product.category.color }}
                        >
                          {product.category.name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Stock: {product.stock || 0}
                      </span>
                    </div>
                  </button>
                  <span className="font-bold text-primary text-sm shrink-0">
                    KES {product.unit_price.toLocaleString()}
                  </span>
                  <Button
                    size="icon"
                    variant="default"
                    className="h-8 w-8 shrink-0"
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

            {/* Desktop Grid View - With photos */}
            <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => onProductSelect(product)}
                  className={cn(
                    'bg-card rounded-xl p-3 text-left transition-all hover:shadow-soft hover:scale-[1.02] active:scale-[0.98] border border-border',
                    product.stock === 0 && 'opacity-50'
                  )}
                >
                  {product.image_url ? (
                    <div className="w-full h-16 rounded-lg mb-2 overflow-hidden bg-muted">
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-16 rounded-lg mb-2 bg-muted flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">
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
                      className="mt-2 text-xs px-2 py-0.5 rounded-full inline-block"
                      style={{ 
                        backgroundColor: `${product.category.color}20`,
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

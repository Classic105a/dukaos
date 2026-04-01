import { useState, useEffect, useCallback, useRef } from 'react';
import { useOfflineDB, type OfflineProduct } from '@/hooks/useOfflineDB';
import { Input } from '@/components/ui/input';
import { Search, Package, ScanLine, WifiOff } from 'lucide-react';
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

interface ProductGridProps {
  onProductSelect: (product: Product) => void;
  refreshKey?: number;
}

const ProductGrid = ({ onProductSelect, refreshKey }: ProductGridProps) => {
  const { products, categories, loading, dataSource, refreshLocalData } = useOfflineDB();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (refreshKey && refreshKey > 0) refreshLocalData();
  }, [refreshKey, refreshLocalData]);

  // Auto-focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const handleBarcodeSearch = useCallback((barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      onProductSelect(product as Product);
      setSearchQuery('');
    }
  }, [products, onProductSelect]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.barcode?.includes(searchQuery);
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search — auto-focused, instant results */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search or scan barcode..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (/^\d{8,13}$/.test(e.target.value)) {
                handleBarcodeSearch(e.target.value);
              }
            }}
            className="pl-10 h-10 bg-card border-border rounded-lg text-sm"
          />
        </div>
        <button className="shrink-0 h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <ScanLine className="w-5 h-5" />
        </button>
      </div>

      {/* Offline indicator */}
      {dataSource === 'cache' && (
        <div className="flex items-center gap-1.5 mb-1 px-1">
          <WifiOff className="w-3 h-3 text-destructive" />
          <span className="text-[10px] text-destructive font-medium">OFFLINE MODE</span>
        </div>
      )}

      {/* Category tabs — horizontal scroll */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
            selectedCategory === null
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              selectedCategory === category.id
                ? 'text-white'
                : 'bg-secondary text-secondary-foreground'
            )}
            style={{ backgroundColor: selectedCategory === category.id ? category.color : undefined }}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto -mx-3 px-3">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-secondary/50 rounded-lg h-24 animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Package className="w-10 h-10 opacity-20 mb-2" />
            <p className="text-sm font-medium">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 pb-32 lg:pb-4">
            {filteredProducts.map(product => {
              const outOfStock = (product.stock ?? 0) <= 0;
              return (
                <button
                  key={product.id}
                  onClick={() => onProductSelect(product as Product)}
                  disabled={outOfStock}
                  className={cn(
                    'bg-card rounded-lg p-2.5 text-left border border-border/50 active:scale-[0.97] transition-transform',
                    outOfStock && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {/* Product image */}
                  {product.image_url ? (
                    <div className="w-full aspect-[4/3] rounded-md mb-1.5 overflow-hidden bg-secondary">
                      <img src={product.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="w-full aspect-[4/3] rounded-md mb-1.5 bg-secondary/50 flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground/20" />
                    </div>
                  )}
                  <h3 className="font-medium text-xs line-clamp-1 leading-tight">{product.name}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-primary text-sm tabular-nums">
                      {product.unit_price.toLocaleString()}
                    </span>
                    <span className={cn(
                      'text-[10px] tabular-nums',
                      outOfStock ? 'text-destructive font-bold' : 'text-muted-foreground'
                    )}>
                      {outOfStock ? 'OUT' : product.stock}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductGrid;

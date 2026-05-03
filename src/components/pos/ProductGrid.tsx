import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

// Memoized product card to prevent re-renders
const ProductCard = memo(({ product, onSelect }: { product: OfflineProduct; onSelect: (p: Product) => void }) => {
  const outOfStock = (product.stock ?? 0) <= 0;
  return (
    <button
      onClick={() => onSelect(product as Product)}
      disabled={outOfStock}
      className={cn(
        'bg-card rounded-lg p-2 text-left border border-border/40 active:scale-[0.95] transition-transform relative',
        outOfStock && 'opacity-30 cursor-not-allowed'
      )}
    >
      {outOfStock && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="bg-destructive text-destructive-foreground text-[10px] font-black px-2 py-0.5 rounded uppercase">Out of Stock</span>
        </div>
      )}
      {product.image_url ? (
        <div className="w-full aspect-square rounded-md mb-1 overflow-hidden bg-secondary">
          <img src={product.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="w-full aspect-square rounded-md mb-1 bg-secondary/40 flex items-center justify-center">
          <Package className="w-5 h-5 text-muted-foreground/15" />
        </div>
      )}
      <p className="font-medium text-[11px] line-clamp-1 leading-tight">{product.name}</p>
      <div className="flex items-center justify-between mt-0.5">
        <span className="font-bold text-primary text-xs tabular-nums">{product.unit_price.toLocaleString()}</span>
        {!outOfStock && <span className="text-[9px] text-muted-foreground tabular-nums">{product.stock}</span>}
      </div>
    </button>
  );
});
ProductCard.displayName = 'ProductCard';

const ProductGrid = ({ onProductSelect, refreshKey }: ProductGridProps) => {
  const { products, categories, loading, dataSource, refreshLocalData } = useOfflineDB();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (refreshKey && refreshKey > 0) refreshLocalData();
  }, [refreshKey, refreshLocalData]);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const handleBarcodeSearch = useCallback((barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      onProductSelect(product as Product);
      setSearchQuery('');
    }
  }, [products, onProductSelect]);

  // Filter — memoized so virtualization stays stable across renders
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter(product => {
      if (selectedCategory && product.category_id !== selectedCategory) return false;
      if (!q) return true;
      return product.name.toLowerCase().includes(q) || (product.barcode && product.barcode.includes(searchQuery));
    });
  }, [products, selectedCategory, searchQuery]);

  // Virtualization for large catalogs (>300 items). 3 cols on mobile.
  const scrollRef = useRef<HTMLDivElement>(null);
  const COLS = 3;
  const ROW_HEIGHT = 132; // ~card height incl. gap
  const useVirtual = filteredProducts.length > 300;
  const rowCount = Math.ceil(filteredProducts.length / COLS);
  const rowVirtualizer = useVirtualizer({
    count: useVirtual ? rowCount : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 4,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="flex gap-1.5 mb-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search or scan..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (/^\d{8,13}$/.test(e.target.value)) handleBarcodeSearch(e.target.value);
            }}
            className="pl-9 h-9 bg-card border-border rounded-lg text-sm"
          />
        </div>
        <button className="shrink-0 h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-95">
          <ScanLine className="w-4 h-4" />
        </button>
      </div>

      {/* Offline badge */}
      {dataSource === 'cache' && (
        <div className="flex items-center gap-1 mb-1">
          <WifiOff className="w-2.5 h-2.5 text-destructive" />
          <span className="text-[9px] text-destructive font-bold uppercase">Offline</span>
        </div>
      )}

      {/* Categories */}
      <div className="flex gap-1 mb-1.5 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'shrink-0 px-2.5 py-1 rounded text-[11px] font-medium',
            !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          )}
        >All</button>
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={cn(
              'shrink-0 px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap',
              selectedCategory === c.id ? 'text-white' : 'bg-secondary text-secondary-foreground'
            )}
            style={{ backgroundColor: selectedCategory === c.id ? c.color : undefined }}
          >{c.name}</button>
        ))}
      </div>

      {/* Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto -mx-2 px-2">
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => <div key={i} className="bg-secondary/40 rounded-lg aspect-square animate-pulse" />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Package className="w-8 h-8 opacity-15 mb-1" />
            <p className="text-xs">No products found</p>
          </div>
        ) : useVirtual ? (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }} className="pb-32 lg:pb-2">
            {rowVirtualizer.getVirtualItems().map(vRow => {
              const startIdx = vRow.index * COLS;
              const rowItems = filteredProducts.slice(startIdx, startIdx + COLS);
              return (
                <div
                  key={vRow.key}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${vRow.start}px)`, height: ROW_HEIGHT }}
                  className="grid grid-cols-3 gap-1.5 px-0"
                >
                  {rowItems.map(p => <ProductCard key={p.id} product={p} onSelect={onProductSelect} />)}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 pb-32 lg:pb-2">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} onSelect={onProductSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductGrid;

/** Buying (cost) price may never exceed selling price — no loss-making products. */
export const priceError = (selling: number, cost: number | null): string | null => {
  if (cost == null || !Number.isFinite(cost) || !Number.isFinite(selling)) return null;
  if (cost > selling) {
    return `Buying price (KES ${cost.toLocaleString()}) cannot be greater than selling price (KES ${selling.toLocaleString()}).`;
  }
  return null;
};

export const marginInfo = (selling: number, cost: number | null) => {
  if (cost == null || !Number.isFinite(cost) || !Number.isFinite(selling) || selling <= 0) return null;
  const profit = selling - cost;
  return { profit, percent: (profit / selling) * 100 };
};

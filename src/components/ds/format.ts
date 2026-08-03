/** Single money formatter for the whole app. */
export const money = (amount: number | null | undefined, opts?: { compact?: boolean }) => {
  const value = Number(amount ?? 0);
  if (opts?.compact && Math.abs(value) >= 10_000) {
    return `KES ${new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
  }
  return `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const percentDelta = (current: number, previous: number): number | null => {
  if (!previous) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};
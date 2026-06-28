// Feature flags — flip to `false` (or set the matching VITE_FEATURE_* env to "0")
// to trim ERP modules that aren't needed for a lean POS deployment.
// Reads at build time so dead routes can be hidden from navigation immediately.

const read = (key: string, fallback: boolean): boolean => {
  const raw = (import.meta as any).env?.[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return !(raw === '0' || raw === 'false' || raw === false);
};

export const FEATURES = {
  warehouse: read('VITE_FEATURE_WAREHOUSE', true),
  smartInventory: read('VITE_FEATURE_SMART_INVENTORY', true),
  promotions: read('VITE_FEATURE_PROMOTIONS', true),
  installments: read('VITE_FEATURE_INSTALLMENTS', true),
  legalCases: read('VITE_FEATURE_LEGAL_CASES', true),
  parties: read('VITE_FEATURE_PARTIES', true),
} as const;

export type FeatureKey = keyof typeof FEATURES;
export const isFeatureEnabled = (key: FeatureKey) => FEATURES[key];
import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from './useBranch';

interface TaxSettings {
  vatRate: number; // Default 16% VAT in Kenya
  taxInclusive: boolean; // Whether prices include tax
  enableTax: boolean;
}

interface TaxContextType {
  settings: TaxSettings;
  updateSettings: (settings: Partial<TaxSettings>) => void;
  calculateTax: (subtotal: number) => { tax: number; total: number };
  loading: boolean;
}

const defaultSettings: TaxSettings = {
  vatRate: 16, // Kenya VAT rate
  taxInclusive: true, // Prices usually include VAT in Kenya
  enableTax: true,
};

const TaxContext = createContext<TaxContextType | undefined>(undefined);

export const TaxProvider = ({ children }: { children: ReactNode }) => {
  const { currentBranch } = useBranch();
  const [settings, setSettings] = useState<TaxSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (!currentBranch?.id) {
        setLoading(false);
        return;
      }

      // Load from localStorage for this branch
      const stored = localStorage.getItem(`tax_settings_${currentBranch.id}`);
      if (stored) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(stored) });
        } catch {
          setSettings(defaultSettings);
        }
      }
      setLoading(false);
    };

    loadSettings();
  }, [currentBranch?.id]);

  const updateSettings = useCallback((newSettings: Partial<TaxSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (currentBranch?.id) {
        localStorage.setItem(`tax_settings_${currentBranch.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [currentBranch?.id]);

  const calculateTax = useCallback((subtotal: number) => {
    if (!settings.enableTax) {
      return { tax: 0, total: subtotal };
    }

    const rate = settings.vatRate / 100;

    if (settings.taxInclusive) {
      // Price includes tax - extract tax from subtotal
      const tax = subtotal - (subtotal / (1 + rate));
      return { tax: Math.round(tax * 100) / 100, total: subtotal };
    } else {
      // Price excludes tax - add tax to subtotal
      const tax = subtotal * rate;
      return { tax: Math.round(tax * 100) / 100, total: subtotal + tax };
    }
  }, [settings]);

  return (
    <TaxContext.Provider value={{ settings, updateSettings, calculateTax, loading }}>
      {children}
    </TaxContext.Provider>
  );
};

export const useTaxSettings = () => {
  const context = useContext(TaxContext);
  if (context === undefined) {
    throw new Error('useTaxSettings must be used within a TaxProvider');
  }
  return context;
};

-- Enable trigram extension for fast ILIKE '%term%' searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for partial-match search on name, phone, email
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON public.customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
  ON public.customers USING gin (phone gin_trgm_ops)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON public.customers USING gin (email gin_trgm_ops)
  WHERE email IS NOT NULL;

-- Listing/sort path: per-business, ordered by top purchases
CREATE INDEX IF NOT EXISTS idx_customers_business_purchases
  ON public.customers (business_id, total_purchases DESC NULLS LAST);

-- Segment filter path
CREATE INDEX IF NOT EXISTS idx_customers_business_segment_purchases
  ON public.customers (business_id, segment, total_purchases DESC NULLS LAST)
  WHERE segment IS NOT NULL;

-- Add extended business details to branches table
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS mpesa_till_number text,
ADD COLUMN IF NOT EXISTS mpesa_paybill_number text,
ADD COLUMN IF NOT EXISTS mpesa_account_number text,
ADD COLUMN IF NOT EXISTS business_registration_number text,
ADD COLUMN IF NOT EXISTS kra_pin text,
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS opening_hours text,
ADD COLUMN IF NOT EXISTS receipt_footer_message text;

-- Create receipt_settings table for configurable receipt elements
CREATE TABLE IF NOT EXISTS public.receipt_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  
  -- Header elements
  show_logo boolean DEFAULT true,
  show_business_name boolean DEFAULT true,
  show_branch_name boolean DEFAULT true,
  show_address boolean DEFAULT true,
  show_phone boolean DEFAULT true,
  show_email boolean DEFAULT false,
  show_website boolean DEFAULT false,
  
  -- Payment details
  show_mpesa_till boolean DEFAULT true,
  show_mpesa_paybill boolean DEFAULT true,
  show_kra_pin boolean DEFAULT true,
  
  -- Receipt body
  show_cashier_name boolean DEFAULT true,
  show_customer_name boolean DEFAULT true,
  show_date_time boolean DEFAULT true,
  show_receipt_number boolean DEFAULT true,
  show_item_sku boolean DEFAULT false,
  show_item_tax boolean DEFAULT false,
  show_subtotal boolean DEFAULT true,
  show_total_tax boolean DEFAULT true,
  show_discount boolean DEFAULT true,
  
  -- Footer
  show_footer_message boolean DEFAULT true,
  footer_message text DEFAULT 'Thank you for your business!',
  show_return_policy boolean DEFAULT false,
  return_policy text,
  
  -- Paper size
  paper_width text DEFAULT '80mm',
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(branch_id)
);

-- Create printer_configurations table
CREATE TABLE IF NOT EXISTS public.printer_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  
  -- Connection type: 'bluetooth', 'usb', 'ethernet'
  connection_type text NOT NULL,
  
  -- Bluetooth settings
  bluetooth_device_id text,
  bluetooth_device_name text,
  
  -- USB settings
  usb_vendor_id text,
  usb_product_id text,
  
  -- Ethernet settings
  ip_address text,
  port integer DEFAULT 9100,
  
  -- Printer model/brand for driver selection
  printer_brand text DEFAULT 'generic',
  printer_model text,
  
  -- Paper settings
  paper_width integer DEFAULT 80,
  characters_per_line integer DEFAULT 48,
  
  -- Status
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  last_connected_at timestamp with time zone,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_configurations ENABLE ROW LEVEL SECURITY;

-- RLS policies for receipt_settings
CREATE POLICY "Authenticated users can view receipt settings"
ON public.receipt_settings
FOR SELECT
USING (true);

CREATE POLICY "Managers and above can manage receipt settings"
ON public.receipt_settings
FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS policies for printer_configurations
CREATE POLICY "Authenticated users can view printer configurations"
ON public.printer_configurations
FOR SELECT
USING (true);

CREATE POLICY "Managers and above can manage printer configurations"
ON public.printer_configurations
FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_receipt_settings_updated_at
BEFORE UPDATE ON public.receipt_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_printer_configurations_updated_at
BEFORE UPDATE ON public.printer_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
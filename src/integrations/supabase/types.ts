export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_requests: {
        Row: {
          approval_notes: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
          request_data: Json | null
          request_type: string
          requested_by: string
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
          request_data?: Json | null
          request_type: string
          requested_by: string
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
          request_data?: Json | null
          request_type?: string
          requested_by?: string
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      branch_inventory: {
        Row: {
          batch_number: string | null
          branch_id: string
          created_at: string
          expiry_date: string | null
          id: string
          last_restocked_at: string | null
          product_id: string
          quantity: number
          reserved_quantity: number | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          branch_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          last_restocked_at?: string | null
          product_id: string
          quantity?: number
          reserved_quantity?: number | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          branch_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          last_restocked_at?: string | null
          product_id?: string
          quantity?: number
          reserved_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_users: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_default: boolean | null
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          business_registration_number: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          is_headquarters: boolean | null
          kra_pin: string | null
          location: string | null
          logo_url: string | null
          mpesa_account_number: string | null
          mpesa_paybill_number: string | null
          mpesa_till_number: string | null
          name: string
          opening_hours: string | null
          phone: string | null
          receipt_footer_message: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_registration_number?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_headquarters?: boolean | null
          kra_pin?: string | null
          location?: string | null
          logo_url?: string | null
          mpesa_account_number?: string | null
          mpesa_paybill_number?: string | null
          mpesa_till_number?: string | null
          name: string
          opening_hours?: string | null
          phone?: string | null
          receipt_footer_message?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_registration_number?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_headquarters?: boolean | null
          kra_pin?: string | null
          location?: string | null
          logo_url?: string | null
          mpesa_account_number?: string | null
          mpesa_paybill_number?: string | null
          mpesa_till_number?: string | null
          name?: string
          opening_hours?: string | null
          phone?: string | null
          receipt_footer_message?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      cashier_shifts: {
        Row: {
          actual_cash: number | null
          branch_id: string
          cash_discrepancy: number | null
          cashier_id: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_float: number
          status: string | null
          updated_at: string
        }
        Insert: {
          actual_cash?: number | null
          branch_id: string
          cash_discrepancy?: number | null
          cashier_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float?: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          actual_cash?: number | null
          branch_id?: string
          cash_discrepancy?: number | null
          cashier_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashier_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          payment_method: string | null
          processed_by: string
          reference: string | null
          running_balance: number
          sale_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          processed_by: string
          reference?: string | null
          running_balance: number
          sale_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          processed_by?: string
          reference?: string | null
          running_balance?: number
          sale_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_balance: number | null
          credit_enabled: boolean | null
          credit_limit: number | null
          email: string | null
          id: string
          loyalty_points: number | null
          name: string
          notes: string | null
          phone: string | null
          segment: string | null
          total_purchases: number | null
          updated_at: string
          visit_count: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_balance?: number | null
          credit_enabled?: boolean | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          segment?: string | null
          total_purchases?: number | null
          updated_at?: string
          visit_count?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_balance?: number | null
          credit_enabled?: boolean | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          segment?: string | null
          total_purchases?: number | null
          updated_at?: string
          visit_count?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          mpesa_phone: string | null
          mpesa_reference: string | null
          payment_method: string
          sale_id: string
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mpesa_phone?: string | null
          mpesa_reference?: string | null
          payment_method: string
          sale_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mpesa_phone?: string | null
          mpesa_reference?: string | null
          payment_method?: string
          sale_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_configurations: {
        Row: {
          bluetooth_device_id: string | null
          bluetooth_device_name: string | null
          branch_id: string
          characters_per_line: number | null
          connection_type: string
          created_at: string
          id: string
          ip_address: string | null
          is_active: boolean | null
          is_default: boolean | null
          last_connected_at: string | null
          name: string
          paper_width: number | null
          port: number | null
          printer_brand: string | null
          printer_model: string | null
          updated_at: string
          usb_product_id: string | null
          usb_vendor_id: string | null
        }
        Insert: {
          bluetooth_device_id?: string | null
          bluetooth_device_name?: string | null
          branch_id: string
          characters_per_line?: number | null
          connection_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          last_connected_at?: string | null
          name: string
          paper_width?: number | null
          port?: number | null
          printer_brand?: string | null
          printer_model?: string | null
          updated_at?: string
          usb_product_id?: string | null
          usb_vendor_id?: string | null
        }
        Update: {
          bluetooth_device_id?: string | null
          bluetooth_device_name?: string | null
          branch_id?: string
          characters_per_line?: number | null
          connection_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          last_connected_at?: string | null
          name?: string
          paper_width?: number | null
          port?: number | null
          printer_brand?: string | null
          printer_model?: string | null
          updated_at?: string
          usb_product_id?: string | null
          usb_vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printer_configurations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          branch_id: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_shared_product: boolean
          low_stock_threshold: number | null
          name: string
          sku: string | null
          tax_rate: number | null
          track_inventory: boolean | null
          unit_of_measure: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          branch_id?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_shared_product?: boolean
          low_stock_threshold?: number | null
          name: string
          sku?: string | null
          tax_rate?: number | null
          track_inventory?: boolean | null
          unit_of_measure?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          branch_id?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_shared_product?: boolean
          low_stock_threshold?: number | null
          name?: string
          sku?: string | null
          tax_rate?: number | null
          track_inventory?: boolean | null
          unit_of_measure?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          manager_pin: string | null
          phone: string | null
          pin_hash: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          manager_pin?: string | null
          phone?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          manager_pin?: string | null
          phone?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receipt_settings: {
        Row: {
          branch_id: string
          created_at: string
          footer_message: string | null
          id: string
          paper_width: string | null
          return_policy: string | null
          show_address: boolean | null
          show_branch_name: boolean | null
          show_business_name: boolean | null
          show_cashier_name: boolean | null
          show_customer_name: boolean | null
          show_date_time: boolean | null
          show_discount: boolean | null
          show_email: boolean | null
          show_footer_message: boolean | null
          show_item_sku: boolean | null
          show_item_tax: boolean | null
          show_kra_pin: boolean | null
          show_logo: boolean | null
          show_mpesa_paybill: boolean | null
          show_mpesa_till: boolean | null
          show_phone: boolean | null
          show_receipt_number: boolean | null
          show_return_policy: boolean | null
          show_subtotal: boolean | null
          show_total_tax: boolean | null
          show_website: boolean | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          footer_message?: string | null
          id?: string
          paper_width?: string | null
          return_policy?: string | null
          show_address?: boolean | null
          show_branch_name?: boolean | null
          show_business_name?: boolean | null
          show_cashier_name?: boolean | null
          show_customer_name?: boolean | null
          show_date_time?: boolean | null
          show_discount?: boolean | null
          show_email?: boolean | null
          show_footer_message?: boolean | null
          show_item_sku?: boolean | null
          show_item_tax?: boolean | null
          show_kra_pin?: boolean | null
          show_logo?: boolean | null
          show_mpesa_paybill?: boolean | null
          show_mpesa_till?: boolean | null
          show_phone?: boolean | null
          show_receipt_number?: boolean | null
          show_return_policy?: boolean | null
          show_subtotal?: boolean | null
          show_total_tax?: boolean | null
          show_website?: boolean | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          footer_message?: string | null
          id?: string
          paper_width?: string | null
          return_policy?: string | null
          show_address?: boolean | null
          show_branch_name?: boolean | null
          show_business_name?: boolean | null
          show_cashier_name?: boolean | null
          show_customer_name?: boolean | null
          show_date_time?: boolean | null
          show_discount?: boolean | null
          show_email?: boolean | null
          show_footer_message?: boolean | null
          show_item_sku?: boolean | null
          show_item_tax?: boolean | null
          show_kra_pin?: boolean | null
          show_logo?: boolean | null
          show_mpesa_paybill?: boolean | null
          show_mpesa_till?: boolean | null
          show_phone?: boolean | null
          show_receipt_number?: boolean | null
          show_return_policy?: boolean | null
          show_subtotal?: boolean | null
          show_total_tax?: boolean | null
          show_website?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          original_sale_id: string | null
          processed_by: string | null
          reason: string
          refund_amount: number
          refund_method: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          original_sale_id?: string | null
          processed_by?: string | null
          reason: string
          refund_amount?: number
          refund_method?: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          original_sale_id?: string | null
          processed_by?: string | null
          reason?: string
          refund_amount?: number
          refund_method?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_original_sale_id_fkey"
            columns: ["original_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          id: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          tax_amount: number | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          id?: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          tax_amount?: number | null
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          tax_amount?: number | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          cashier_id: string
          cost_total: number | null
          created_at: string
          customer_id: string | null
          discount_amount: number | null
          id: string
          is_synced: boolean | null
          notes: string | null
          offline_id: string | null
          payment_status: string | null
          profit_total: number | null
          receipt_number: string
          shift_id: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          cashier_id: string
          cost_total?: number | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          is_synced?: boolean | null
          notes?: string | null
          offline_id?: string | null
          payment_status?: string | null
          profit_total?: number | null
          receipt_number: string
          shift_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cashier_id?: string
          cost_total?: number | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          is_synced?: boolean | null
          notes?: string | null
          offline_id?: string | null
          payment_status?: string | null
          profit_total?: number | null
          receipt_number?: string
          shift_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cashier_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_number: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity_change: number
          reference_id: string | null
        }
        Insert: {
          batch_number?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity_change: number
          reference_id?: string | null
        }
        Update: {
          batch_number?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity_change?: number
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          from_branch_id: string | null
          id: string
          initiated_by: string | null
          notes: string | null
          product_id: string
          quantity: number
          status: string | null
          to_branch_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          from_branch_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          product_id: string
          quantity: number
          status?: string | null
          to_branch_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          from_branch_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: string | null
          to_branch_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      current_stock: {
        Row: {
          branch_id: string | null
          last_movement_at: string | null
          latest_batch_number: string | null
          latest_expiry_date: string | null
          product_id: string | null
          quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_product_stock: {
        Args: { p_branch_id: string; p_product_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "cashier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "manager", "cashier"],
    },
  },
} as const

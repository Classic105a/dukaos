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
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          prev_hash: string | null
          row_hash: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          branch_id?: string | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          prev_hash?: string | null
          row_hash?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          branch_id?: string | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          prev_hash?: string | null
          row_hash?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          business_id: string | null
          created_at: string
          error: string | null
          file_path: string | null
          finished_at: string | null
          id: string
          kind: string
          rows_count: number | null
          size_bytes: number | null
          started_at: string
          status: string
          tables_count: number | null
          triggered_by: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          error?: string | null
          file_path?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          rows_count?: number | null
          size_bytes?: number | null
          started_at?: string
          status?: string
          tables_count?: number | null
          triggered_by?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          error?: string | null
          file_path?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          rows_count?: number | null
          size_bytes?: number | null
          started_at?: string
          status?: string
          tables_count?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      billing_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      billing_promotion_redemptions: {
        Row: {
          business_id: string
          created_at: string
          discount_applied: number
          id: string
          invoice_id: string | null
          promotion_id: string
          redeemed_by: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          discount_applied?: number
          id?: string
          invoice_id?: string | null
          promotion_id: string
          redeemed_by?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          discount_applied?: number
          id?: string
          invoice_id?: string | null
          promotion_id?: string
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_promotion_redemptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_promotion_redemptions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_promotion_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "billing_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_promotions: {
        Row: {
          applies_to_cycles: string[]
          applies_to_plan_ids: string[] | null
          code: string
          created_at: string
          created_by: string | null
          currency: string
          current_redemptions: number
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_per_business: number
          max_redemptions: number | null
          name: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          applies_to_cycles?: string[]
          applies_to_plan_ids?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_redemptions?: number
          description?: string | null
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_per_business?: number
          max_redemptions?: number | null
          name: string
          starts_at?: string
          updated_at?: string
        }
        Update: {
          applies_to_cycles?: string[]
          applies_to_plan_ids?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_redemptions?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_per_business?: number
          max_redemptions?: number | null
          name?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      branch_inventory: {
        Row: {
          batch_number: string | null
          branch_id: string
          business_id: string
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
          business_id: string
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
          business_id?: string
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
          business_id: string
          business_registration_number: string | null
          city: string | null
          created_at: string
          default_tax_rate: number
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
          receipt_prefix: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_id: string
          business_registration_number?: string | null
          city?: string | null
          created_at?: string
          default_tax_rate?: number
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
          receipt_prefix?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string
          business_registration_number?: string | null
          city?: string | null
          created_at?: string
          default_tax_rate?: number
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
          receipt_prefix?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_modules: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_enabled: boolean
          module_key: string
          settings: Json
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_modules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_price_overrides: {
        Row: {
          approved_by: string | null
          business_id: string
          created_at: string
          currency: string
          custom_monthly: number | null
          custom_yearly: number | null
          discount_amount: number | null
          discount_percent: number | null
          end_date: string | null
          id: string
          is_grandfathered: boolean
          override_type: string
          plan_id: string | null
          reason: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          business_id: string
          created_at?: string
          currency?: string
          custom_monthly?: number | null
          custom_yearly?: number | null
          discount_amount?: number | null
          discount_percent?: number | null
          end_date?: string | null
          id?: string
          is_grandfathered?: boolean
          override_type: string
          plan_id?: string | null
          reason: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          custom_monthly?: number | null
          custom_yearly?: number | null
          discount_amount?: number | null
          discount_percent?: number | null
          end_date?: string | null
          id?: string
          is_grandfathered?: boolean
          override_type?: string
          plan_id?: string | null
          reason?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_price_overrides_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_price_overrides_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      business_subscriptions: {
        Row: {
          auto_renew: boolean
          billing_cycle: string
          business_id: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_period_ends_at: string | null
          id: string
          plan_id: string | null
          status: string
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          billing_cycle?: string
          business_id: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          billing_cycle?: string
          business_id?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      business_users: {
        Row: {
          business_id: string
          created_at: string
          id: string
          invited_by: string | null
          is_owner: boolean | null
          role: string | null
          status: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_owner?: boolean | null
          role?: string | null
          status?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_owner?: boolean | null
          role?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_permit: string | null
          country: string
          county: string | null
          created_at: string
          created_by: string
          currency: string | null
          email: string | null
          id: string
          industry: string
          is_active: boolean | null
          kra_pin: string | null
          logo_url: string | null
          name: string
          owner_name: string | null
          paybill_number: string | null
          phone: string | null
          physical_address: string | null
          till_number: string | null
          timezone: string
          town: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          business_permit?: string | null
          country?: string
          county?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          email?: string | null
          id?: string
          industry?: string
          is_active?: boolean | null
          kra_pin?: string | null
          logo_url?: string | null
          name: string
          owner_name?: string | null
          paybill_number?: string | null
          phone?: string | null
          physical_address?: string | null
          till_number?: string | null
          timezone?: string
          town?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          business_permit?: string | null
          country?: string
          county?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          email?: string | null
          id?: string
          industry?: string
          is_active?: boolean | null
          kra_pin?: string | null
          logo_url?: string | null
          name?: string
          owner_name?: string | null
          paybill_number?: string | null
          phone?: string | null
          physical_address?: string | null
          till_number?: string | null
          timezone?: string
          town?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cashier_shifts: {
        Row: {
          actual_cash: number | null
          branch_id: string
          business_id: string
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
          business_id: string
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
          business_id?: string
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
          business_id: string
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
          business_id: string
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
          business_id?: string
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
          business_id: string
          created_at: string
          customer_id: string
          id: string
          installment_plan_id: string | null
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
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          installment_plan_id?: string | null
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
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          installment_plan_id?: string | null
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
            foreignKeyName: "credit_transactions_installment_plan_id_fkey"
            columns: ["installment_plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
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
      current_stock: {
        Row: {
          branch_id: string
          business_id: string
          last_movement_at: string | null
          latest_batch_number: string | null
          latest_expiry_date: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          branch_id: string
          business_id: string
          last_movement_at?: string | null
          latest_batch_number?: string | null
          latest_expiry_date?: string | null
          product_id: string
          quantity?: number
        }
        Update: {
          branch_id?: string
          business_id?: string
          last_movement_at?: string | null
          latest_batch_number?: string | null
          latest_expiry_date?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "current_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "current_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_permissions: {
        Row: {
          business_id: string | null
          can_access_wallet: boolean | null
          can_add_delete_staff: boolean | null
          can_apply_discounts: boolean | null
          can_approve_withdrawals: boolean | null
          can_change_prices: boolean | null
          can_change_settings: boolean | null
          can_edit_past_sales: boolean | null
          can_edit_stock_levels: boolean | null
          can_export_data: boolean | null
          can_perform_transfers: boolean | null
          can_see_payables: boolean | null
          can_see_stock_value: boolean | null
          can_view_net_profit: boolean | null
          can_view_purchase_prices: boolean | null
          can_void_cart_items: boolean | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          can_access_wallet?: boolean | null
          can_add_delete_staff?: boolean | null
          can_apply_discounts?: boolean | null
          can_approve_withdrawals?: boolean | null
          can_change_prices?: boolean | null
          can_change_settings?: boolean | null
          can_edit_past_sales?: boolean | null
          can_edit_stock_levels?: boolean | null
          can_export_data?: boolean | null
          can_perform_transfers?: boolean | null
          can_see_payables?: boolean | null
          can_see_stock_value?: boolean | null
          can_view_net_profit?: boolean | null
          can_view_purchase_prices?: boolean | null
          can_void_cart_items?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          can_access_wallet?: boolean | null
          can_add_delete_staff?: boolean | null
          can_apply_discounts?: boolean | null
          can_approve_withdrawals?: boolean | null
          can_change_prices?: boolean | null
          can_change_settings?: boolean | null
          can_edit_past_sales?: boolean | null
          can_edit_stock_levels?: boolean | null
          can_export_data?: boolean | null
          can_perform_transfers?: boolean | null
          can_see_payables?: boolean | null
          can_see_stock_value?: boolean | null
          can_view_net_profit?: boolean | null
          can_view_purchase_prices?: boolean | null
          can_void_cart_items?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_permissions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_id: string
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
          business_id: string
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
          business_id?: string
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
      error_logs: {
        Row: {
          branch_id: string | null
          business_id: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          route: string | null
          severity: string
          source: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          route?: string | null
          severity?: string
          source: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          route?: string | null
          severity?: string
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      goods_received_notes: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          grn_number: string
          id: string
          notes: string | null
          purchase_order_id: string | null
          received_by: string
          received_date: string
          status: string
          supplier_id: string | null
          total_items: number
          total_value: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          grn_number: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          received_by: string
          received_date?: string
          status?: string
          supplier_id?: string | null
          total_items?: number
          total_value?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          grn_number?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          received_by?: string
          received_date?: string
          status?: string
          supplier_id?: string | null
          total_items?: number
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_received_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          grn_id: string
          id: string
          notes: string | null
          product_id: string
          product_name: string
          quantity_damaged: number
          quantity_expected: number
          quantity_received: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          grn_id: string
          id?: string
          notes?: string | null
          product_id: string
          product_name: string
          quantity_damaged?: number
          quantity_expected?: number
          quantity_received: number
          total_cost: number
          unit_cost: number
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          grn_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          product_name?: string
          quantity_damaged?: number
          quantity_expected?: number
          quantity_received?: number
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_received_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          customer_id: string
          id: string
          installment_amount: number
          installments_count: number
          next_due_date: string
          paid_installments: number
          remaining_amount: number
          sale_id: string | null
          start_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          installment_amount: number
          installments_count?: number
          next_due_date: string
          paid_installments?: number
          remaining_amount: number
          sale_id?: string | null
          start_date?: string
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          installment_amount?: number
          installments_count?: number
          next_due_date?: string
          paid_installments?: number
          remaining_amount?: number
          sale_id?: string | null
          start_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_cases: {
        Row: {
          amount_claimed: number
          business_id: string
          case_number: string | null
          court_name: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          filing_date: string | null
          id: string
          next_hearing_date: string | null
          notes: string | null
          outcome: string | null
          party_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount_claimed?: number
          business_id: string
          case_number?: string | null
          court_name?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          filing_date?: string | null
          id?: string
          next_hearing_date?: string | null
          notes?: string | null
          outcome?: string | null
          party_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount_claimed?: number
          business_id?: string
          case_number?: string | null
          court_name?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          filing_date?: string | null
          id?: string
          next_hearing_date?: string | null
          notes?: string | null
          outcome?: string | null
          party_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_cases_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_cases_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_callbacks: {
        Row: {
          amount: number | null
          branch_id: string | null
          business_id: string | null
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          payment_id: string | null
          phone_number: string | null
          raw_payload: Json
          reconciled: boolean
          reconciled_at: string | null
          result_code: number | null
          result_desc: string | null
          sale_id: string | null
          transaction_date: string | null
        }
        Insert: {
          amount?: number | null
          branch_id?: string | null
          business_id?: string | null
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          payment_id?: string | null
          phone_number?: string | null
          raw_payload: Json
          reconciled?: boolean
          reconciled_at?: string | null
          result_code?: number | null
          result_desc?: string | null
          sale_id?: string | null
          transaction_date?: string | null
        }
        Update: {
          amount?: number | null
          branch_id?: string | null
          business_id?: string | null
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          payment_id?: string | null
          phone_number?: string | null
          raw_payload?: Json
          reconciled?: boolean
          reconciled_at?: string | null
          result_code?: number | null
          result_desc?: string | null
          sale_id?: string | null
          transaction_date?: string | null
        }
        Relationships: []
      }
      parties: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          current_balance: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          opening_balance: number | null
          party_type: string
          phone: string | null
          pricing_tier: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          opening_balance?: number | null
          party_type?: string
          phone?: string | null
          pricing_tier?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          opening_balance?: number | null
          party_type?: string
          phone?: string | null
          pricing_tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_transactions: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          id: string
          notes: string | null
          party_id: string
          payment_method: string | null
          processed_by: string
          reference: string | null
          running_balance: number
          transaction_type: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          id?: string
          notes?: string | null
          party_id: string
          payment_method?: string | null
          processed_by: string
          reference?: string | null
          running_balance?: number
          transaction_type: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          party_id?: string
          payment_method?: string | null
          processed_by?: string
          reference?: string | null
          running_balance?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payable_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_transactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
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
      perf_metrics: {
        Row: {
          branch_id: string | null
          business_id: string | null
          context: Json | null
          created_at: string
          id: string
          metric: string
          route: string | null
          user_id: string | null
          value_ms: number
        }
        Insert: {
          branch_id?: string | null
          business_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          metric: string
          route?: string | null
          user_id?: string | null
          value_ms: number
        }
        Update: {
          branch_id?: string | null
          business_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          metric?: string
          route?: string | null
          user_id?: string | null
          value_ms?: number
        }
        Relationships: []
      }
      plan_prices: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          plan_id: string
          price_monthly: number
          price_yearly: number
          price_yearly_discounted: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          plan_id: string
          price_monthly?: number
          price_yearly?: number
          price_yearly_discounted?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          plan_id?: string
          price_monthly?: number
          price_yearly?: number
          price_yearly_discounted?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      printer_configurations: {
        Row: {
          bluetooth_device_id: string | null
          bluetooth_device_name: string | null
          branch_id: string
          business_id: string
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
          business_id: string
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
          business_id?: string
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
          allow_negative_stock: boolean
          barcode: string | null
          branch_id: string | null
          business_id: string
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
          allow_negative_stock?: boolean
          barcode?: string | null
          branch_id?: string | null
          business_id: string
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
          allow_negative_stock?: boolean
          barcode?: string | null
          branch_id?: string | null
          business_id?: string
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
          phone?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          branch_id: string | null
          business_id: string
          cart_subtotal: number
          cashier_id: string
          created_at: string
          customer_id: string | null
          discount_applied: number
          id: string
          promo_snapshot: Json | null
          promotion_id: string
          sale_id: string
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          cart_subtotal: number
          cashier_id: string
          created_at?: string
          customer_id?: string | null
          discount_applied: number
          id?: string
          promo_snapshot?: Json | null
          promotion_id: string
          sale_id: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          cart_subtotal?: number
          cashier_id?: string
          created_at?: string
          customer_id?: string | null
          discount_applied?: number
          id?: string
          promo_snapshot?: Json | null
          promotion_id?: string
          sale_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          applies_to: string
          business_id: string
          category_ids: string[] | null
          created_at: string
          created_by: string
          current_uses: number
          description: string | null
          discount_value: number
          end_date: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_purchase_amount: number | null
          min_quantity: number | null
          name: string
          product_ids: string[] | null
          promotion_type: string
          start_date: string
          updated_at: string
        }
        Insert: {
          applies_to?: string
          business_id: string
          category_ids?: string[] | null
          created_at?: string
          created_by: string
          current_uses?: number
          description?: string | null
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase_amount?: number | null
          min_quantity?: number | null
          name: string
          product_ids?: string[] | null
          promotion_type?: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          applies_to?: string
          business_id?: string
          category_ids?: string[] | null
          created_at?: string
          created_by?: string
          current_uses?: number
          description?: string | null
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase_amount?: number | null
          min_quantity?: number | null
          name?: string
          product_ids?: string[] | null
          promotion_type?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_by: string | null
          branch_id: string | null
          business_id: string
          created_at: string
          created_by: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: string
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          branch_id?: string | null
          business_id: string
          created_at?: string
          created_by: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          branch_id?: string | null
          business_id?: string
          created_at?: string
          created_by?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_sequences: {
        Row: {
          branch_id: string
          last_value: number
          seq_date: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          last_value?: number
          seq_date: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          last_value?: number
          seq_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipt_settings: {
        Row: {
          branch_id: string
          business_id: string
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
          business_id: string
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
          business_id?: string
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
      reorder_rules: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          id: string
          is_auto_reorder: boolean
          last_reorder_date: string | null
          lead_time_days: number
          max_stock_level: number | null
          product_id: string
          reorder_point: number
          reorder_quantity: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          id?: string
          is_auto_reorder?: boolean
          last_reorder_date?: string | null
          lead_time_days?: number
          max_stock_level?: number | null
          product_id: string
          reorder_point?: number
          reorder_quantity?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          id?: string
          is_auto_reorder?: boolean
          last_reorder_date?: string | null
          lead_time_days?: number
          max_stock_level?: number | null
          product_id?: string
          reorder_point?: number
          reorder_quantity?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reorder_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_rules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          branch_id: string | null
          business_id: string
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
          business_id: string
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
          business_id?: string
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
          business_id: string
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
          business_id: string
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
          business_id?: string
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
          business_id: string
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
          business_id: string
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
          business_id?: string
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
          business_id: string
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
          business_id: string
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
          business_id?: string
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
      subscription_invoices: {
        Row: {
          amount: number
          billing_cycle: string
          business_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          period_end: string | null
          period_start: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_cycle?: string
          business_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          business_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "business_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_branches: number | null
          max_employees: number | null
          max_products: number | null
          max_warehouses: number | null
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          storage_mb: number | null
          support_level: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_employees?: number | null
          max_products?: number | null
          max_warehouses?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          storage_mb?: number | null
          support_level?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_employees?: number | null
          max_products?: number | null
          max_warehouses?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          storage_mb?: number | null
          support_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_conflicts: {
        Row: {
          branch_id: string | null
          business_id: string | null
          cashier_id: string
          conflict_type: string
          created_at: string
          error_message: string | null
          id: string
          offline_id: string
          payload: Json
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          business_id?: string | null
          cashier_id: string
          conflict_type: string
          created_at?: string
          error_message?: string | null
          id?: string
          offline_id: string
          payload: Json
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string | null
          cashier_id?: string
          conflict_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          offline_id?: string
          payload?: Json
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
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
      daily_sales_summary: {
        Row: {
          avg_order_value: number | null
          branch_id: string | null
          business_id: string | null
          cost: number | null
          discount: number | null
          profit: number | null
          revenue: number | null
          sale_date: string | null
          tax: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: Json }
      admin_subscription_action: {
        Args: {
          p_action: string
          p_business_id: string
          p_days?: number
          p_plan_id?: string
          p_reason?: string
        }
        Returns: Json
      }
      admin_update_invoice_status: {
        Args: { p_invoice_id: string; p_reason?: string; p_status: string }
        Returns: Json
      }
      business_id_from_branch: { Args: { _branch_id: string }; Returns: string }
      business_id_from_grn: { Args: { _grn_id: string }; Returns: string }
      business_id_from_po: { Args: { _po_id: string }; Returns: string }
      business_id_from_sale: { Args: { _sale_id: string }; Returns: string }
      calculate_subscription_price: {
        Args: {
          p_business_id: string
          p_coupon?: string
          p_cycle?: string
          p_plan_id: string
        }
        Returns: Json
      }
      cleanup_invites: { Args: never; Returns: Json }
      complete_sale: {
        Args: {
          p_branch_id: string
          p_cashier_id: string
          p_cost_total?: number
          p_customer_id?: string
          p_discount_amount?: number
          p_items?: Json
          p_notes?: string
          p_offline_id?: string
          p_payments?: Json
          p_profit_total?: number
          p_promotion_id?: string
          p_receipt_number: string
          p_shift_id?: string
          p_subtotal?: number
          p_tax_amount?: number
          p_total_amount?: number
        }
        Returns: Json
      }
      create_invite: {
        Args: { p_business_id: string; p_email: string; p_role?: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_daily_sales_summary: {
        Args: {
          p_branch_id?: string
          p_business_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          avg_order_value: number | null
          branch_id: string | null
          business_id: string | null
          cost: number | null
          discount: number | null
          profit: number | null
          revenue: number | null
          sale_date: string | null
          tax: number | null
          transaction_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_sales_summary"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_dashboard_stats: {
        Args: { p_branch_id: string; p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_low_stock_alerts: { Args: { p_branch_id: string }; Returns: Json }
      get_product_stock: {
        Args: { p_branch_id: string; p_product_id: string }
        Returns: number
      }
      get_top_products: {
        Args: {
          p_branch_id: string
          p_end_date: string
          p_limit?: number
          p_start_date: string
        }
        Returns: Json
      }
      has_business_role: {
        Args: { _business_id: string; _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_owner: { Args: { _business_id: string }; Returns: boolean }
      is_member_of_business: {
        Args: { _business_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      log_billing_action: {
        Args: {
          p_action: string
          p_business_id: string
          p_entity_id?: string
          p_entity_type: string
          p_new?: Json
          p_old?: Json
          p_reason?: string
        }
        Returns: string
      }
      next_receipt_number: { Args: { p_branch_id: string }; Returns: string }
      refresh_daily_sales_summary: { Args: never; Returns: undefined }
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined }
      run_complete_sale_tests: { Args: never; Returns: string[] }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      verify_audit_chain: {
        Args: { p_limit?: number }
        Returns: {
          actual_prev: string
          broken_at_created_at: string
          broken_at_id: string
          expected_prev: string
        }[]
      }
      verify_manager_credentials: {
        Args: { p_user_id: string }
        Returns: {
          user_email: string
          user_role: string
        }[]
      }
      verify_manager_pin: {
        Args: { p_pin: string }
        Returns: {
          full_name: string
          role: string
          user_id: string
        }[]
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

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          role: 'super_admin' | 'admin' | 'operations_manager' | 'accountant' | 'warehouse_staff' | 'driver' | 'labour_supervisor'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          role?: 'super_admin' | 'admin' | 'operations_manager' | 'accountant' | 'warehouse_staff' | 'driver' | 'labour_supervisor'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          role?: 'super_admin' | 'admin' | 'operations_manager' | 'accountant' | 'warehouse_staff' | 'driver' | 'labour_supervisor'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          company_type: 'client' | 'consignor' | 'consignee' | 'supplier'
          contact_person: string | null
          phone: string | null
          email: string | null
          billing_address: string | null
          city: string | null
          area: string | null
          pin_code: string | null
          gstin: string | null
          billing_terms: string | null
          credit_limit: number | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          company_type: 'client' | 'consignor' | 'consignee' | 'supplier'
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          billing_address?: string | null
          city?: string | null
          area?: string | null
          pin_code?: string | null
          gstin?: string | null
          billing_terms?: string | null
          credit_limit?: number | null
          is_active?: boolean
          notes?: string | null
        }
        Update: {
          name?: string
          company_type?: 'client' | 'consignor' | 'consignee' | 'supplier'
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          billing_address?: string | null
          city?: string | null
          area?: string | null
          pin_code?: string | null
          gstin?: string | null
          billing_terms?: string | null
          credit_limit?: number | null
          is_active?: boolean
          notes?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          company_id: string | null
          name: string
          contact_person: string | null
          phone: string | null
          email: string | null
          city: string | null
          area: string | null
          pin_code: string | null
          gstin: string | null
          billing_terms: string | null
          credit_limit: number | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          name: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          city?: string | null
          area?: string | null
          pin_code?: string | null
          gstin?: string | null
          billing_terms?: string | null
          credit_limit?: number | null
          is_active?: boolean
          notes?: string | null
        }
        Update: {
          company_id?: string | null
          name?: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          city?: string | null
          area?: string | null
          pin_code?: string | null
          gstin?: string | null
          billing_terms?: string | null
          credit_limit?: number | null
          is_active?: boolean
          notes?: string | null
        }
      }
      goods_receipts: {
        Row: {
          id: string
          invoice_number: string | null
          challan_number: string | null
          invoice_date: string | null
          consignor_company_id: string | null
          consignee_customer_id: string | null
          contact_number: string | null
          pickup_address: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_area: string | null
          delivery_pin_code: string | null
          product_category: string | null
          product_name: string | null
          product_description: string | null
          quantity: number | null
          unit: string | null
          weight_kg: number | null
          volume_cbm: number | null
          declared_value: number | null
          expected_arrival_date: string | null
          delivery_deadline: string | null
          priority: 'normal' | 'high' | 'urgent'
          handling_instructions: string | null
          status: string
          invoice_attachment_url: string | null
          challan_attachment_url: string | null
          created_by: string | null
          warehouse_id: string | null
          warehouse_location_id: string | null
          received_at: string | null
          verified_at: string | null
          verified_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number?: string | null
          challan_number?: string | null
          invoice_date?: string | null
          consignor_company_id?: string | null
          consignee_customer_id?: string | null
          contact_number?: string | null
          pickup_address?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_area?: string | null
          delivery_pin_code?: string | null
          product_category?: string | null
          product_name?: string | null
          product_description?: string | null
          quantity?: number | null
          unit?: string | null
          weight_kg?: number | null
          volume_cbm?: number | null
          declared_value?: number | null
          expected_arrival_date?: string | null
          delivery_deadline?: string | null
          priority?: 'normal' | 'high' | 'urgent'
          handling_instructions?: string | null
          status?: string
          invoice_attachment_url?: string | null
          challan_attachment_url?: string | null
          created_by?: string | null
          warehouse_id?: string | null
          warehouse_location_id?: string | null
          received_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          notes?: string | null
        }
        Update: Partial<{
          invoice_number: string | null
          challan_number: string | null
          invoice_date: string | null
          consignor_company_id: string | null
          consignee_customer_id: string | null
          contact_number: string | null
          pickup_address: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_area: string | null
          delivery_pin_code: string | null
          product_category: string | null
          product_name: string | null
          product_description: string | null
          quantity: number | null
          unit: string | null
          weight_kg: number | null
          volume_cbm: number | null
          declared_value: number | null
          expected_arrival_date: string | null
          delivery_deadline: string | null
          priority: 'normal' | 'high' | 'urgent'
          handling_instructions: string | null
          status: string
          invoice_attachment_url: string | null
          challan_attachment_url: string | null
          warehouse_id: string | null
          warehouse_location_id: string | null
          notes: string | null
        }>
      }
      drivers: {
        Row: {
          id: string
          profile_id: string | null
          full_name: string
          photograph_url: string | null
          phone: string | null
          address: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          joining_date: string | null
          employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave'
          licence_number: string | null
          licence_class: string | null
          licence_expiry: string | null
          salary_type: 'monthly' | 'daily' | 'trip_based' | 'custom'
          monthly_salary: number | null
          daily_wage: number | null
          trip_rate: number | null
          assigned_vehicle_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          full_name: string
          photograph_url?: string | null
          phone?: string | null
          address?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          joining_date?: string | null
          employment_status?: 'active' | 'inactive' | 'terminated' | 'on_leave'
          licence_number?: string | null
          licence_class?: string | null
          licence_expiry?: string | null
          salary_type?: 'monthly' | 'daily' | 'trip_based' | 'custom'
          monthly_salary?: number | null
          daily_wage?: number | null
          trip_rate?: number | null
          assigned_vehicle_id?: string | null
          notes?: string | null
        }
        Update: Partial<{
          profile_id: string | null
          full_name: string
          photograph_url: string | null
          phone: string | null
          address: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          joining_date: string | null
          employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave'
          licence_number: string | null
          licence_class: string | null
          licence_expiry: string | null
          salary_type: 'monthly' | 'daily' | 'trip_based' | 'custom'
          monthly_salary: number | null
          daily_wage: number | null
          trip_rate: number | null
          assigned_vehicle_id: string | null
          notes: string | null
        }>
      }
      vehicles: {
        Row: {
          id: string
          registration_number: string
          vehicle_type: 'truck' | 'tempo' | 'mini_truck' | 'pickup' | 'other'
          make: string | null
          model: string | null
          cargo_capacity_kg: number | null
          cargo_capacity_cbm: number | null
          fuel_type: 'diesel' | 'petrol' | 'cng' | 'electric'
          current_odometer: number | null
          insurance_expiry: string | null
          fitness_expiry: string | null
          permit_expiry: string | null
          puc_expiry: string | null
          assigned_driver_id: string | null
          status: 'available' | 'assigned' | 'on_trip' | 'under_maintenance' | 'inactive'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          registration_number: string
          vehicle_type?: 'truck' | 'tempo' | 'mini_truck' | 'pickup' | 'other'
          make?: string | null
          model?: string | null
          cargo_capacity_kg?: number | null
          cargo_capacity_cbm?: number | null
          fuel_type?: 'diesel' | 'petrol' | 'cng' | 'electric'
          current_odometer?: number | null
          insurance_expiry?: string | null
          fitness_expiry?: string | null
          permit_expiry?: string | null
          puc_expiry?: string | null
          assigned_driver_id?: string | null
          status?: 'available' | 'assigned' | 'on_trip' | 'under_maintenance' | 'inactive'
          notes?: string | null
        }
        Update: Partial<{
          registration_number: string
          vehicle_type: 'truck' | 'tempo' | 'mini_truck' | 'pickup' | 'other'
          make: string | null
          model: string | null
          cargo_capacity_kg: number | null
          cargo_capacity_cbm: number | null
          fuel_type: 'diesel' | 'petrol' | 'cng' | 'electric'
          current_odometer: number | null
          insurance_expiry: string | null
          fitness_expiry: string | null
          permit_expiry: string | null
          puc_expiry: string | null
          assigned_driver_id: string | null
          status: 'available' | 'assigned' | 'on_trip' | 'under_maintenance' | 'inactive'
          notes: string | null
        }>
      }
      dispatches: {
        Row: {
          id: string
          dispatch_number: string
          dispatch_date: string
          vehicle_id: string | null
          driver_id: string | null
          planned_departure: string | null
          actual_departure: string | null
          planned_arrival: string | null
          actual_arrival: string | null
          planned_distance_km: number | null
          actual_distance_km: number | null
          cargo_weight_kg: number | null
          capacity_utilization_pct: number | null
          status: 'draft' | 'planned' | 'loading' | 'in_transit' | 'completed' | 'cancelled'
          planned_cost: number | null
          actual_cost: number | null
          notes: string | null
          created_by: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dispatch_number: string
          dispatch_date: string
          vehicle_id?: string | null
          driver_id?: string | null
          planned_departure?: string | null
          actual_departure?: string | null
          planned_arrival?: string | null
          actual_arrival?: string | null
          planned_distance_km?: number | null
          actual_distance_km?: number | null
          cargo_weight_kg?: number | null
          capacity_utilization_pct?: number | null
          status?: 'draft' | 'planned' | 'loading' | 'in_transit' | 'completed' | 'cancelled'
          planned_cost?: number | null
          actual_cost?: number | null
          notes?: string | null
          created_by?: string | null
          approved_by?: string | null
        }
        Update: Partial<{
          dispatch_number: string
          dispatch_date: string
          vehicle_id: string | null
          driver_id: string | null
          planned_departure: string | null
          actual_departure: string | null
          planned_arrival: string | null
          actual_arrival: string | null
          planned_distance_km: number | null
          actual_distance_km: number | null
          cargo_weight_kg: number | null
          capacity_utilization_pct: number | null
          status: 'draft' | 'planned' | 'loading' | 'in_transit' | 'completed' | 'cancelled'
          planned_cost: number | null
          actual_cost: number | null
          notes: string | null
          approved_by: string | null
        }>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          is_read: boolean
          related_entity: string | null
          related_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: string
          is_read?: boolean
          related_entity?: string | null
          related_id?: string | null
        }
        Update: {
          is_read?: boolean
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
        }
        Update: never
      }
      expenses: {
        Row: {
          id: string
          expense_date: string
          category: string
          amount: number
          payment_method: string
          vendor: string | null
          vehicle_id: string | null
          dispatch_id: string | null
          trip_record_id: string | null
          staff_member_id: string | null
          driver_id: string | null
          receipt_url: string | null
          description: string | null
          entered_by: string | null
          remarks: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          expense_date: string
          category: string
          amount: number
          payment_method: string
          vendor?: string | null
          vehicle_id?: string | null
          dispatch_id?: string | null
          trip_record_id?: string | null
          staff_member_id?: string | null
          driver_id?: string | null
          receipt_url?: string | null
          description?: string | null
          entered_by?: string | null
          remarks?: string | null
        }
        Update: Partial<{
          expense_date: string
          category: string
          amount: number
          payment_method: string
          vendor: string | null
          vehicle_id: string | null
          dispatch_id: string | null
          trip_record_id: string | null
          staff_member_id: string | null
          driver_id: string | null
          receipt_url: string | null
          description: string | null
          remarks: string | null
        }>
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          customer_id: string | null
          company_id: string | null
          billing_month: string | null
          invoice_date: string
          due_date: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number | null
          tds_amount: number
          total_amount: number
          paid_amount: number
          outstanding_amount: number
          status: string
          gst_number: string | null
          notes: string | null
          approved_by: string | null
          issued_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          customer_id?: string | null
          company_id?: string | null
          billing_month?: string | null
          invoice_date: string
          due_date?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number | null
          tds_amount?: number
          total_amount?: number
          paid_amount?: number
          outstanding_amount?: number
          status?: string
          gst_number?: string | null
          notes?: string | null
          approved_by?: string | null
          issued_at?: string | null
          created_by?: string | null
        }
        Update: Partial<{
          invoice_number: string
          customer_id: string | null
          company_id: string | null
          billing_month: string | null
          invoice_date: string
          due_date: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number | null
          tds_amount: number
          total_amount: number
          paid_amount: number
          outstanding_amount: number
          status: string
          gst_number: string | null
          notes: string | null
          approved_by: string | null
          issued_at: string | null
        }>
      }
      staff_members: {
        Row: {
          id: string
          profile_id: string | null
          full_name: string
          phone: string | null
          address: string | null
          joining_date: string | null
          employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave'
          staff_type: 'driver' | 'labourer' | 'helper' | 'warehouse_staff' | 'other'
          daily_wage: number | null
          payment_method_preference: 'cash' | 'upi' | 'bank_transfer' | 'other'
          assigned_supervisor_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          full_name: string
          phone?: string | null
          address?: string | null
          joining_date?: string | null
          employment_status?: 'active' | 'inactive' | 'terminated' | 'on_leave'
          staff_type?: 'driver' | 'labourer' | 'helper' | 'warehouse_staff' | 'other'
          daily_wage?: number | null
          payment_method_preference?: 'cash' | 'upi' | 'bank_transfer' | 'other'
          assigned_supervisor_id?: string | null
          notes?: string | null
        }
        Update: Partial<{
          profile_id: string | null
          full_name: string
          phone: string | null
          address: string | null
          joining_date: string | null
          employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave'
          staff_type: 'driver' | 'labourer' | 'helper' | 'warehouse_staff' | 'other'
          daily_wage: number | null
          payment_method_preference: 'cash' | 'upi' | 'bank_transfer' | 'other'
          assigned_supervisor_id: string | null
          notes: string | null
        }>
      }
      warehouses: {
        Row: {
          id: string
          name: string
          code: string | null
          address: string | null
          city: string | null
          capacity_sqft: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code?: string | null
          address?: string | null
          city?: string | null
          capacity_sqft?: number | null
          is_active?: boolean
        }
        Update: Partial<{
          name: string
          code: string | null
          address: string | null
          city: string | null
          capacity_sqft: number | null
          is_active: boolean
        }>
      }
      deliveries: {
        Row: {
          id: string
          dispatch_id: string | null
          dispatch_stop_id: string | null
          driver_id: string | null
          vehicle_id: string | null
          customer_id: string | null
          company_id: string | null
          destination_address: string | null
          destination_city: string | null
          goods_receipt_id: string | null
          planned_arrival: string | null
          actual_arrival: string | null
          delivered_quantity: number | null
          remaining_quantity: number | null
          receiver_name: string | null
          delivery_remarks: string | null
          status: string
          failure_reason: string | null
          rescheduled_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dispatch_id?: string | null
          dispatch_stop_id?: string | null
          driver_id?: string | null
          vehicle_id?: string | null
          customer_id?: string | null
          company_id?: string | null
          destination_address?: string | null
          destination_city?: string | null
          goods_receipt_id?: string | null
          planned_arrival?: string | null
          actual_arrival?: string | null
          delivered_quantity?: number | null
          remaining_quantity?: number | null
          receiver_name?: string | null
          delivery_remarks?: string | null
          status?: string
          failure_reason?: string | null
          rescheduled_date?: string | null
        }
        Update: Partial<{
          dispatch_id: string | null
          dispatch_stop_id: string | null
          driver_id: string | null
          vehicle_id: string | null
          customer_id: string | null
          company_id: string | null
          destination_address: string | null
          destination_city: string | null
          goods_receipt_id: string | null
          planned_arrival: string | null
          actual_arrival: string | null
          delivered_quantity: number | null
          remaining_quantity: number | null
          receiver_name: string | null
          delivery_remarks: string | null
          status: string
          failure_reason: string | null
          rescheduled_date: string | null
        }>
      }
      staff_advances: {
        Row: {
          id: string
          staff_member_id: string | null
          driver_id: string | null
          staff_type: string
          advance_date: string
          amount: number
          payment_method: string
          payment_reference: string | null
          related_trip_id: string | null
          reason: string | null
          receipt_url: string | null
          recorded_by: string | null
          approval_status: 'pending' | 'approved' | 'rejected'
          approved_by: string | null
          status: 'unapplied' | 'partially_applied' | 'fully_applied'
          applied_amount: number
          remaining_amount: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_member_id?: string | null
          driver_id?: string | null
          staff_type: string
          advance_date: string
          amount: number
          payment_method: string
          payment_reference?: string | null
          related_trip_id?: string | null
          reason?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected'
          approved_by?: string | null
          status?: 'unapplied' | 'partially_applied' | 'fully_applied'
          applied_amount?: number
          remaining_amount?: number
          notes?: string | null
        }
        Update: Partial<{
          staff_member_id: string | null
          driver_id: string | null
          staff_type: string
          advance_date: string
          amount: number
          payment_method: string
          payment_reference: string | null
          related_trip_id: string | null
          reason: string | null
          receipt_url: string | null
          recorded_by: string | null
          approval_status: 'pending' | 'approved' | 'rejected'
          approved_by: string | null
          status: 'unapplied' | 'partially_applied' | 'fully_applied'
          applied_amount: number
          remaining_amount: number
          notes: string | null
        }>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          settings: any
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          settings?: any
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          settings?: any
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          tenant_id: string
          email: string
          role: string
          profile: any
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          role: string
          profile?: any
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          role?: string
          profile?: any
          created_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          tenant_id: string
          registration: string
          make: string | null
          model: string | null
          year: number | null
          vehicle_type_id: string | null
          dimensions: any
          adr_classifications: string[] | null
          fuel_type: string | null
          status: string | null
          current_location: any // Can be PostGIS GEOMETRY or JSONB {lat, lng}
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          registration: string
          make?: string | null
          model?: string | null
          year?: number | null
          vehicle_type_id?: string | null
          dimensions?: any
          adr_classifications?: string[] | null
          fuel_type?: string | null
          status?: string | null
          current_location?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          registration?: string
          make?: string | null
          model?: string | null
          year?: number | null
          vehicle_type_id?: string | null
          dimensions?: any
          adr_classifications?: string[] | null
          created_at?: string
        }
      }
      drivers: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          licence_number: string
          licence_expiry: string | null
          cpc_expiry: string | null
          tacho_card_expiry: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          licence_number: string
          licence_expiry?: string | null
          cpc_expiry?: string | null
          tacho_card_expiry?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          licence_number?: string
          licence_expiry?: string | null
          cpc_expiry?: string | null
          tacho_card_expiry?: string | null
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          tenant_id: string
          order_number: string
          consignor: any
          consignee: any
          pickup_location: any
          delivery_location: any
          pickup_window_start: string | null
          pickup_window_end: string | null
          delivery_window_start: string | null
          delivery_window_end: string | null
          load_details: any
          adr_flags: string[] | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          order_number: string
          consignor: any
          consignee: any
          pickup_location?: any
          delivery_location?: any
          pickup_window_start?: string | null
          pickup_window_end?: string | null
          delivery_window_start?: string | null
          delivery_window_end?: string | null
          load_details?: any
          adr_flags?: string[] | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          order_number?: string
          consignor?: any
          consignee?: any
          pickup_location?: any
          delivery_location?: any
          pickup_window_start?: string | null
          pickup_window_end?: string | null
          delivery_window_start?: string | null
          delivery_window_end?: string | null
          load_details?: any
          adr_flags?: string[] | null
          status?: string
          created_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          tenant_id: string
          order_id: string
          driver_id: string
          vehicle_id: string
          status: string
          planned_start: string | null
          planned_end: string | null
          actual_start: string | null
          actual_end: string | null
          route_plan: any
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          order_id: string
          driver_id: string
          vehicle_id: string
          status?: string
          planned_start?: string | null
          planned_end?: string | null
          actual_start?: string | null
          actual_end?: string | null
          route_plan?: any
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          order_id?: string
          driver_id?: string
          vehicle_id?: string
          status?: string
          planned_start?: string | null
          planned_end?: string | null
          actual_start?: string | null
          actual_end?: string | null
          route_plan?: any
          created_at?: string
        }
      }
      walkaround_checks: {
        Row: {
          id: string
          tenant_id: string
          driver_id: string
          vehicle_id: string
          check_data: any
          defects_found: boolean
          vor_required: boolean
          completed_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          driver_id: string
          vehicle_id: string
          check_data: any
          defects_found?: boolean
          vor_required?: boolean
          completed_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          driver_id?: string
          vehicle_id?: string
          check_data?: any
          defects_found?: boolean
          vor_required?: boolean
          completed_at?: string
        }
      }
      defects: {
        Row: {
          id: string
          tenant_id: string
          walkaround_id: string
          vehicle_id: string
          defect_type: string
          severity: string
          description: string | null
          status: string
          reported_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          walkaround_id: string
          vehicle_id: string
          defect_type: string
          severity: string
          description?: string | null
          status?: string
          reported_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          walkaround_id?: string
          vehicle_id?: string
          defect_type?: string
          severity?: string
          description?: string | null
          status?: string
          reported_at?: string
        }
      }
      inspection_documents: {
        Row: {
          id: string
          tenant_id: string
          inspection_id: string
          inspection_type: string
          supabase_path: string
          file_type: string | null
          file_size: number | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          inspection_id: string
          inspection_type: string
          supabase_path: string
          file_type?: string | null
          file_size?: number | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          inspection_id?: string
          inspection_type?: string
          supabase_path?: string
          file_type?: string | null
          file_size?: number | null
          uploaded_at?: string
        }
      }
    }
  }
}

// Type helpers
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']


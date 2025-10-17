import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

// Only create client if we have valid URLs
export const supabase = supabaseUrl.includes('placeholder') 
  ? null 
  : createClient(supabaseUrl, supabaseAnonKey)

// Service role client for admin operations (server-side only)
export const supabaseAdmin = supabaseUrl.includes('placeholder') || supabaseServiceRoleKey.includes('placeholder')
  ? null 
  : createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

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
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          role: string
          profile?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          role?: string
          profile?: any
          created_at?: string
          updated_at?: string
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
          tax_due_date: string | null
          mot_due_date: string | null
          tacho_expiry_date: string | null
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
          tax_due_date?: string | null
          mot_due_date?: string | null
          tacho_expiry_date?: string | null
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
      depots: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          address: string
          contact_person: string | null
          contact_phone: string | null
          contact_email: string | null
          operating_hours: string | null
          facilities: string[] | null
          capacity: number | null
          current_vehicles: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          description?: string | null
          address: string
          contact_person?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          operating_hours?: string | null
          facilities?: string[] | null
          capacity?: number | null
          current_vehicles?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          description?: string | null
          address?: string
          contact_person?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          operating_hours?: string | null
          facilities?: string[] | null
          capacity?: number | null
          current_vehicles?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      depot_vehicles: {
        Row: {
          id: string
          depot_id: string
          vehicle_id: string
          assigned_by: string
          assigned_at: string
        }
        Insert: {
          id?: string
          depot_id: string
          vehicle_id: string
          assigned_by: string
          assigned_at?: string
        }
        Update: {
          id?: string
          depot_id?: string
          vehicle_id?: string
          assigned_by?: string
          assigned_at?: string
        }
      }
      depot_drivers: {
        Row: {
          id: string
          depot_id: string
          driver_id: string
          assigned_by: string
          assigned_at: string
        }
        Insert: {
          id?: string
          depot_id: string
          driver_id: string
          assigned_by: string
          assigned_at?: string
        }
        Update: {
          id?: string
          depot_id?: string
          driver_id?: string
          assigned_by?: string
          assigned_at?: string
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
          status: string | null
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
          status?: string | null
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
          status?: string | null
          created_at?: string
        }
      }
      vehicle_types: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
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
      maintenance_providers: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          company_name: string | null
          certification_number: string | null
          certification_expiry: string | null
          specializations: string[] | null
          contact_phone: string | null
          contact_email: string | null
          address: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          company_name?: string | null
          certification_number?: string | null
          certification_expiry?: string | null
          specializations?: string[] | null
          contact_phone?: string | null
          contact_email?: string | null
          address?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          company_name?: string | null
          certification_number?: string | null
          certification_expiry?: string | null
          specializations?: string[] | null
          contact_phone?: string | null
          contact_email?: string | null
          address?: any | null
          created_at?: string
          updated_at?: string
        }
      }
      driver_hours: {
        Row: {
          id: string
          tenant_id: string
          driver_id: string
          date: string
          driving_hours: number
          working_hours: number
          break_hours: number
          rest_hours: number
          daily_rest_start: string | null
          daily_rest_end: string | null
          weekly_rest_start: string | null
          weekly_rest_end: string | null
          compliance_status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          driver_id: string
          date: string
          driving_hours?: number
          working_hours?: number
          break_hours?: number
          rest_hours?: number
          daily_rest_start?: string | null
          daily_rest_end?: string | null
          weekly_rest_start?: string | null
          weekly_rest_end?: string | null
          compliance_status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          driver_id?: string
          date?: string
          driving_hours?: number
          working_hours?: number
          break_hours?: number
          rest_hours?: number
          daily_rest_start?: string | null
          daily_rest_end?: string | null
          weekly_rest_start?: string | null
          weekly_rest_end?: string | null
          compliance_status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      driver_documents: {
        Row: {
          id: string
          tenant_id: string
          driver_id: string
          sender_id: string
          title: string
          description: string | null
          document_type: string
          file_path: string | null
          file_type: string | null
          file_size: number | null
          is_read: boolean
          read_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          driver_id: string
          sender_id: string
          title: string
          description?: string | null
          document_type: string
          file_path?: string | null
          file_type?: string | null
          file_size?: number | null
          is_read?: boolean
          read_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          driver_id?: string
          sender_id?: string
          title?: string
          description?: string | null
          document_type?: string
          file_path?: string | null
          file_type?: string | null
          file_size?: number | null
          is_read?: boolean
          read_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
      }
      accident_reports: {
        Row: {
          id: string
          tenant_id: string
          driver_id: string
          vehicle_id: string
          accident_date: string
          location: any
          accident_type: string
          severity: string
          description: string
          injuries_involved: boolean
          injuries_description: string | null
          emergency_services_called: boolean
          police_report_number: string | null
          insurance_claim_number: string | null
          photos: any | null
          witness_details: any | null
          weather_conditions: string | null
          road_conditions: string | null
          estimated_damage_cost: number | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          driver_id: string
          vehicle_id: string
          accident_date: string
          location: any
          accident_type: string
          severity: string
          description: string
          injuries_involved?: boolean
          injuries_description?: string | null
          emergency_services_called?: boolean
          police_report_number?: string | null
          insurance_claim_number?: string | null
          photos?: any | null
          witness_details?: any | null
          weather_conditions?: string | null
          road_conditions?: string | null
          estimated_damage_cost?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          driver_id?: string
          vehicle_id?: string
          accident_date?: string
          location?: any
          accident_type?: string
          severity?: string
          description?: string
          injuries_involved?: boolean
          injuries_description?: string | null
          emergency_services_called?: boolean
          police_report_number?: string | null
          insurance_claim_number?: string | null
          photos?: any | null
          witness_details?: any | null
          weather_conditions?: string | null
          road_conditions?: string | null
          estimated_damage_cost?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Type helpers
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']


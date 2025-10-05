// Utility function to get or create tenant ID consistently
// This ensures all components use the same tenant logic

import { supabase } from '@/lib/supabase'

export async function getOrCreateTenantId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      console.error('No user session found')
      return null
    }

    // First, try to get tenant_id from user metadata
    let tenantId = session.user.user_metadata?.tenant_id
    
    if (tenantId) {
      console.log('Using tenant_id from user metadata:', tenantId)
      return tenantId
    }

    // If no tenant_id in metadata, look for existing tenants
    console.log('No tenant_id in user metadata, looking for existing tenants...')
    
    // Try to find any existing tenant (not just "Default Tenant")
    const { data: existingTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)

    if (tenantsError) {
      console.error('Error fetching existing tenants:', tenantsError)
      return null
    }

    if (existingTenants && existingTenants.length > 0) {
      const existingTenant = existingTenants[0]
      console.log('Found existing tenant:', existingTenant.name, 'ID:', existingTenant.id)
      
      // Update user metadata with the existing tenant ID
      const { error: updateError } = await supabase.auth.updateUser({
        data: { tenant_id: existingTenant.id }
      })
      
      if (updateError) {
        console.error('Error updating user metadata:', updateError)
      } else {
        console.log('Updated user metadata with tenant_id:', existingTenant.id)
      }
      
      return existingTenant.id
    }

    // If no existing tenants, create a new one
    console.log('No existing tenants found, creating new tenant...')
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'Default Tenant',
        settings: {}
      })
      .select('id')
      .single()

    if (tenantError) {
      console.error('Error creating new tenant:', tenantError)
      return null
    }

    console.log('Created new tenant with ID:', newTenant.id)
    
    // Update user metadata with the new tenant ID
    const { error: updateError } = await supabase.auth.updateUser({
      data: { tenant_id: newTenant.id }
    })
    
    if (updateError) {
      console.error('Error updating user metadata with new tenant:', updateError)
    } else {
      console.log('Updated user metadata with new tenant_id:', newTenant.id)
    }

    return newTenant.id

  } catch (error) {
    console.error('Error in getOrCreateTenantId:', error)
    return null
  }
}


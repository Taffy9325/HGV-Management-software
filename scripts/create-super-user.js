#!/usr/bin/env node

/**
 * Script to create a super user
 * Usage: node scripts/create-super-user.js <email> <password>
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createSuperUser(email, password) {
  try {
    console.log(`Creating super user with email: ${email}`)

    // First, create the auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return
    }

    console.log('Auth user created successfully')

    // Get the first tenant (or create one if none exists)
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)

    if (tenantError) {
      console.error('Error fetching tenants:', tenantError)
      return
    }

    let tenantId
    if (tenants && tenants.length > 0) {
      tenantId = tenants[0].id
      console.log('Using existing tenant:', tenantId)
    } else {
      // Create a default tenant
      const { data: newTenant, error: createTenantError } = await supabase
        .from('tenants')
        .insert([{ name: 'Default Tenant' }])
        .select()
        .single()

      if (createTenantError) {
        console.error('Error creating tenant:', createTenantError)
        return
      }

      tenantId = newTenant.id
      console.log('Created new tenant:', tenantId)
    }

    // Create the user profile with super_user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        tenant_id: tenantId,
        email: email,
        role: 'super_user',
        profile: {
          first_name: 'Super',
          last_name: 'User',
          phone: '',
          department: 'System Administration'
        }
      }])
      .select()
      .single()

    if (userError) {
      console.error('Error creating user profile:', userError)
      return
    }

    console.log('Super user created successfully!')
    console.log('User ID:', userData.id)
    console.log('Email:', userData.email)
    console.log('Role:', userData.role)
    console.log('Tenant ID:', userData.tenant_id)

  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Get command line arguments
const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('Usage: node scripts/create-super-user.js <email> <password>')
  console.log('Example: node scripts/create-super-user.js admin@example.com password123')
  process.exit(1)
}

const [email, password] = args

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(email)) {
  console.error('Invalid email format')
  process.exit(1)
}

// Validate password length
if (password.length < 6) {
  console.error('Password must be at least 6 characters long')
  process.exit(1)
}

createSuperUser(email, password)


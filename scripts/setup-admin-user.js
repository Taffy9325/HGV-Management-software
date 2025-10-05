const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function setupAdminUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🔍 Checking environment variables...');
  console.log('Supabase URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
  console.log('Service Role Key:', supabaseServiceKey ? '✅ Found' : '❌ Missing');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please check your .env.local file contains:');
    console.log('NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🏢 Creating default tenant...');
    // Create default tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'Default Organization',
        settings: {
          timezone: 'Europe/London',
          currency: 'GBP',
          country: 'GB'
        }
      })
      .select()
      .single();

    if (tenantError) {
      console.error('❌ Failed to create tenant:', tenantError.message);
      process.exit(1);
    }

    console.log('✅ Created default tenant:', tenant.name);

    console.log('👤 Creating admin user...');
    // Create admin user
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: 'admin@example.com',
      password: 'admin123!',
      email_confirm: true,
      user_metadata: {
        first_name: 'Admin',
        last_name: 'User'
      }
    });

    if (userError) {
      console.error('❌ Failed to create admin user:', userError.message);
      process.exit(1);
    }

    console.log('✅ Created admin user:', user.user.email);

    console.log('📝 Creating user record...');
    // Create user record in users table
    const { error: userRecordError } = await supabase
      .from('users')
      .insert({
        id: user.user.id,
        tenant_id: tenant.id,
        email: user.user.email,
        role: 'admin',
        profile: {
          first_name: 'Admin',
          last_name: 'User',
          phone: '',
          department: 'Administration'
        }
      });

    if (userRecordError) {
      console.error('❌ Failed to create user record:', userRecordError.message);
      process.exit(1);
    }

    console.log('✅ Setup complete!');
    console.log('📧 Admin email: admin@example.com');
    console.log('🔑 Admin password: admin123!');
    console.log('⚠️  Please change the password after first login');
    console.log('🌐 You can now login at: http://localhost:3000/auth/login');

  } catch (err) {
    console.error('❌ Setup error:', err.message);
    process.exit(1);
  }
}

setupAdminUser();


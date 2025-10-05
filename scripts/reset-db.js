const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function resetDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('⚠️  This will reset your database!');
  console.log('⚠️  All data will be lost!');
  console.log('⚠️  This action cannot be undone!');
  
  // In a real implementation, you'd want to add confirmation
  console.log('🔄 Resetting database...');

  try {
    // List of tables to clear (in dependency order)
    const tables = [
      'work_order_parts',
      'work_orders',
      'parts',
      'tachograph_records',
      'examiner_packs',
      'vehicle_status_checks',
      'driver_licence_checks',
      'inspection_documents',
      'safety_inspections',
      'defects',
      'walkaround_checks',
      'jobs',
      'orders',
      'drivers',
      'vehicles',
      'vehicle_types',
      'users',
      'tenants'
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) {
        console.log(`⚠️  Could not clear table ${table}:`, error.message);
      } else {
        console.log(`✅ Cleared table: ${table}`);
      }
    }

    console.log('✅ Database reset complete');
    console.log('💡 Run "npm run setup:admin" to create initial data');

  } catch (err) {
    console.error('❌ Reset error:', err.message);
    process.exit(1);
  }
}

resetDatabase();


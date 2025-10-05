const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function testDatabaseConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('🔍 Checking environment variables...');
  console.log('Supabase URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
  console.log('Supabase Key:', supabaseKey ? '✅ Found' : '❌ Missing');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please check your .env.local file contains:');
    console.log('NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test connection by querying tenants table
    const { data, error } = await supabase
      .from('tenants')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Database connection failed:', error.message);
      console.log('💡 Make sure you have run the database schema first');
      process.exit(1);
    }

    console.log('✅ Database connection successful');
    console.log(`📊 Connected to: ${supabaseUrl}`);
    console.log('🎉 Your HGV Compliance Platform database is ready!');
    
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    process.exit(1);
  }
}

testDatabaseConnection();


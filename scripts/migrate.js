const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const schemaPath = path.join(__dirname, '..', 'supabase-schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Schema file not found:', schemaPath);
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  console.log('📄 Schema file found');
  console.log('⚠️  Please run the following SQL in your Supabase SQL Editor:');
  console.log('─'.repeat(50));
  console.log(schema);
  console.log('─'.repeat(50));
  console.log('✅ Copy the above SQL and execute it in Supabase Dashboard → SQL Editor');
}

runMigrations();


-- Migration script to add tenant_id to vehicle_types table
-- Run this in your Supabase SQL Editor

-- Step 1: Add tenant_id column to vehicle_types table
DO $$ 
BEGIN
    -- Check if tenant_id column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicle_types' 
        AND column_name = 'tenant_id'
    ) THEN
        -- Add tenant_id column
        ALTER TABLE vehicle_types 
        ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added tenant_id column to vehicle_types table';
    ELSE
        RAISE NOTICE 'tenant_id column already exists in vehicle_types table';
    END IF;
END $$;

-- Step 2: Update existing vehicle_types to use Default Tenant
-- This assigns all existing vehicle types to the Default Tenant
UPDATE vehicle_types 
SET tenant_id = (
    SELECT id FROM tenants WHERE name = 'Default Tenant' LIMIT 1
)
WHERE tenant_id IS NULL;

-- Step 3: Make tenant_id NOT NULL after updating existing records
DO $$ 
BEGIN
    -- Check if tenant_id is already NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicle_types' 
        AND column_name = 'tenant_id'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE vehicle_types 
        ALTER COLUMN tenant_id SET NOT NULL;
        
        RAISE NOTICE 'Set tenant_id as NOT NULL in vehicle_types table';
    ELSE
        RAISE NOTICE 'tenant_id is already NOT NULL in vehicle_types table';
    END IF;
END $$;

-- Step 4: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_vehicle_types_tenant_id ON vehicle_types(tenant_id);

-- Step 5: Enable Row Level Security
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
DO $$ 
BEGIN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Users can access their tenant vehicle types" ON vehicle_types;
    
    -- Create new policy
    CREATE POLICY "Users can access their tenant vehicle types" ON vehicle_types 
        FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
        
    RAISE NOTICE 'Created RLS policy for vehicle_types';
END $$;

-- Step 7: Insert some sample vehicle types for the Default Tenant
-- Only insert if they don't already exist
INSERT INTO vehicle_types (tenant_id, name, description, max_weight, max_height, max_length, max_width)
SELECT 
    t.id as tenant_id,
    'Rigid Truck' as name,
    'Standard rigid truck for general haulage' as description,
    7500.00 as max_weight,
    4.0 as max_height,
    12.0 as max_length,
    2.5 as max_width
FROM tenants t
WHERE t.name = 'Default Tenant'
AND NOT EXISTS (SELECT 1 FROM vehicle_types WHERE name = 'Rigid Truck' AND tenant_id = t.id);

INSERT INTO vehicle_types (tenant_id, name, description, max_weight, max_height, max_length, max_width)
SELECT 
    t.id as tenant_id,
    'Articulated Lorry' as name,
    'Articulated lorry for heavy haulage' as description,
    44000.00 as max_weight,
    4.0 as max_height,
    16.5 as max_length,
    2.55 as max_width
FROM tenants t
WHERE t.name = 'Default Tenant'
AND NOT EXISTS (SELECT 1 FROM vehicle_types WHERE name = 'Articulated Lorry' AND tenant_id = t.id);

INSERT INTO vehicle_types (tenant_id, name, description, max_weight, max_height, max_length, max_width)
SELECT 
    t.id as tenant_id,
    'Box Van' as name,
    'Box van for secure cargo transport' as description,
    3500.00 as max_weight,
    2.5 as max_height,
    6.0 as max_length,
    2.0 as max_width
FROM tenants t
WHERE t.name = 'Default Tenant'
AND NOT EXISTS (SELECT 1 FROM vehicle_types WHERE name = 'Box Van' AND tenant_id = t.id);

INSERT INTO vehicle_types (tenant_id, name, description, max_weight, max_height, max_length, max_width)
SELECT 
    t.id as tenant_id,
    'Flatbed Truck' as name,
    'Flatbed truck for open cargo transport' as description,
    18000.00 as max_weight,
    4.0 as max_height,
    12.0 as max_length,
    2.5 as max_width
FROM tenants t
WHERE t.name = 'Default Tenant'
AND NOT EXISTS (SELECT 1 FROM vehicle_types WHERE name = 'Flatbed Truck' AND tenant_id = t.id);

INSERT INTO vehicle_types (tenant_id, name, description, max_weight, max_height, max_length, max_width)
SELECT 
    t.id as tenant_id,
    'Tanker' as name,
    'Tanker for liquid cargo transport' as description,
    26000.00 as max_weight,
    4.0 as max_height,
    12.0 as max_length,
    2.5 as max_width
FROM tenants t
WHERE t.name = 'Default Tenant'
AND NOT EXISTS (SELECT 1 FROM vehicle_types WHERE name = 'Tanker' AND tenant_id = t.id);

-- Step 8: Verify the migration
SELECT 
    'vehicle_types' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as records_with_tenant_id
FROM vehicle_types
UNION ALL
SELECT 
    'tenants' as table_name,
    COUNT(*) as total_records,
    COUNT(*) as records_with_tenant_id
FROM tenants;

-- Step 9: Show sample vehicle types
SELECT 
    vt.id,
    vt.name,
    vt.description,
    vt.max_weight,
    vt.max_height,
    vt.max_length,
    vt.max_width,
    t.name as tenant_name
FROM vehicle_types vt
JOIN tenants t ON vt.tenant_id = t.id
ORDER BY vt.name;


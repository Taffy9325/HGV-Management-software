-- Migration script to add maintenance providers support
-- Run this in your Supabase SQL Editor

-- Step 1: Create maintenance_providers table if it doesn't exist
CREATE TABLE IF NOT EXISTS maintenance_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    specializations TEXT[], -- Array of inspection types they can perform
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add maintenance_provider_id column to inspection_schedules if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inspection_schedules' 
        AND column_name = 'maintenance_provider_id'
    ) THEN
        ALTER TABLE inspection_schedules 
        ADD COLUMN maintenance_provider_id UUID REFERENCES maintenance_providers(id);
    END IF;
END $$;

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_maintenance_providers_tenant_id ON maintenance_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_providers_active ON maintenance_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_provider_id ON inspection_schedules(maintenance_provider_id);

-- Step 4: Enable Row Level Security
ALTER TABLE maintenance_providers ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
DO $$ 
BEGIN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Users can access their tenant maintenance providers" ON maintenance_providers;
    
    -- Create new policy
    CREATE POLICY "Users can access their tenant maintenance providers" ON maintenance_providers 
        FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
END $$;

-- Step 6: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_maintenance_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_maintenance_providers_updated_at ON maintenance_providers;

-- Create trigger
CREATE TRIGGER trigger_update_maintenance_providers_updated_at
    BEFORE UPDATE ON maintenance_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_maintenance_providers_updated_at();

-- Step 7: Update the recurring inspection function to include maintenance provider
CREATE OR REPLACE FUNCTION create_recurring_inspection(
    p_tenant_id UUID,
    p_vehicle_id UUID,
    p_inspection_type VARCHAR(50),
    p_frequency_weeks INTEGER,
    p_maintenance_provider_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    next_date DATE;
    new_schedule_id UUID;
BEGIN
    -- Calculate next inspection date
    next_date := generate_next_inspection_date(p_vehicle_id, p_inspection_type, p_frequency_weeks);
    
    -- Create new schedule
    INSERT INTO inspection_schedules (
        tenant_id,
        vehicle_id,
        maintenance_provider_id,
        inspection_type,
        scheduled_date,
        frequency_weeks,
        notes,
        is_active
    ) VALUES (
        p_tenant_id,
        p_vehicle_id,
        p_maintenance_provider_id,
        p_inspection_type,
        next_date,
        p_frequency_weeks,
        p_notes,
        true
    ) RETURNING id INTO new_schedule_id;
    
    RETURN new_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Insert some sample maintenance providers (optional)
-- You can remove this section if you don't want sample data
INSERT INTO maintenance_providers (tenant_id, name, contact_person, email, phone, address, specializations, is_active)
SELECT 
    t.id as tenant_id,
    'ABC Maintenance Ltd' as name,
    'John Smith' as contact_person,
    'john@abc-maintenance.co.uk' as email,
    '+44 1234 567890' as phone,
    '123 Industrial Estate, Manchester, M1 1AA' as address,
    ARRAY['Safety Inspection', 'MOT Test', 'General Maintenance'] as specializations,
    true as is_active
FROM tenants t
WHERE t.name = 'Default Tenant'
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_providers (tenant_id, name, contact_person, email, phone, address, specializations, is_active)
SELECT 
    t.id as tenant_id,
    'Fleet Services UK' as name,
    'Sarah Johnson' as contact_person,
    'sarah@fleetservices.co.uk' as email,
    '+44 9876 543210' as phone,
    '456 Commercial Road, Birmingham, B1 1BB' as address,
    ARRAY['Tachograph Calibration', 'Vehicle Tax', 'Electrical Work'] as specializations,
    true as is_active
FROM tenants t
WHERE t.name = 'Default Tenant'
ON CONFLICT DO NOTHING;

-- Step 9: Verify the migration
SELECT 
    'maintenance_providers' as table_name,
    COUNT(*) as record_count
FROM maintenance_providers
UNION ALL
SELECT 
    'inspection_schedules' as table_name,
    COUNT(*) as record_count
FROM inspection_schedules;

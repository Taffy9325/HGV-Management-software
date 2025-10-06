-- Migration to update existing user_role enum to new values
-- This handles the existing enum properly

-- Step 1: Check what the current enum values are
DO $$
DECLARE
    current_enum_name text;
    enum_values text[];
BEGIN
    -- Get the current enum type name
    SELECT udt_name INTO current_enum_name
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role';
    
    RAISE NOTICE 'Current enum type: %', current_enum_name;
    
    -- Get current enum values
    EXECUTE format('SELECT array_agg(enumlabel) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = %L)', current_enum_name) INTO enum_values;
    
    RAISE NOTICE 'Current enum values: %', enum_values;
END $$;

-- Step 2: Convert the role column to text temporarily
ALTER TABLE public.users ALTER COLUMN role TYPE text;

-- Step 3: Drop the old enum (this will cascade to remove the type)
DROP TYPE IF EXISTS user_role CASCADE;

-- Step 4: Create the new user_role enum with correct values
CREATE TYPE user_role AS ENUM ('admin', 'driver', 'maintenance_provider');

-- Step 5: Update any existing values to match our new enum
UPDATE public.users SET role = 'driver' WHERE role NOT IN ('admin', 'driver', 'maintenance_provider');

-- Step 6: Convert the column back to use the new enum
ALTER TABLE public.users ALTER COLUMN role TYPE user_role USING role::text::user_role;

-- Step 7: Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 8: Add maintenance_providers table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS maintenance_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    certification_number VARCHAR(100),
    certification_expiry DATE,
    specializations TEXT[],
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    address JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for maintenance_providers
CREATE INDEX IF NOT EXISTS idx_maintenance_providers_tenant_id ON maintenance_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_providers_user_id ON maintenance_providers(user_id);

-- Enable RLS for maintenance_providers
ALTER TABLE maintenance_providers ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for maintenance_providers
DROP POLICY IF EXISTS "Users can access their tenant maintenance providers" ON maintenance_providers;
CREATE POLICY "Users can access their tenant maintenance providers" ON maintenance_providers FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Add updated_at trigger for maintenance_providers
DROP TRIGGER IF EXISTS update_maintenance_providers_updated_at ON maintenance_providers;
CREATE TRIGGER update_maintenance_providers_updated_at BEFORE UPDATE ON maintenance_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Add driver_hours table
CREATE TABLE IF NOT EXISTS driver_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    driving_hours DECIMAL(4,2) DEFAULT 0,
    working_hours DECIMAL(4,2) DEFAULT 0,
    break_hours DECIMAL(4,2) DEFAULT 0,
    rest_hours DECIMAL(4,2) DEFAULT 0,
    daily_rest_start TIMESTAMP WITH TIME ZONE,
    daily_rest_end TIMESTAMP WITH TIME ZONE,
    weekly_rest_start TIMESTAMP WITH TIME ZONE,
    weekly_rest_end TIMESTAMP WITH TIME ZONE,
    compliance_status VARCHAR(20) DEFAULT 'compliant',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for driver_hours
CREATE INDEX IF NOT EXISTS idx_driver_hours_tenant_id ON driver_hours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_hours_driver_id ON driver_hours(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_hours_date ON driver_hours(date);

-- Enable RLS for driver_hours
ALTER TABLE driver_hours ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for driver_hours
DROP POLICY IF EXISTS "Users can access their tenant driver hours" ON driver_hours;
CREATE POLICY "Users can access their tenant driver hours" ON driver_hours FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Add updated_at trigger for driver_hours
DROP TRIGGER IF EXISTS update_driver_hours_updated_at ON driver_hours;
CREATE TRIGGER update_driver_hours_updated_at BEFORE UPDATE ON driver_hours FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Add driver_documents table
CREATE TABLE IF NOT EXISTS driver_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    file_type VARCHAR(50),
    file_size INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for driver_documents
CREATE INDEX IF NOT EXISTS idx_driver_documents_tenant_id ON driver_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_sender_id ON driver_documents(sender_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_document_type ON driver_documents(document_type);

-- Enable RLS for driver_documents
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for driver_documents
DROP POLICY IF EXISTS "Users can access their tenant driver documents" ON driver_documents;
CREATE POLICY "Users can access their tenant driver documents" ON driver_documents FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Step 11: Add accident_reports table
CREATE TABLE IF NOT EXISTS accident_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    accident_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location JSONB NOT NULL,
    accident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    injuries_involved BOOLEAN DEFAULT FALSE,
    injuries_description TEXT,
    emergency_services_called BOOLEAN DEFAULT FALSE,
    police_report_number VARCHAR(100),
    insurance_claim_number VARCHAR(100),
    photos JSONB,
    witness_details JSONB,
    weather_conditions VARCHAR(100),
    road_conditions VARCHAR(100),
    estimated_damage_cost DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'reported',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for accident_reports
CREATE INDEX IF NOT EXISTS idx_accident_reports_tenant_id ON accident_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accident_reports_driver_id ON accident_reports(driver_id);
CREATE INDEX IF NOT EXISTS idx_accident_reports_vehicle_id ON accident_reports(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_accident_reports_accident_date ON accident_reports(accident_date);
CREATE INDEX IF NOT EXISTS idx_accident_reports_status ON accident_reports(status);

-- Enable RLS for accident_reports
ALTER TABLE accident_reports ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for accident_reports
DROP POLICY IF EXISTS "Users can access their tenant accident reports" ON accident_reports;
CREATE POLICY "Users can access their tenant accident reports" ON accident_reports FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Add updated_at trigger for accident_reports
DROP TRIGGER IF EXISTS update_accident_reports_updated_at ON accident_reports;
CREATE TRIGGER update_accident_reports_updated_at BEFORE UPDATE ON accident_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 12: Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'User roles updated to: admin, driver, maintenance_provider';
    RAISE NOTICE 'New tables created: maintenance_providers, driver_hours, driver_documents, accident_reports';
    RAISE NOTICE 'Your existing admin user has been preserved';
END $$;

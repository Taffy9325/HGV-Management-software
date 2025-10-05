-- Maintenance Providers Table
-- This table stores information about companies/persons who perform inspections
CREATE TABLE maintenance_providers (
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

-- Inspection Schedules Table
-- This table manages scheduled inspections with different types and frequencies
CREATE TABLE inspection_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    maintenance_provider_id UUID REFERENCES maintenance_providers(id),
    inspection_type VARCHAR(50) NOT NULL CHECK (inspection_type IN ('safety_inspection', 'tax', 'mot', 'tacho_calibration')),
    scheduled_date DATE NOT NULL,
    frequency_weeks INTEGER NOT NULL DEFAULT 26 CHECK (frequency_weeks > 0 AND frequency_weeks <= 104),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_maintenance_providers_tenant_id ON maintenance_providers(tenant_id);
CREATE INDEX idx_maintenance_providers_active ON maintenance_providers(is_active);
CREATE INDEX idx_inspection_schedules_tenant_id ON inspection_schedules(tenant_id);
CREATE INDEX idx_inspection_schedules_vehicle_id ON inspection_schedules(vehicle_id);
CREATE INDEX idx_inspection_schedules_provider_id ON inspection_schedules(maintenance_provider_id);
CREATE INDEX idx_inspection_schedules_scheduled_date ON inspection_schedules(scheduled_date);
CREATE INDEX idx_inspection_schedules_inspection_type ON inspection_schedules(inspection_type);
CREATE INDEX idx_inspection_schedules_active ON inspection_schedules(is_active);

-- Enable Row Level Security
ALTER TABLE maintenance_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can access their tenant maintenance providers" ON maintenance_providers 
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can access their tenant inspection schedules" ON inspection_schedules 
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Create function to automatically generate next inspection dates
CREATE OR REPLACE FUNCTION generate_next_inspection_date(
    p_vehicle_id UUID,
    p_inspection_type VARCHAR(50),
    p_frequency_weeks INTEGER
) RETURNS DATE AS $$
DECLARE
    last_inspection_date DATE;
    next_date DATE;
BEGIN
    -- Get the last inspection date for this vehicle and type
    SELECT MAX(scheduled_date) INTO last_inspection_date
    FROM inspection_schedules
    WHERE vehicle_id = p_vehicle_id 
    AND inspection_type = p_inspection_type
    AND is_active = true;
    
    -- If no previous inspection, use current date
    IF last_inspection_date IS NULL THEN
        last_inspection_date := CURRENT_DATE;
    END IF;
    
    -- Calculate next date
    next_date := last_inspection_date + INTERVAL '1 week' * p_frequency_weeks;
    
    RETURN next_date;
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically create recurring inspections
CREATE OR REPLACE FUNCTION create_recurring_inspection(
    p_tenant_id UUID,
    p_vehicle_id UUID,
    p_maintenance_provider_id UUID,
    p_inspection_type VARCHAR(50),
    p_frequency_weeks INTEGER,
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_maintenance_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_maintenance_providers_updated_at
    BEFORE UPDATE ON maintenance_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_maintenance_providers_updated_at();

CREATE OR REPLACE FUNCTION update_inspection_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inspection_schedules_updated_at
    BEFORE UPDATE ON inspection_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_inspection_schedules_updated_at();

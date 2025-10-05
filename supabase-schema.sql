-- HGV Compliance Platform Database Schema
-- Supabase PostgreSQL with PostGIS extension

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'planner', 'driver', 'mechanic', 'fleet_manager');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_status AS ENUM ('available', 'in_use', 'maintenance', 'out_of_service');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE driver_status AS ENUM ('available', 'on_duty', 'on_break', 'off_duty');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('draft', 'planned', 'dispatched', 'in_progress', 'completed', 'cancelled', 'invoiced');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('planned', 'dispatched', 'accepted', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE defect_severity AS ENUM ('minor', 'major', 'dangerous');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE defect_status AS ENUM ('open', 'in_repair', 'closed', 'immediate_vor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'driver',
    profile JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicle types table
CREATE TABLE vehicle_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_weight DECIMAL(10,2),
    max_height DECIMAL(5,2),
    max_length DECIMAL(5,2),
    max_width DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    registration VARCHAR(20) UNIQUE NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    vehicle_type_id UUID REFERENCES vehicle_types(id),
    dimensions JSONB DEFAULT '{}',
    adr_classifications TEXT[],
    fuel_type VARCHAR(50) DEFAULT 'diesel',
    status vehicle_status DEFAULT 'available',
    current_location GEOMETRY(POINT, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    licence_number VARCHAR(20) UNIQUE NOT NULL,
    licence_expiry DATE,
    cpc_expiry DATE,
    tacho_card_expiry DATE,
    status driver_status DEFAULT 'available',
    current_location GEOMETRY(POINT, 4326),
    max_driving_hours INTEGER DEFAULT 9,
    current_driving_hours DECIMAL(4,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    consignor JSONB NOT NULL,
    consignee JSONB NOT NULL,
    pickup_location GEOMETRY(POINT, 4326),
    delivery_location GEOMETRY(POINT, 4326),
    pickup_window_start TIMESTAMP WITH TIME ZONE,
    pickup_window_end TIMESTAMP WITH TIME ZONE,
    delivery_window_start TIMESTAMP WITH TIME ZONE,
    delivery_window_end TIMESTAMP WITH TIME ZONE,
    load_details JSONB NOT NULL,
    adr_flags TEXT[],
    special_instructions TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    status order_status DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    status job_status DEFAULT 'planned',
    planned_start TIMESTAMP WITH TIME ZONE,
    planned_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    route_plan JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Walkaround checks table
CREATE TABLE walkaround_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    check_data JSONB NOT NULL,
    defects_found BOOLEAN DEFAULT FALSE,
    vor_required BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Defects table
CREATE TABLE defects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    walkaround_id UUID REFERENCES walkaround_checks(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    defect_type VARCHAR(100) NOT NULL,
    severity defect_severity NOT NULL,
    description TEXT,
    location VARCHAR(255),
    status defect_status DEFAULT 'open',
    repair_required BOOLEAN DEFAULT TRUE,
    vor_immediate BOOLEAN DEFAULT FALSE,
    estimated_repair_cost DECIMAL(10,2),
    repair_deadline TIMESTAMP WITH TIME ZONE,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Safety inspections table
CREATE TABLE safety_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    inspector_id UUID NOT NULL REFERENCES users(id),
    inspection_data JSONB NOT NULL,
    inspection_passed BOOLEAN NOT NULL,
    next_inspection_due TIMESTAMP WITH TIME ZONE NOT NULL,
    inspection_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inspection documents table (Supabase Storage integration)
CREATE TABLE inspection_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    inspection_type VARCHAR(50) NOT NULL,
    supabase_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver licence checks table
CREATE TABLE driver_licence_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    licence_number VARCHAR(20) NOT NULL,
    check_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    licence_data JSONB NOT NULL,
    is_valid BOOLEAN NOT NULL,
    expires_soon BOOLEAN DEFAULT FALSE,
    has_endorsements BOOLEAN DEFAULT FALSE
);

-- Vehicle status checks table
CREATE TABLE vehicle_status_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    registration VARCHAR(20) NOT NULL,
    check_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mot_data JSONB,
    tax_data JSONB,
    mot_valid BOOLEAN,
    mot_expires_soon BOOLEAN DEFAULT FALSE,
    tax_valid BOOLEAN
);

-- Examiner packs table (DVSA compliance)
CREATE TABLE examiner_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    pack_data JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    download_url VARCHAR(500)
);

-- Tachograph records table
CREATE TABLE tachograph_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    card_number VARCHAR(20) NOT NULL,
    card_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
    vu_download_due TIMESTAMP WITH TIME ZONE NOT NULL,
    driver_card_download_due TIMESTAMP WITH TIME ZONE NOT NULL,
    last_download_date TIMESTAMP WITH TIME ZONE,
    download_frequency_days INTEGER DEFAULT 28,
    compliance_status VARCHAR(20) DEFAULT 'compliant',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work orders table
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    defect_id UUID REFERENCES defects(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'open',
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    estimated_duration INTEGER, -- minutes
    actual_duration INTEGER, -- minutes
    assigned_mechanic_id UUID REFERENCES users(id),
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts table
CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    part_number VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    supplier VARCHAR(255),
    cost DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work order parts table
CREATE TABLE work_order_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES parts(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_vehicles_tenant_id ON vehicles(tenant_id);
CREATE INDEX idx_vehicles_registration ON vehicles(registration);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_drivers_tenant_id ON drivers(tenant_id);
CREATE INDEX idx_drivers_licence_number ON drivers(licence_number);
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_pickup_window ON orders(pickup_window_start, pickup_window_end);
CREATE INDEX idx_jobs_tenant_id ON jobs(tenant_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_walkaround_checks_vehicle_id ON walkaround_checks(vehicle_id);
CREATE INDEX idx_walkaround_checks_completed_at ON walkaround_checks(completed_at);
CREATE INDEX idx_defects_vehicle_id ON defects(vehicle_id);
CREATE INDEX idx_defects_status ON defects(status);
CREATE INDEX idx_defects_severity ON defects(severity);
CREATE INDEX idx_inspection_documents_inspection_id ON inspection_documents(inspection_id);
CREATE INDEX idx_work_orders_vehicle_id ON work_orders(vehicle_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);

-- Create spatial indexes
CREATE INDEX idx_vehicles_location ON vehicles USING GIST(current_location);
CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location);
CREATE INDEX idx_orders_pickup_location ON orders USING GIST(pickup_location);
CREATE INDEX idx_orders_delivery_location ON orders USING GIST(delivery_location);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkaround_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_licence_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_status_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE examiner_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tachograph_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_parts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant access
CREATE POLICY "Users can access their tenant data" ON tenants FOR ALL USING (id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant users" ON users FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant vehicles" ON vehicles FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant drivers" ON drivers FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant orders" ON orders FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant jobs" ON jobs FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant walkaround checks" ON walkaround_checks FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant defects" ON defects FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant safety inspections" ON safety_inspections FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant inspection documents" ON inspection_documents FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant driver licence checks" ON driver_licence_checks FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant vehicle status checks" ON vehicle_status_checks FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant examiner packs" ON examiner_packs FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant tachograph records" ON tachograph_records FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant work orders" ON work_orders FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant parts" ON parts FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can access their tenant work order parts" ON work_order_parts FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Insert sample data
INSERT INTO vehicle_types (name, description, max_weight, max_height, max_length, max_width) VALUES
('Rigid Truck', 'Single unit truck', 26000, 4.0, 12.0, 2.55),
('Articulated Truck', 'Tractor unit with trailer', 44000, 4.0, 16.5, 2.55),
('Drawbar Trailer', 'Truck with drawbar trailer', 44000, 4.0, 18.75, 2.55);

-- Create storage bucket for inspection documents (run this separately in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('inspections', 'inspections', false);

-- Storage policies (run these separately in Supabase Dashboard after creating the bucket)
-- CREATE POLICY "Users can upload inspection files" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'inspections' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can view own inspection files" ON storage.objects FOR SELECT USING (
--   bucket_id = 'inspections' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can delete own inspection files" ON storage.objects FOR DELETE USING (
--   bucket_id = 'inspections' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );


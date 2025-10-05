-- RLS Policies for HGV Compliance Platform (DISABLED FOR SETUP)
-- Run this AFTER running the main schema (supabase-schema-simple.sql)

-- IMPORTANT: This file DISABLES RLS for initial setup
-- You can enable proper multi-tenant policies later once everything is working

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access their tenant data" ON tenants;
DROP POLICY IF EXISTS "Users can access their tenant users" ON users;
DROP POLICY IF EXISTS "Users can access their tenant vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can access their tenant drivers" ON drivers;
DROP POLICY IF EXISTS "Users can access their tenant orders" ON orders;
DROP POLICY IF EXISTS "Users can access their tenant jobs" ON jobs;
DROP POLICY IF EXISTS "Users can access their tenant walkaround checks" ON walkaround_checks;
DROP POLICY IF EXISTS "Users can access their tenant defects" ON defects;
DROP POLICY IF EXISTS "Users can access their tenant safety inspections" ON safety_inspections;
DROP POLICY IF EXISTS "Users can access their tenant inspection documents" ON inspection_documents;
DROP POLICY IF EXISTS "Users can access their tenant driver licence checks" ON driver_licence_checks;
DROP POLICY IF EXISTS "Users can access their tenant vehicle status checks" ON vehicle_status_checks;
DROP POLICY IF EXISTS "Users can access their tenant examiner packs" ON examiner_packs;
DROP POLICY IF EXISTS "Users can access their tenant tachograph records" ON tachograph_records;
DROP POLICY IF EXISTS "Users can access their tenant work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can access their tenant parts" ON parts;
DROP POLICY IF EXISTS "Users can access their tenant work order parts" ON work_order_parts;

-- DISABLE RLS for all tables (for initial setup)
-- This allows full access to all data for development/testing
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE walkaround_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE defects DISABLE ROW LEVEL SECURITY;
ALTER TABLE safety_inspections DISABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE driver_licence_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_status_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE examiner_packs DISABLE ROW LEVEL SECURITY;
ALTER TABLE tachograph_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_parts DISABLE ROW LEVEL SECURITY;

-- NOTE: To enable proper multi-tenant security later, you would:
-- 1. Re-enable RLS: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
-- 2. Create proper policies that reference tenant_id columns
-- 3. Ensure your application code filters by tenant_id in queries

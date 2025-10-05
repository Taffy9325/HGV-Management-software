-- Check if maintenance providers exist in your database
-- Run this in your Supabase SQL Editor to debug

-- 1. Check if the table exists
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'maintenance_providers';

-- 2. Check if there are any maintenance providers
SELECT 
    COUNT(*) as total_providers,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_providers
FROM maintenance_providers;

-- 3. List all maintenance providers with their details
SELECT 
    id,
    name,
    contact_person,
    email,
    phone,
    is_active,
    specializations,
    tenant_id,
    created_at
FROM maintenance_providers
ORDER BY created_at DESC;

-- 4. Check if you have a default tenant
SELECT 
    id,
    name,
    created_at
FROM tenants
WHERE name = 'Default Tenant';

-- 5. Check if the maintenance_provider_id column exists in inspection_schedules
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'inspection_schedules' 
AND column_name = 'maintenance_provider_id';

-- 6. If no providers exist, insert some sample ones
-- (Only run this if the count above shows 0 providers)
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
AND NOT EXISTS (SELECT 1 FROM maintenance_providers WHERE name = 'ABC Maintenance Ltd');

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
AND NOT EXISTS (SELECT 1 FROM maintenance_providers WHERE name = 'Fleet Services UK');


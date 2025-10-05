-- Add maintenance providers to your database
-- Run this in your Supabase SQL Editor

-- First, let's check what tenant we're working with
SELECT 
    id,
    name,
    created_at
FROM tenants
ORDER BY created_at DESC;

-- If you don't have a Default Tenant, create one
INSERT INTO tenants (name, settings)
SELECT 'Default Tenant', '{}'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE name = 'Default Tenant');

-- Get the tenant ID (replace 'your-tenant-id' with the actual ID from above)
-- For now, we'll use the Default Tenant
WITH tenant_info AS (
    SELECT id FROM tenants WHERE name = 'Default Tenant' LIMIT 1
)
INSERT INTO maintenance_providers (
    tenant_id, 
    name, 
    contact_person, 
    email, 
    phone, 
    address, 
    specializations, 
    is_active
)
SELECT 
    t.id,
    'ABC Maintenance Ltd',
    'John Smith',
    'john@abc-maintenance.co.uk',
    '+44 1234 567890',
    '123 Industrial Estate, Manchester, M1 1AA',
    ARRAY['Safety Inspection', 'MOT Test', 'General Maintenance'],
    true
FROM tenant_info t
WHERE NOT EXISTS (SELECT 1 FROM maintenance_providers WHERE name = 'ABC Maintenance Ltd');

-- Add a second provider
WITH tenant_info AS (
    SELECT id FROM tenants WHERE name = 'Default Tenant' LIMIT 1
)
INSERT INTO maintenance_providers (
    tenant_id, 
    name, 
    contact_person, 
    email, 
    phone, 
    address, 
    specializations, 
    is_active
)
SELECT 
    t.id,
    'Fleet Services UK',
    'Sarah Johnson',
    'sarah@fleetservices.co.uk',
    '+44 9876 543210',
    '456 Commercial Road, Birmingham, B1 1BB',
    ARRAY['Tachograph Calibration', 'Vehicle Tax', 'Electrical Work'],
    true
FROM tenant_info t
WHERE NOT EXISTS (SELECT 1 FROM maintenance_providers WHERE name = 'Fleet Services UK');

-- Add a third provider
WITH tenant_info AS (
    SELECT id FROM tenants WHERE name = 'Default Tenant' LIMIT 1
)
INSERT INTO maintenance_providers (
    tenant_id, 
    name, 
    contact_person, 
    email, 
    phone, 
    address, 
    specializations, 
    is_active
)
SELECT 
    t.id,
    'Quick Fix Garage',
    'Mike Wilson',
    'mike@quickfixgarage.co.uk',
    '+44 5555 123456',
    '789 High Street, London, SW1A 1AA',
    ARRAY['Safety Inspection', 'Brake Service', 'Tire Service', 'Engine Service'],
    true
FROM tenant_info t
WHERE NOT EXISTS (SELECT 1 FROM maintenance_providers WHERE name = 'Quick Fix Garage');

-- Verify the providers were added
SELECT 
    id,
    name,
    contact_person,
    email,
    phone,
    is_active,
    specializations,
    tenant_id
FROM maintenance_providers
ORDER BY created_at DESC;


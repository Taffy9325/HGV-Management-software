-- Diagnostic script to check tenant ID matching
-- Run this in your Supabase SQL Editor

-- 1. Check all tenants
SELECT 
    id,
    name,
    created_at
FROM tenants
ORDER BY created_at DESC;

-- 2. Check all maintenance providers and their tenant IDs
SELECT 
    id,
    name,
    tenant_id,
    is_active,
    created_at
FROM maintenance_providers
ORDER BY created_at DESC;

-- 3. Check if there's a mismatch between tenant IDs
-- This will show providers that don't have matching tenants
SELECT 
    mp.id,
    mp.name,
    mp.tenant_id,
    mp.is_active,
    t.name as tenant_name
FROM maintenance_providers mp
LEFT JOIN tenants t ON mp.tenant_id = t.id
ORDER BY mp.created_at DESC;

-- 4. Check what tenant ID your user should be using
-- Replace 'your-user-id' with your actual user ID from Supabase Auth
-- You can find this in Supabase Dashboard > Authentication > Users
SELECT 
    id,
    email,
    user_metadata
FROM auth.users
WHERE email = 'your-email@example.com'; -- Replace with your actual email

-- 5. If you need to update providers to use the correct tenant ID
-- First, find the correct tenant ID from step 1, then run:
-- UPDATE maintenance_providers 
-- SET tenant_id = 'correct-tenant-id-here'
-- WHERE tenant_id = 'old-tenant-id-here';

-- 6. Alternative: Create a new tenant and move providers to it
-- INSERT INTO tenants (name, settings) VALUES ('Your Company', '{}');
-- Then update providers to use the new tenant ID


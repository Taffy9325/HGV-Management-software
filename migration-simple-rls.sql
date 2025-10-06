-- Simple RLS fix for user creation (no timeout issues)
-- Run this in Supabase SQL editor

-- Step 1: Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- Step 2: Drop existing policies (if they exist)
DROP POLICY IF EXISTS "Users can access their tenant users" ON users;
DROP POLICY IF EXISTS "Users can insert their tenant users" ON users;
DROP POLICY IF EXISTS "Authenticated users can insert users in their tenant" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can delete users in their tenant" ON users;

-- Step 3: Create simple, efficient policies
CREATE POLICY "tenant_users_access" ON users 
FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Step 4: Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';

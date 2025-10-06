-- Quick RLS fix for user creation
-- This should run without timeout issues

-- Drop any existing policies on users table
DROP POLICY IF EXISTS "Users can access their tenant users" ON users;
DROP POLICY IF EXISTS "Users can insert their tenant users" ON users;
DROP POLICY IF EXISTS "tenant_users_access" ON users;

-- Create a simple policy that allows users to manage users in their tenant
CREATE POLICY "tenant_users_access" ON users 
FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Verify the policy was created
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users';

-- Fix RLS policies for user creation
-- This ensures admins can create users in their tenant

-- Drop existing policies
DROP POLICY IF EXISTS "Users can access their tenant users" ON users;
DROP POLICY IF EXISTS "Users can insert their tenant users" ON users;

-- Create new policies that allow admin users to create other users
CREATE POLICY "Users can access their tenant users" ON users 
FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Allow authenticated users to insert users in their tenant
CREATE POLICY "Authenticated users can insert users in their tenant" ON users 
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON users 
FOR UPDATE USING (id = auth.uid());

-- Allow users to delete users in their tenant (for admin functionality)
CREATE POLICY "Users can delete users in their tenant" ON users 
FOR DELETE USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

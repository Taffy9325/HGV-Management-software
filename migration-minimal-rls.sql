-- Minimal RLS fix - just the essential policy
-- This should run quickly without timeout

DROP POLICY IF EXISTS "tenant_users_access" ON users;
CREATE POLICY "tenant_users_access" ON users FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

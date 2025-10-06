-- Migration using VARCHAR with CHECK constraint instead of enum
-- This works without superuser privileges

-- Step 1: Convert the role column to text first
ALTER TABLE public.users ALTER COLUMN role TYPE text;

-- Step 2: Add a CHECK constraint to ensure only valid roles
ALTER TABLE public.users ADD CONSTRAINT check_user_role 
CHECK (role IN ('admin', 'driver', 'maintenance_provider'));

-- Step 3: Update any existing values to match our new roles
UPDATE public.users SET role = 'driver' WHERE role NOT IN ('admin', 'driver', 'maintenance_provider');

-- Step 4: Set a default value
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'driver';

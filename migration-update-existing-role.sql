-- Migration to update existing role column to new enum values

-- Step 1: Create the user_role enum
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('admin', 'driver', 'maintenance_provider');

-- Step 2: Convert existing role column to text first (to avoid type conflicts)
ALTER TABLE public.users ALTER COLUMN role TYPE text;

-- Step 3: Update any existing values to match our new enum
UPDATE public.users SET role = 'driver' WHERE role IS NULL OR role NOT IN ('admin', 'driver', 'maintenance_provider');

-- Step 4: Convert the column to use the new enum type
ALTER TABLE public.users ALTER COLUMN role TYPE user_role USING role::text::user_role;

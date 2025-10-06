-- Simple migration to update role column with explicit schema references

-- Step 1: Convert the role column to text first
ALTER TABLE public.users ALTER COLUMN role TYPE text;

-- Step 2: Drop the old enum
DROP TYPE IF EXISTS user_role CASCADE;

-- Step 3: Create the new user_role enum
CREATE TYPE user_role AS ENUM ('admin', 'driver', 'maintenance_provider');

-- Step 4: Update any existing values to match our new enum
UPDATE public.users SET role = 'driver' WHERE role NOT IN ('admin', 'driver', 'maintenance_provider');

-- Step 5: Convert the column back to use the new enum
ALTER TABLE public.users ALTER COLUMN role TYPE user_role USING role::text::user_role;

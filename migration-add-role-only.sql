-- Step 1: Add role column to users table
ALTER TABLE public.users ADD COLUMN role VARCHAR(50) DEFAULT 'driver';

-- Step 2: Create the user_role enum
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('admin', 'driver', 'maintenance_provider');

-- Step 3: Update the role column to use the enum
ALTER TABLE public.users ALTER COLUMN role TYPE user_role USING role::text::user_role;

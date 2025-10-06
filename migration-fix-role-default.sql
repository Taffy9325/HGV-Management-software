-- Fix the role column default value issue

-- Step 1: Check what the current default is
DO $$
DECLARE
    current_default text;
BEGIN
    SELECT column_default INTO current_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role';
    
    RAISE NOTICE 'Current role column default: %', current_default;
END $$;

-- Step 2: Remove the old default first
ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;

-- Step 3: Set the new default as text
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'driver';

-- Step 4: Verify the change
DO $$
DECLARE
    new_default text;
BEGIN
    SELECT column_default INTO new_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role';
    
    RAISE NOTICE 'New role column default: %', new_default;
END $$;

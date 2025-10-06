-- Update user display name directly in Supabase Auth
-- Run this in Supabase SQL editor (requires admin privileges)

-- Update auth.users metadata
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{display_name}',
  '"Rhys Hughes"'::jsonb
)
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Update auth.users metadata with first and last name
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{first_name}',
    '"Rhys"'::jsonb
  ),
  '{last_name}',
  '"Hughes"'::jsonb
)
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Update your custom users table
UPDATE public.users 
SET profile = jsonb_set(
  jsonb_set(
    COALESCE(profile, '{}'::jsonb),
    '{first_name}',
    '"Rhys"'::jsonb
  ),
  '{last_name}',
  '"Hughes"'::jsonb
)
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

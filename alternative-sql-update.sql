-- Alternative SQL approach to update auth user display name
-- This uses a different method that might work better

-- First, check what's currently there
SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Try updating with a different approach
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"display_name": "Rhys Hughes", "name": "Rhys Hughes", "full_name": "Rhys Hughes"}'::jsonb
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Or try this approach (merge existing metadata)
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  '{"display_name": "Rhys Hughes", "name": "Rhys Hughes", "full_name": "Rhys Hughes", "first_name": "Rhys", "last_name": "Hughes"}'::jsonb
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Alternative: If you want to merge two separate JSON objects, use this syntax:
-- UPDATE auth.users 
-- SET raw_user_meta_data = raw_user_meta_data || '{"first_name": "Rhys"}'::jsonb || '{"last_name": "Hughes"}'::jsonb
-- WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Check the result
SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

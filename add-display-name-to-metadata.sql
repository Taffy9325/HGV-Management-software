-- Add display_name to existing raw_user_meta_data
-- This preserves your existing metadata and adds the display_name field

UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"display_name": "Rhys Hughes"}'::jsonb
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Alternative: Add multiple display-related fields at once
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || 
  '{"display_name": "Rhys Hughes", "name": "Rhys Hughes", "full_name": "Rhys Hughes"}'::jsonb
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Check the result
SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Check current auth user metadata
-- Run this to see what fields are available

SELECT 
  id,
  email,
  raw_user_meta_data,
  raw_app_meta_data,
  user_metadata,
  app_metadata
FROM auth.users 
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

-- Also check what fields Supabase uses for display
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', email) as display_name,
  raw_user_meta_data
FROM auth.users 
WHERE id = '950a0cc2-71b6-4883-80f3-b4450b4914f8';

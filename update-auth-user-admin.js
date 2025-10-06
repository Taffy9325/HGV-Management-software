// Update auth user display name using Supabase Admin API
// This should work better than direct SQL updates

import { createClient } from '@supabase/supabase-js'

// You'll need your service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // This is different from the anon key
)

const updateAuthUserDisplayName = async (userId: string, firstName: string, lastName: string) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        display_name: `${firstName} ${lastName}`,
        name: `${firstName} ${lastName}` // Some systems use 'name' field
      }
    })

    if (error) {
      console.error('Error updating auth user:', error)
      return { success: false, error }
    }

    console.log('Auth user updated successfully:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Error updating auth user:', error)
    return { success: false, error }
  }
}

// Usage:
// updateAuthUserDisplayName('950a0cc2-71b6-4883-80f3-b4450b4914f8', 'Rhys', 'Hughes')

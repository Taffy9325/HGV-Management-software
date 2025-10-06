// Update user display name in Supabase Auth
// This updates the user_metadata which affects the display name

import { supabase } from '@/lib/supabase'

const updateUserDisplayName = async (userId: string, firstName: string, lastName: string) => {
  try {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        display_name: `${firstName} ${lastName}`
      }
    })

    if (error) {
      console.error('Error updating user metadata:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error updating user:', error)
    return { success: false, error }
  }
}

// Usage example:
// updateUserDisplayName('user-id-here', 'John', 'Smith')

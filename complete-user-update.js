// Complete user display name update
// Updates both Supabase Auth metadata and your custom users table

import { supabase } from '@/lib/supabase'

const updateUserDisplayNameComplete = async (userId: string, firstName: string, lastName: string) => {
  try {
    // Update Supabase Auth metadata
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        display_name: `${firstName} ${lastName}`
      }
    })

    if (authError) {
      console.error('Error updating auth metadata:', authError)
      return { success: false, error: authError }
    }

    // Update your custom users table
    const { error: profileError } = await supabase
      .from('users')
      .update({
        profile: {
          first_name: firstName,
          last_name: lastName
        }
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating user profile:', profileError)
      return { success: false, error: profileError }
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating user:', error)
    return { success: false, error }
  }
}

// Usage example:
// updateUserDisplayNameComplete('user-id-here', 'John', 'Smith')

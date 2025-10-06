// Update user profile in your custom users table
// This updates the profile JSON field with the new names

import { supabase } from '@/lib/supabase'

const updateUserProfile = async (userId: string, firstName: string, lastName: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        profile: {
          first_name: firstName,
          last_name: lastName,
          phone: '', // Keep existing phone if any
          department: '' // Keep existing department
        }
      })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('Error updating user profile:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { success: false, error }
  }
}

// Usage example:
// updateUserProfile('user-id-here', 'John', 'Smith')

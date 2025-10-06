'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function UpdateDisplayName() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    userId: '950a0cc2-71b6-4883-80f3-b4450b4914f8',
    firstName: 'Rhys',
    lastName: 'Hughes'
  })

  const handleUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Method 1: Update through auth admin (if you have service role key)
      const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(formData.userId, {
        user_metadata: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: `${formData.firstName} ${formData.lastName}`,
          display_name: `${formData.firstName} ${formData.lastName}`,
          name: `${formData.firstName} ${formData.lastName}`
        }
      })

      if (authError) {
        console.error('Auth update error:', authError)
        alert('Auth update failed: ' + authError.message)
        return
      }

      // Method 2: Update your custom users table
      const { error: profileError } = await supabase
        .from('users')
        .update({
          profile: {
            first_name: formData.firstName,
            last_name: formData.lastName
          }
        })
        .eq('id', formData.userId)

      if (profileError) {
        console.error('Profile update error:', profileError)
        alert('Profile update failed: ' + profileError.message)
        return
      }

      alert('Display name updated successfully!')
    } catch (error) {
      console.error('Error updating display name:', error)
      alert('Error updating display name: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Update Display Name</h2>
      
      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">User ID</label>
          <input
            type="text"
            value={formData.userId}
            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Display Name'}
        </button>
      </form>
    </div>
  )
}

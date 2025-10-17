'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function InvitedSignup() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [invitation, setInvitation] = useState<{ id: string; email: string; role: string; tenant_id: string; first_name: string; last_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingUp, setSigningUp] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (token) {
      fetchInvitation()
    } else {
      router.push('/auth/login')
    }
  }, [token])

  const fetchInvitation = async () => {
    if (!supabase || !token) return

    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('invitation_token', token)
        .eq('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !data) {
        alert('Invalid or expired invitation')
        router.push('/auth/login')
        return
      }

      setInvitation(data)
    } catch (error) {
      console.error('Error fetching invitation:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !invitation) return

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    setSigningUp(true)

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: formData.password,
        options: {
          data: {
            first_name: invitation.first_name,
            last_name: invitation.last_name,
            full_name: `${invitation.first_name} ${invitation.last_name}`,
            display_name: `${invitation.first_name} ${invitation.last_name}`,
            role: invitation.role
          }
        }
      })

      if (authError) {
        alert('Error creating account: ' + authError.message)
        return
      }

      if (!authData.user) {
        alert('Error: No user data returned')
        return
      }

      // Create user profile
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          tenant_id: invitation.tenant_id,
          email: invitation.email,
          role: invitation.role,
          profile: {
            first_name: invitation.first_name,
            last_name: invitation.last_name,
            phone: '',
            department: invitation.role === 'admin' ? 'Administration' : 
                       invitation.role === 'driver' ? 'Driving' : 'Maintenance'
          }
        })

      if (userError) {
        console.error('Error creating user profile:', userError)
        alert('Error creating user profile: ' + userError.message)
        return
      }

      // Create role-specific records
      if (invitation.role === 'driver') {
        const { error: driverError } = await supabase
          .from('drivers')
          .insert({
            tenant_id: invitation.tenant_id,
            user_id: authData.user.id,
            licence_number: '',
            licence_expiry: null,
            cpc_expiry: null,
            tacho_card_expiry: null
          })

        if (driverError) {
          console.error('Error creating driver record:', driverError)
        }
      } else if (invitation.role === 'maintenance_provider') {
        const { error: maintenanceError } = await supabase
          .from('maintenance_providers')
          .insert({
            tenant_id: invitation.tenant_id,
            user_id: authData.user.id,
            company_name: '',
            certification_number: null,
            certification_expiry: null,
            specializations: [],
            contact_phone: null,
            contact_email: null,
            address: {}
          })

        if (maintenanceError) {
          console.error('Error creating maintenance provider record:', maintenanceError)
        }
      }

      // Mark invitation as used
      await supabase
        .from('user_invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invitation.id)

      alert('Account created successfully! Please check your email to confirm your account.')
      router.push('/auth/login')

    } catch (error) {
      console.error('Error during signup:', error)
      alert('Error creating account')
    } finally {
      setSigningUp(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h1>
          <p className="text-gray-600">This invitation is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Account Setup
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Welcome, {invitation.first_name} {invitation.last_name}
          </p>
          <p className="mt-1 text-center text-sm text-gray-500">
            Role: {invitation.role.replace('_', ' ').toUpperCase()}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={invitation.email}
              disabled
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Enter your password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Confirm your password"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={signingUp}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {signingUp ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

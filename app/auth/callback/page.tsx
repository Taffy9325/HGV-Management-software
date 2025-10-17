'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        if (!supabase) {
          console.error('Supabase client not available')
          router.push('/auth/login?error=supabase_not_available')
          return
        }

        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth/login?error=auth_callback_error')
          return
        }

        if (data.session) {
          // Get user profile to determine role-based redirect
          const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.session.user.id)
            .single()

          // Redirect based on user role
          if (userProfile?.role === 'super_user' || userProfile?.role === 'admin') {
            router.push('/admin/dashboard')
          } else if (userProfile?.role === 'driver') {
            router.push('/driver')
          } else if (userProfile?.role === 'maintenance_provider') {
            router.push('/maintenance')
          } else {
            router.push('/dashboard')
          }
        } else {
          // No session, redirect to login
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        router.push('/auth/login?error=unexpected_error')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
            <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Completing sign in...
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please wait while we complete your authentication.
          </p>
        </div>
      </div>
    </div>
  )
}

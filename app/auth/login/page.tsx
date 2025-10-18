'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState<string>('')

  // Set the redirect URL dynamically
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectUrl(`${window.location.origin}/auth/callback`)
    }
  }, [])

  // Check for error parameters in URL
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      switch (errorParam) {
        case 'supabase_not_available':
          setError('Authentication service is not configured. Please contact your administrator.')
          break
        case 'auth_callback_error':
          setError('Authentication failed. Please try again.')
          break
        case 'unexpected_error':
          setError('An unexpected error occurred. Please try again.')
          break
        default:
          setError('Authentication failed. Please try again.')
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!supabase) {
      setError('Authentication service is not configured. Please contact your administrator.')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setIsLoading(true)
        try {
          // Get user profile to determine role-based redirect
          const { data: userProfile, error: profileError } = await supabase!
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

          if (profileError) {
            console.error('Error fetching user profile:', profileError)
            setError('Failed to load user profile. Please try again.')
            setIsLoading(false)
            return
          }

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
        } catch (error) {
          console.error('Error during authentication:', error)
          setError('An error occurred during authentication. Please try again.')
          setIsLoading(false)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
            <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              href="/auth/register"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              create a new account
            </Link>
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Authentication Error
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Signing you in...
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  Please wait while we complete your authentication.
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {supabase ? (
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={['google', 'github']}
              redirectTo={redirectUrl || 'http://localhost:3001/auth/callback'}
              onlyThirdPartyProviders={false}
            />
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Authentication Service Unavailable
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                The authentication service is not properly configured. Please contact your administrator to set up the required environment variables.
              </p>
              <div className="bg-gray-50 rounded-md p-4 text-left">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Required Configuration:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• NEXT_PUBLIC_SUPABASE_URL</li>
                  <li>• NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                  <li>• SUPABASE_SERVICE_ROLE_KEY</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-500"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

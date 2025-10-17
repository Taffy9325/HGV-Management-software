'use client'

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
  requireAuth?: boolean
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles = [], 
  requireAuth = true 
}: ProtectedRouteProps) {
  const { userProfile, loading, isAdmin, isDriver, isMaintenanceProvider, isSuperUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (requireAuth && !userProfile) {
      router.push('/auth/login')
      return
    }

    if (allowedRoles.length > 0 && userProfile) {
      const userRole = userProfile.role
      // Super users can access any route
      if (!isSuperUser && !allowedRoles.includes(userRole)) {
        // Redirect based on user role
        if (isAdmin) {
          router.push('/dashboard')
        } else if (isDriver) {
          router.push('/driver')
        } else if (isMaintenanceProvider) {
          router.push('/maintenance')
        } else {
          router.push('/auth/login')
        }
        return
      }
    }
  }, [userProfile, loading, allowedRoles, requireAuth, router, isAdmin, isDriver, isMaintenanceProvider, isSuperUser])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (requireAuth && !userProfile) {
    return null
  }

  if (allowedRoles.length > 0 && userProfile && !isSuperUser && !allowedRoles.includes(userProfile.role)) {
    return null
  }

  return <>{children}</>
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function DashboardPage() {
  const { userProfile, isAdmin, isDriver, isMaintenanceProvider, isSuperUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!userProfile) return

    // Redirect users to their role-specific dashboard
    if (isSuperUser || isAdmin) {
      router.push('/admin/dashboard')
    } else if (isDriver) {
      router.push('/driver')
    } else if (isMaintenanceProvider) {
      router.push('/maintenance')
    }
  }, [userProfile, isAdmin, isDriver, isMaintenanceProvider, isSuperUser, router])

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
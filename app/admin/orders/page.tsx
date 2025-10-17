'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function AdminOrdersPage() {
  const { isSuperUser, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect to regular orders page for now
    // TODO: Create full admin orders page
    router.push('/orders')
  }, [router])

  if (!isSuperUser && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin', 'super_user']}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Orders</h1>
          <p className="text-gray-600">Redirecting to orders page...</p>
        </div>
      </div>
    </ProtectedRoute>
  )
}

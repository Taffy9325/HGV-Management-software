'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'

interface DashboardStats {
  vehicleCount: number
  driverCount: number
  maintenanceProviderCount: number
  jobsToday: number
  loading: boolean
  error: string | null
}

export default function AdminDashboard() {
  const { userProfile, isAdmin, isSuperUser, tenantId } = useAuth()
  
  const [stats, setStats] = useState<DashboardStats>({
    vehicleCount: 0,
    driverCount: 0,
    maintenanceProviderCount: 0,
    jobsToday: 0,
    loading: true,
    error: null
  })

  useEffect(() => {
    if (tenantId || isSuperUser) {
      fetchDashboardStats()
    }
  }, [tenantId, isSuperUser])

  const fetchDashboardStats = async () => {
    if (!supabase || (!tenantId && !isSuperUser)) {
      return
    }

    try {
      setStats(prev => ({ ...prev, loading: true, error: null }))

      // For super users, fetch stats across all tenants
      // For regular users, fetch stats for their tenant only
      let vehicleQuery = supabase.from('vehicles').select('id')
      let driverQuery = supabase.from('drivers').select('id')
      let maintenanceQuery = supabase.from('maintenance_providers').select('id')
      let jobsQuery = supabase.from('jobs').select('id')

      if (!isSuperUser && tenantId) {
        vehicleQuery = vehicleQuery.eq('tenant_id', tenantId)
        driverQuery = driverQuery.eq('tenant_id', tenantId)
        maintenanceQuery = maintenanceQuery.eq('tenant_id', tenantId)
        jobsQuery = jobsQuery.eq('tenant_id', tenantId)
      }

      const { data: vehicles, error: vehiclesError } = await vehicleQuery
      const { data: drivers, error: driversError } = await driverQuery
      const { data: maintenanceProviders, error: maintenanceError } = await maintenanceQuery

      // Fetch jobs for today
      const today = new Date().toISOString().split('T')[0]
      const { data: jobs, error: jobsError } = await jobsQuery
        .gte('created_at', today)

      setStats({
        vehicleCount: vehicles?.length || 0,
        driverCount: drivers?.length || 0,
        maintenanceProviderCount: maintenanceProviders?.length || 0,
        jobsToday: jobs?.length || 0,
        loading: false,
        error: null
      })

    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      setStats(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard data'
      }))
    }
  }

  return (
    <ProtectedRoute allowedRoles={['admin', 'super_user']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {isSuperUser ? 'Super User Dashboard' : 'Admin Dashboard'}
            </h1>
            <p className="mt-2 text-gray-600">
              Welcome back, {userProfile?.profile?.first_name && userProfile?.profile?.last_name 
                ? `${userProfile.profile.first_name} ${userProfile.profile.last_name}`
                : userProfile?.email
              }
              {isSuperUser && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Super User
                </span>
              )}
            </p>
          </div>


          {/* Error Message */}
          {stats.error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-red-800">{stats.error}</p>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Vehicles */}
            <a href="/admin/vehicles" className="block">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {isSuperUser ? 'Total Vehicles (All Organizations)' : 'Total Vehicles'}
                    </p>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {stats.loading ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                      ) : (
                        stats.vehicleCount
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM17 12H9V9h8v3z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </a>

            {/* Drivers */}
            <a href="/admin/drivers" className="block">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {isSuperUser ? 'Total Drivers (All Organizations)' : 'Total Drivers'}
                    </p>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {stats.loading ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                      ) : (
                        stats.driverCount
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>

            {/* Maintenance Providers */}
            <a href="/admin/maintenance" className="block">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {isSuperUser ? 'Total Maintenance Providers (All Organizations)' : 'Maintenance Providers'}
                    </p>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {stats.loading ? (
                        <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                      ) : (
                        stats.maintenanceProviderCount
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>

            {/* Jobs Today */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {isSuperUser ? 'Jobs Today (All Organizations)' : 'Jobs Today'}
                  </p>
                  <div className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.loading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                    ) : (
                      stats.jobsToday
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Super User Section */}
          {isSuperUser && (
            <div className="mb-8">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-purple-900">Super User Controls</h2>
                    <p className="text-purple-700">Manage organizations and depots across the entire system</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="text-sm font-medium text-purple-600">SUPER USER</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a
                    href="/admin/organizations"
                    className="flex items-center p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Manage Organizations</h3>
                      <p className="text-sm text-gray-600">Create and manage organizations</p>
                    </div>
                  </a>
                  
                  <a
                    href="/admin/depots"
                    className="flex items-center p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Manage Depots</h3>
                      <p className="text-sm text-gray-600">Create and manage depots across organizations</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
              </div>
              <div className="p-6 space-y-3">
                <a
                  href="/admin/users"
                  className="w-full flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <span className="text-gray-900">Manage Users</span>
                </a>
                <a
                  href="/admin/vehicles"
                  className="w-full flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM17 12H9V9h8v3z"/>
                  </svg>
                  <span className="text-gray-900">Manage Vehicles</span>
                </a>
                <a
                  href="/admin/inspections"
                  className="w-full flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-gray-900">Vehicle Inspections</span>
                </a>
                <a
                  href="/admin/orders"
                  className="w-full flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-orange-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="text-gray-900">Manage Orders</span>
                </a>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">New user created</h3>
                    <p className="text-sm text-gray-600">Driver account added to system</p>
                  </div>
                  <div className="text-sm text-gray-500">2 hours ago</div>
                </div>

                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM17 12H9V9h8v3z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">Vehicle registered</h3>
                    <p className="text-sm text-gray-600">New HGV added to fleet</p>
                  </div>
                  <div className="text-sm text-gray-500">4 hours ago</div>
                </div>

                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">Inspection due</h3>
                    <p className="text-sm text-gray-600">Vehicle AB12 CDE requires annual inspection</p>
                  </div>
                  <div className="text-sm text-gray-500">1 day ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

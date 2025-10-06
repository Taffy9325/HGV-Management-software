'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'

interface DriverHours {
  id: string
  date: string
  driving_hours: number
  working_hours: number
  break_hours: number
  rest_hours: number
  compliance_status: string
}

interface DriverDocument {
  id: string
  title: string
  description: string | null
  document_type: string
  is_read: boolean
  created_at: string
}

interface VehicleCheck {
  id: string
  vehicle_id: string
  check_data: any
  defects_found: boolean
  vor_required: boolean
  completed_at: string
}

export default function DriverDashboard() {
  const { userProfile, tenantId } = useAuth()
  const [driverHours, setDriverHours] = useState<DriverHours[]>([])
  const [documents, setDocuments] = useState<DriverDocument[]>([])
  const [recentChecks, setRecentChecks] = useState<VehicleCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (userProfile?.driver?.id && tenantId) {
      fetchDriverData()
    }
  }, [userProfile, tenantId])

  const fetchDriverData = async () => {
    if (!supabase || !userProfile?.driver?.id || !tenantId) return

    try {
      setLoading(true)

      // Fetch driver hours for the last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: hoursData } = await supabase
        .from('driver_hours')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('driver_id', userProfile.driver.id)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })

      // Fetch driver documents
      const { data: documentsData } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('driver_id', userProfile.driver.id)
        .order('created_at', { ascending: false })
        .limit(10)

      // Fetch recent vehicle checks
      const { data: checksData } = await supabase
        .from('walkaround_checks')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('driver_id', userProfile.driver.id)
        .order('completed_at', { ascending: false })
        .limit(5)

      setDriverHours(hoursData || [])
      setDocuments(documentsData || [])
      setRecentChecks(checksData || [])
    } catch (error) {
      console.error('Error fetching driver data:', error)
    } finally {
      setLoading(false)
    }
  }

  const markDocumentAsRead = async (documentId: string) => {
    if (!supabase) return

    try {
      await supabase
        .from('driver_documents')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', documentId)

      // Update local state
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, is_read: true, read_at: new Date().toISOString() }
            : doc
        )
      )
    } catch (error) {
      console.error('Error marking document as read:', error)
    }
  }

  const calculateTotalHours = (hours: DriverHours[]) => {
    return hours.reduce((total, day) => ({
      driving: total.driving + day.driving_hours,
      working: total.working + day.working_hours,
      break: total.break + day.break_hours,
      rest: total.rest + day.rest_hours
    }), { driving: 0, working: 0, break: 0, rest: 0 })
  }

  const totalHours = calculateTotalHours(driverHours)
  const unreadDocuments = documents.filter(doc => !doc.is_read).length

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['driver']}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading driver dashboard...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Driver Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Welcome back, {userProfile?.profile?.first_name && userProfile?.profile?.last_name 
                ? `${userProfile.profile.first_name} ${userProfile.profile.last_name}`
                : userProfile?.email
              }
            </p>
            {userProfile?.driver && (
              <p className="text-sm text-gray-500">
                Licence: {userProfile.driver.licence_number}
                {userProfile.driver.licence_expiry && (
                  <span className="ml-4">
                    Expires: {new Date(userProfile.driver.licence_expiry).toLocaleDateString()}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', name: 'Overview', icon: '🏠' },
                { id: 'hours', name: 'My Hours', icon: '⏰' },
                { id: 'checks', name: 'Vehicle Checks', icon: '✅' },
                { id: 'documents', name: 'Documents', icon: '📄' },
                { id: 'accident', name: 'Accident Report', icon: '🚨' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                  {tab.id === 'documents' && unreadDocuments > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {unreadDocuments}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Driving Hours (7 days)</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {totalHours.driving.toFixed(1)}h
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {totalHours.driving > 56 ? '⚠️ Over limit' : '✅ Within limit'}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Unread Documents</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{unreadDocuments}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {unreadDocuments > 0 ? '📬 New messages' : '✅ All read'}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Recent Checks</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{recentChecks.length}</p>
                      <p className="text-sm text-gray-500 mt-1">Last 5 inspections</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Vehicle Checks</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {recentChecks.length > 0 ? (
                      recentChecks.map((check) => (
                        <div key={check.id} className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              check.defects_found ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                              <svg className={`w-4 h-4 ${
                                check.defects_found ? 'text-red-600' : 'text-green-600'
                              }`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <h3 className="text-sm font-medium text-gray-900">
                              {check.defects_found ? 'Defects Found' : 'Check Passed'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {new Date(check.completed_at).toLocaleDateString()}
                            </p>
                          </div>
                          {check.vor_required && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              VOR Required
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No recent checks</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {documents.slice(0, 5).map((doc) => (
                      <div key={doc.id} className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            doc.is_read ? 'bg-gray-100' : 'bg-blue-100'
                          }`}>
                            <svg className={`w-4 h-4 ${
                              doc.is_read ? 'text-gray-600' : 'text-blue-600'
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm font-medium text-gray-900">{doc.title}</h3>
                          <p className="text-sm text-gray-600">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {!doc.is_read && (
                          <button
                            onClick={() => markDocumentAsRead(doc.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    ))}
                    {documents.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No documents</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hours Tab */}
          {activeTab === 'hours' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Driver Hours (Last 7 Days)</h2>
                </div>
                <div className="p-6">
                  {driverHours.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driving</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rest</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {driverHours.map((day) => (
                            <tr key={day.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(day.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {day.driving_hours}h
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {day.working_hours}h
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {day.break_hours}h
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {day.rest_hours}h
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  day.compliance_status === 'compliant' ? 'bg-green-100 text-green-800' :
                                  day.compliance_status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {day.compliance_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No hours recorded</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Checks Tab */}
          {activeTab === 'checks' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Vehicle Checks</h2>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                      Start New Check
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {recentChecks.length > 0 ? (
                    <div className="space-y-4">
                      {recentChecks.map((check) => (
                        <div key={check.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">
                                Vehicle Check - {new Date(check.completed_at).toLocaleDateString()}
                              </h3>
                              <p className="text-sm text-gray-600">
                                Completed at {new Date(check.completed_at).toLocaleTimeString()}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {check.defects_found && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                  Defects Found
                                </span>
                              )}
                              {check.vor_required && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                  VOR Required
                                </span>
                              )}
                              {!check.defects_found && !check.vor_required && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  Passed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No checks completed yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
                </div>
                <div className="p-6">
                  {documents.length > 0 ? (
                    <div className="space-y-4">
                      {documents.map((doc) => (
                        <div key={doc.id} className={`border rounded-lg p-4 ${
                          doc.is_read ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-gray-900">{doc.title}</h3>
                              {doc.description && (
                                <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {doc.document_type} • {new Date(doc.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {!doc.is_read && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  New
                                </span>
                              )}
                              {!doc.is_read && (
                                <button
                                  onClick={() => markDocumentAsRead(doc.id)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No documents available</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Accident Report Tab */}
          {activeTab === 'accident' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Accident Report</h2>
                  <p className="text-sm text-gray-600 mt-1">Report any accidents or incidents immediately</p>
                </div>
                <div className="p-6">
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Accident Date & Time</label>
                        <input
                          type="datetime-local"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Vehicle Registration</label>
                        <input
                          type="text"
                          placeholder="e.g., AB12 CDE"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Location</label>
                      <input
                        type="text"
                        placeholder="Street address, city, postcode"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Accident Type</label>
                        <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2">
                          <option value="">Select type</option>
                          <option value="collision">Collision</option>
                          <option value="rollover">Rollover</option>
                          <option value="fire">Fire</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Severity</label>
                        <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2">
                          <option value="">Select severity</option>
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                          <option value="fatal">Fatal</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        rows={4}
                        placeholder="Describe what happened..."
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Were there any injuries?</label>
                        <div className="mt-2 space-x-4">
                          <label className="inline-flex items-center">
                            <input type="radio" name="injuries" value="yes" className="mr-2" />
                            Yes
                          </label>
                          <label className="inline-flex items-center">
                            <input type="radio" name="injuries" value="no" className="mr-2" />
                            No
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Emergency services called?</label>
                        <div className="mt-2 space-x-4">
                          <label className="inline-flex items-center">
                            <input type="radio" name="emergency" value="yes" className="mr-2" />
                            Yes
                          </label>
                          <label className="inline-flex items-center">
                            <input type="radio" name="emergency" value="no" className="mr-2" />
                            No
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Police Report Number</label>
                        <input
                          type="text"
                          placeholder="If applicable"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Insurance Claim Number</label>
                        <input
                          type="text"
                          placeholder="If applicable"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium"
                      >
                        Submit Accident Report
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

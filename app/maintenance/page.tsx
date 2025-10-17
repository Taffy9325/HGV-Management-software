'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'

interface Vehicle {
  id: string
  registration: string
  make: string | null
  model: string | null
  year: number | null
  status: string | null
}

interface Inspection {
  id: string
  vehicle_id: string
  inspection_data: any
  inspection_passed: boolean
  next_inspection_due: string
  inspection_date: string
}

interface WorkOrder {
  id: string
  vehicle_id: string
  title: string
  description: string | null
  priority: string
  status: string
  estimated_cost: number | null
  created_at: string
}

export default function MaintenanceDashboard() {
  const { userProfile, tenantId } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [depots, setDepots] = useState<Tables<'depots'>[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showCreateVehicle, setShowCreateVehicle] = useState(false)
  const [showCreateInspection, setShowCreateInspection] = useState(false)
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false)

  // Form states
  const [vehicleForm, setVehicleForm] = useState({
    registration: '',
    make: '',
    model: '',
    year: '',
    fuel_type: 'diesel',
    status: 'available',
    depot_id: ''
  })

  const [inspectionForm, setInspectionForm] = useState({
    vehicle_id: '',
    inspection_type: 'annual',
    mileage: '',
    inspection_passed: true,
    next_inspection_due: ''
  })

  const [workOrderForm, setWorkOrderForm] = useState({
    vehicle_id: '',
    title: '',
    description: '',
    priority: 'normal',
    estimated_cost: ''
  })

  useEffect(() => {
    if (tenantId) {
      fetchMaintenanceData()
    }
  }, [tenantId])

  const fetchMaintenanceData = async () => {
    if (!supabase || !tenantId) return

    try {
      setLoading(true)

      // Fetch vehicles
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('registration')

      // Fetch recent inspections
      const { data: inspectionsData } = await supabase
        .from('safety_inspections')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('inspection_date', { ascending: false })
        .limit(10)

      // Fetch work orders
      const { data: workOrdersData } = await supabase
        .from('work_orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10)

      // Fetch depots
      const { data: depotsData } = await supabase
        .from('depots')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name')

      setVehicles(vehiclesData || [])
      setInspections(inspectionsData || [])
      setWorkOrders(workOrdersData || [])
      setDepots(depotsData || [])
    } catch (error) {
      console.error('Error fetching maintenance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !tenantId) return

    try {
      const { data: vehicleData, error } = await supabase
        .from('vehicles')
        .insert({
          tenant_id: tenantId,
          registration: vehicleForm.registration,
          make: vehicleForm.make || null,
          model: vehicleForm.model || null,
          year: vehicleForm.year ? parseInt(vehicleForm.year) : null,
          fuel_type: vehicleForm.fuel_type,
          status: vehicleForm.status
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating vehicle:', error)
        alert('Error creating vehicle: ' + error.message)
        return
      }

      // Handle depot assignment if selected
      if (vehicleData && vehicleForm.depot_id) {
        const { error: depotError } = await supabase
          .from('depot_vehicles')
          .insert({
            depot_id: vehicleForm.depot_id,
            vehicle_id: vehicleData.id,
            assigned_at: new Date().toISOString(),
            assigned_by: userProfile?.id
          })

        if (depotError) {
          console.error('Error assigning vehicle to depot:', depotError)
          alert('Vehicle created but failed to assign to depot: ' + depotError.message)
        }
      }

      // Reset form and refresh data
      setVehicleForm({
        registration: '',
        make: '',
        model: '',
        year: '',
        fuel_type: 'diesel',
        status: 'available',
        depot_id: ''
      })
      setShowCreateVehicle(false)
      fetchMaintenanceData()
      alert('Vehicle created successfully!')
    } catch (error) {
      console.error('Error creating vehicle:', error)
      alert('Error creating vehicle')
    }
  }

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !tenantId) return

    try {
      const { error } = await supabase
        .from('safety_inspections')
        .insert({
          tenant_id: tenantId,
          vehicle_id: inspectionForm.vehicle_id,
          inspector_id: userProfile?.id,
          inspection_data: {
            inspection_type: inspectionForm.inspection_type,
            mileage: parseInt(inspectionForm.mileage),
            brake_test: { brake_test_passed: true },
            emissions_test: { emissions_passed: true },
            tyre_condition: { minimum_depth_met: true }
          },
          inspection_passed: inspectionForm.inspection_passed,
          next_inspection_due: inspectionForm.next_inspection_due
        })

      if (error) {
        console.error('Error creating inspection:', error)
        alert('Error creating inspection: ' + error.message)
        return
      }

      // Reset form and refresh data
      setInspectionForm({
        vehicle_id: '',
        inspection_type: 'annual',
        mileage: '',
        inspection_passed: true,
        next_inspection_due: ''
      })
      setShowCreateInspection(false)
      fetchMaintenanceData()
      alert('Inspection created successfully!')
    } catch (error) {
      console.error('Error creating inspection:', error)
      alert('Error creating inspection')
    }
  }

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !tenantId) return

    try {
      const { error } = await supabase
        .from('work_orders')
        .insert({
          tenant_id: tenantId,
          vehicle_id: workOrderForm.vehicle_id,
          title: workOrderForm.title,
          description: workOrderForm.description || null,
          priority: workOrderForm.priority,
          estimated_cost: workOrderForm.estimated_cost ? parseFloat(workOrderForm.estimated_cost) : null,
          status: 'open'
        })

      if (error) {
        console.error('Error creating work order:', error)
        alert('Error creating work order: ' + error.message)
        return
      }

      // Reset form and refresh data
      setWorkOrderForm({
        vehicle_id: '',
        title: '',
        description: '',
        priority: 'normal',
        estimated_cost: ''
      })
      setShowCreateWorkOrder(false)
      fetchMaintenanceData()
      alert('Work order created successfully!')
    } catch (error) {
      console.error('Error creating work order:', error)
      alert('Error creating work order')
    }
  }

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!supabase) return
    if (!confirm('Are you sure you want to delete this vehicle?')) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId)

      if (error) {
        console.error('Error deleting vehicle:', error)
        alert('Error deleting vehicle: ' + error.message)
        return
      }

      fetchMaintenanceData()
      alert('Vehicle deleted successfully')
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      alert('Error deleting vehicle')
    }
  }

  const handleDeleteInspection = async (inspectionId: string) => {
    if (!supabase) return
    if (!confirm('Are you sure you want to delete this inspection?')) return

    try {
      const { error } = await supabase
        .from('safety_inspections')
        .delete()
        .eq('id', inspectionId)

      if (error) {
        console.error('Error deleting inspection:', error)
        alert('Error deleting inspection: ' + error.message)
        return
      }

      fetchMaintenanceData()
      alert('Inspection deleted successfully')
    } catch (error) {
      console.error('Error deleting inspection:', error)
      alert('Error deleting inspection')
    }
  }

  const handleDeleteWorkOrder = async (workOrderId: string) => {
    if (!supabase) return
    if (!confirm('Are you sure you want to delete this work order?')) return

    try {
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', workOrderId)

      if (error) {
        console.error('Error deleting work order:', error)
        alert('Error deleting work order: ' + error.message)
        return
      }

      fetchMaintenanceData()
      alert('Work order deleted successfully')
    } catch (error) {
      console.error('Error deleting work order:', error)
      alert('Error deleting work order')
    }
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['maintenance_provider']}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading maintenance dashboard...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['maintenance_provider']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Maintenance Provider Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Welcome back, {userProfile?.profile?.first_name && userProfile?.profile?.last_name 
                ? `${userProfile.profile.first_name} ${userProfile.profile.last_name}`
                : userProfile?.email
              }
            </p>
            {userProfile?.maintenance_provider && (
              <p className="text-sm text-gray-500">
                {userProfile.maintenance_provider.company_name}
                {userProfile.maintenance_provider.certification_number && (
                  <span className="ml-4">
                    Cert: {userProfile.maintenance_provider.certification_number}
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
                { id: 'vehicles', name: 'Vehicles', icon: '🚛' },
                { id: 'inspections', name: 'Inspections', icon: '🔍' },
                { id: 'work-orders', name: 'Work Orders', icon: '🔧' }
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
                      <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{vehicles.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM17 12H9V9h8v3z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Recent Inspections</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{inspections.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Open Work Orders</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {workOrders.filter(wo => wo.status === 'open').length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Inspections</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {inspections.slice(0, 5).map((inspection) => (
                      <div key={inspection.id} className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            inspection.inspection_passed ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            <svg className={`w-4 h-4 ${
                              inspection.inspection_passed ? 'text-green-600' : 'text-red-600'
                            }`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {inspection.inspection_passed ? 'Inspection Passed' : 'Inspection Failed'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {new Date(inspection.inspection_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {inspections.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No inspections yet</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Work Orders</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {workOrders.slice(0, 5).map((workOrder) => (
                      <div key={workOrder.id} className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            workOrder.status === 'open' ? 'bg-yellow-100' :
                            workOrder.status === 'in_progress' ? 'bg-blue-100' :
                            'bg-green-100'
                          }`}>
                            <svg className={`w-4 h-4 ${
                              workOrder.status === 'open' ? 'text-yellow-600' :
                              workOrder.status === 'in_progress' ? 'text-blue-600' :
                              'text-green-600'
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm font-medium text-gray-900">{workOrder.title}</h3>
                          <p className="text-sm text-gray-600">
                            {workOrder.priority} • {new Date(workOrder.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {workOrders.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No work orders yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vehicles Tab */}
          {activeTab === 'vehicles' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Vehicles</h2>
                    <button
                      onClick={() => setShowCreateVehicle(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      Add Vehicle
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {vehicles.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Make/Model</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {vehicles.map((vehicle) => (
                            <tr key={vehicle.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {vehicle.registration}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {vehicle.make} {vehicle.model}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {vehicle.year}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  vehicle.status === 'available' ? 'bg-green-100 text-green-800' :
                                  vehicle.status === 'in_use' ? 'bg-blue-100 text-blue-800' :
                                  vehicle.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {vehicle.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleDeleteVehicle(vehicle.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No vehicles registered</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Inspections Tab */}
          {activeTab === 'inspections' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Inspections</h2>
                    <button
                      onClick={() => setShowCreateInspection(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      Add Inspection
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {inspections.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Due</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {inspections.map((inspection) => (
                            <tr key={inspection.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {vehicles.find(v => v.id === inspection.vehicle_id)?.registration || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(inspection.inspection_date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  inspection.inspection_passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {inspection.inspection_passed ? 'Passed' : 'Failed'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(inspection.next_inspection_due).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleDeleteInspection(inspection.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No inspections recorded</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Work Orders Tab */}
          {activeTab === 'work-orders' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Work Orders</h2>
                    <button
                      onClick={() => setShowCreateWorkOrder(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      Create Work Order
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {workOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {workOrders.map((workOrder) => (
                            <tr key={workOrder.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {workOrder.title}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {vehicles.find(v => v.id === workOrder.vehicle_id)?.registration || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  workOrder.priority === 'high' ? 'bg-red-100 text-red-800' :
                                  workOrder.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {workOrder.priority}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  workOrder.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                                  workOrder.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {workOrder.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {workOrder.estimated_cost ? `£${workOrder.estimated_cost}` : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleDeleteWorkOrder(workOrder.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No work orders created</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Create Vehicle Modal */}
          {showCreateVehicle && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Vehicle</h3>
                  <form onSubmit={handleCreateVehicle} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Registration</label>
                      <input
                        type="text"
                        required
                        value={vehicleForm.registration}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, registration: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Make</label>
                        <input
                          type="text"
                          value={vehicleForm.make}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Model</label>
                        <input
                          type="text"
                          value={vehicleForm.model}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Year</label>
                      <input
                        type="number"
                        value={vehicleForm.year}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fuel Type</label>
                      <select
                        value={vehicleForm.fuel_type}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, fuel_type: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="diesel">Diesel</option>
                        <option value="petrol">Petrol</option>
                        <option value="electric">Electric</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={vehicleForm.status}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="available">Available</option>
                        <option value="in_use">In Use</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="out_of_service">Out of Service</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Depot</label>
                      <select
                        value={vehicleForm.depot_id}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, depot_id: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="">No Depot Assigned</option>
                        {depots.map((depot) => (
                          <option key={depot.id} value={depot.id}>
                            {depot.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateVehicle(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Add Vehicle
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Create Inspection Modal */}
          {showCreateInspection && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Inspection</h3>
                  <form onSubmit={handleCreateInspection} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vehicle</label>
                      <select
                        required
                        value={inspectionForm.vehicle_id}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, vehicle_id: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="">Select vehicle</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.registration} - {vehicle.make} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Inspection Type</label>
                      <select
                        value={inspectionForm.inspection_type}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, inspection_type: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="annual">Annual</option>
                        <option value="interim">Interim</option>
                        <option value="ad_hoc">Ad Hoc</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mileage</label>
                      <input
                        type="number"
                        required
                        value={inspectionForm.mileage}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, mileage: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Next Inspection Due</label>
                      <input
                        type="date"
                        required
                        value={inspectionForm.next_inspection_due}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, next_inspection_due: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Inspection Result</label>
                      <div className="mt-2 space-x-4">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            checked={inspectionForm.inspection_passed}
                            onChange={() => setInspectionForm({ ...inspectionForm, inspection_passed: true })}
                            className="mr-2"
                          />
                          Passed
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            checked={!inspectionForm.inspection_passed}
                            onChange={() => setInspectionForm({ ...inspectionForm, inspection_passed: false })}
                            className="mr-2"
                          />
                          Failed
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateInspection(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Add Inspection
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Create Work Order Modal */}
          {showCreateWorkOrder && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Create Work Order</h3>
                  <form onSubmit={handleCreateWorkOrder} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vehicle</label>
                      <select
                        required
                        value={workOrderForm.vehicle_id}
                        onChange={(e) => setWorkOrderForm({ ...workOrderForm, vehicle_id: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="">Select vehicle</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.registration} - {vehicle.make} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Title</label>
                      <input
                        type="text"
                        required
                        value={workOrderForm.title}
                        onChange={(e) => setWorkOrderForm({ ...workOrderForm, title: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        rows={3}
                        value={workOrderForm.description}
                        onChange={(e) => setWorkOrderForm({ ...workOrderForm, description: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Priority</label>
                      <select
                        value={workOrderForm.priority}
                        onChange={(e) => setWorkOrderForm({ ...workOrderForm, priority: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Estimated Cost (£)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={workOrderForm.estimated_cost}
                        onChange={(e) => setWorkOrderForm({ ...workOrderForm, estimated_cost: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateWorkOrder(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Create Work Order
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

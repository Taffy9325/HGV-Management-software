'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getOrCreateTenantId } from '@/lib/tenant'
import { User } from '@supabase/supabase-js'
import VehicleDocumentsModal from '@/components/VehicleDocumentsModal'
import VehicleDefectsModal from '@/components/VehicleDefectsModal'

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
  vehicle_type_id?: string
  dimensions: any
  adr_classifications: string[]
  fuel_type: string
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service'
  current_location?: any
  tax_due_date?: string
  mot_due_date?: string
  tacho_expiry_date?: string
  created_at: string
  updated_at: string
}

export default function VehiclesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedVehicleForDocuments, setSelectedVehicleForDocuments] = useState<Vehicle | null>(null)
  const [showDefectsModal, setShowDefectsModal] = useState(false)
  const [selectedVehicleForDefects, setSelectedVehicleForDefects] = useState<Vehicle | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/auth/login')
        return
      }

      setUser(session.user)
      await fetchVehicles()
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/auth/login')
      } else {
        setUser(session.user)
        if (session) {
          fetchVehicles()
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Use the utility function to get or create tenant ID
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        console.error('Failed to get tenant ID')
        setError('Failed to get tenant ID')
        return
      }

      console.log('Using tenant ID for vehicles:', tenantId)

      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching vehicles:', error)
        setError('Failed to load vehicles')
        return
      }

      setVehicles(data || [])
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      setError('Failed to load vehicles')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId)

      if (error) {
        console.error('Error deleting vehicle:', error)
        alert('Failed to delete vehicle')
        return
      }

      setVehicles(vehicles.filter(v => v.id !== vehicleId))
      alert('Vehicle deleted successfully')
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      alert('Failed to delete vehicle')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800'
      case 'in_use':
        return 'bg-blue-100 text-blue-800'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800'
      case 'out_of_service':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading vehicles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM17 12H9V9h8v3z"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">FleetPro UK</h1>
                  <p className="text-sm text-gray-600">Vehicle Management</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Back to Dashboard */}
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>

              {/* User Profile */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}</p>
                  <p className="text-xs text-gray-500">{user?.user_metadata?.company || 'Fleet Management'}</p>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              {/* Logout */}
              <button onClick={handleSignOut} className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vehicle Management</h1>
              <p className="text-gray-600 mt-2">Manage your fleet vehicles</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Vehicle
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Vehicles Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Fleet Vehicles ({vehicles.length})</h2>
          </div>

          {vehicles.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM17 12H9V9h8v3z"/>
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles found</h3>
              <p className="text-gray-600 mb-4">Get started by adding your first vehicle to the fleet.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add First Vehicle
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MOT Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tacho Expiry</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM17 12H9V9h8v3z"/>
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{vehicle.make} {vehicle.model}</div>
                            <div className="text-sm text-gray-500">ID: {vehicle.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{vehicle.registration}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{vehicle.year}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">{vehicle.fuel_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(vehicle.status)}`}>
                          {vehicle.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.tax_due_date ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            new Date(vehicle.tax_due_date) <= new Date() ? 'bg-red-100 text-red-800' :
                            new Date(vehicle.tax_due_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {new Date(vehicle.tax_due_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.mot_due_date ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            new Date(vehicle.mot_due_date) <= new Date() ? 'bg-red-100 text-red-800' :
                            new Date(vehicle.mot_due_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {new Date(vehicle.mot_due_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.tacho_expiry_date ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            new Date(vehicle.tacho_expiry_date) <= new Date() ? 'bg-red-100 text-red-800' :
                            new Date(vehicle.tacho_expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {new Date(vehicle.tacho_expiry_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedVehicleForDocuments(vehicle)
                              setShowDocumentsModal(true)
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Documents
                          </button>
                          <button
                            onClick={() => {
                              setSelectedVehicleForDefects(vehicle)
                              setShowDefectsModal(true)
                            }}
                            className="text-orange-600 hover:text-orange-900"
                          >
                            Defects
                          </button>
                          <button
                            onClick={() => setEditingVehicle(vehicle)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Vehicle Modal */}
      {showAddForm && (
        <AddVehicleModal
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false)
            fetchVehicles()
          }}
        />
      )}

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <EditVehicleModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSuccess={() => {
            setEditingVehicle(null)
            fetchVehicles()
          }}
        />
      )}

      {/* Vehicle Documents Modal */}
      {showDocumentsModal && selectedVehicleForDocuments && (
        <VehicleDocumentsModal
          isOpen={showDocumentsModal}
          onClose={() => {
            setShowDocumentsModal(false)
            setSelectedVehicleForDocuments(null)
          }}
          vehicle={selectedVehicleForDocuments}
        />
      )}

      {/* Vehicle Defects Modal */}
      {showDefectsModal && selectedVehicleForDefects && (
        <VehicleDefectsModal
          isOpen={showDefectsModal}
          onClose={() => {
            setShowDefectsModal(false)
            setSelectedVehicleForDefects(null)
          }}
          vehicle={selectedVehicleForDefects}
        />
      )}
    </div>
  )
}

// Add Vehicle Modal Component
function AddVehicleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    registration: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vehicle_type_id: '',
    depot_id: '',
    fuel_type: 'diesel',
    status: 'available' as const,
    dimensions: {
      max_weight: '',
      max_height: '',
      max_length: '',
      max_width: ''
    },
    adr_classifications: [] as string[],
    current_location: {
      lat: '',
      lng: ''
    },
    tax_due_date: '',
    mot_due_date: '',
    tacho_expiry_date: ''
  })
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([])
  const [depots, setDepots] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [adrInput, setAdrInput] = useState('')

  useEffect(() => {
    fetchVehicleTypes()
    fetchDepots()
  }, [])

  const fetchVehicleTypes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Use the utility function to get or create tenant ID
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        console.error('Failed to get tenant ID for vehicle types')
        return
      }

      console.log('Using tenant ID for vehicle types:', tenantId)

      const { data, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name')

      if (error) {
        console.error('Error fetching vehicle types:', error)
        return
      }

      setVehicleTypes(data || [])
    } catch (error) {
      console.error('Error fetching vehicle types:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Test Supabase connection first
      console.log('Testing Supabase connection...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        alert(`Authentication error: ${sessionError.message}`)
        return
      }
      
      if (!session?.user) {
        alert('No user session found. Please log in again.')
        return
      }

      console.log('User session:', session.user)
      
      // Get tenant_id from user metadata or create a default one
      let tenantId = session.user.user_metadata?.tenant_id
      
      if (!tenantId) {
        // If no tenant_id in metadata, we need to create or get a default tenant
        console.log('No tenant_id found in user metadata, creating default tenant...')
        
        // First, try to get an existing default tenant
        const { data: existingTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('name', 'Default Tenant')
          .single()
        
        if (existingTenant) {
          tenantId = existingTenant.id
          console.log('Using existing default tenant:', tenantId)
        } else {
          // Create a new default tenant
          const { data: newTenant, error: tenantError } = await supabase
            .from('tenants')
            .insert({
              name: 'Default Tenant',
              settings: {}
            })
            .select('id')
            .single()
          
          if (tenantError) {
            console.error('Error creating default tenant:', tenantError)
            alert(`Failed to create tenant: ${tenantError.message}`)
            return
          }
          
          tenantId = newTenant.id
          console.log('Created new default tenant:', tenantId)
        }
      }
      
      console.log('Using tenant ID:', tenantId)

      // Prepare dimensions object
      const dimensions = {
        max_weight: formData.dimensions.max_weight ? parseFloat(formData.dimensions.max_weight) : null,
        max_height: formData.dimensions.max_height ? parseFloat(formData.dimensions.max_height) : null,
        max_length: formData.dimensions.max_length ? parseFloat(formData.dimensions.max_length) : null,
        max_width: formData.dimensions.max_width ? parseFloat(formData.dimensions.max_width) : null
      }

      // Prepare current location if provided
      let currentLocation = null
      if (formData.current_location.lat && formData.current_location.lng) {
        currentLocation = `POINT(${formData.current_location.lng} ${formData.current_location.lat})`
      }

      const vehicleData = {
        tenant_id: tenantId,
        registration: formData.registration,
        make: formData.make,
        model: formData.model,
        year: formData.year,
        vehicle_type_id: formData.vehicle_type_id || null,
        fuel_type: formData.fuel_type,
        status: formData.status,
        dimensions: dimensions,
        adr_classifications: formData.adr_classifications,
        current_location: currentLocation,
        tax_due_date: formData.tax_due_date || null,
        mot_due_date: formData.mot_due_date || null,
        tacho_expiry_date: formData.tacho_expiry_date || null
      }

      console.log('Attempting to insert vehicle data:', vehicleData)

      const { data: vehicleDataResult, error } = await supabase
        .from('vehicles')
        .insert(vehicleData)
        .select()
        .single()

      if (error) {
        console.error('Error adding vehicle:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        alert(`Failed to add vehicle: ${error.message}`)
        return
      }

      // Handle depot assignment if selected
      if (vehicleDataResult && formData.depot_id) {
        const { error: depotError } = await supabase
          .from('depot_vehicles')
          .insert({
            depot_id: formData.depot_id,
            vehicle_id: vehicleDataResult.id,
            assigned_at: new Date().toISOString(),
            assigned_by: (await supabase.auth.getSession()).data.session?.user?.id
          })

        if (depotError) {
          console.error('Error assigning vehicle to depot:', depotError)
          alert('Vehicle created but failed to assign to depot: ' + depotError.message)
        }
      }

      alert('Vehicle added successfully')
      onSuccess()
    } catch (error) {
      console.error('Error adding vehicle:', error)
      alert(`Failed to add vehicle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const addAdrClassification = () => {
    if (adrInput.trim() && !formData.adr_classifications.includes(adrInput.trim())) {
      setFormData({
        ...formData,
        adr_classifications: [...formData.adr_classifications, adrInput.trim()]
      })
      setAdrInput('')
    }
  }

  const removeAdrClassification = (classification: string) => {
    setFormData({
      ...formData,
      adr_classifications: formData.adr_classifications.filter(c => c !== classification)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add New Vehicle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration *</label>
              <input
                type="text"
                required
                value={formData.registration}
                onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., AB12 CDE"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
                <input
                  type="text"
                  required
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Mercedes"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Sprinter"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                <input
                  type="number"
                  required
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select
                  value={formData.vehicle_type_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select vehicle type</option>
                  {vehicleTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type *</label>
                <select
                  value={formData.fuel_type}
                  onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="available">Available</option>
                  <option value="in_use">In Use</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="out_of_service">Out of Service</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Due Date</label>
                <input
                  type="date"
                  value={formData.tax_due_date}
                  onChange={(e) => setFormData({ ...formData, tax_due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MOT Due Date</label>
                <input
                  type="date"
                  value={formData.mot_due_date}
                  onChange={(e) => setFormData({ ...formData, mot_due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tacho Calibration Expiry Date</label>
                <input
                  type="date"
                  value={formData.tacho_expiry_date}
                  onChange={(e) => setFormData({ ...formData, tacho_expiry_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Dimensions (Optional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dimensions.max_weight}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dimensions: { ...formData.dimensions, max_weight: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 26000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Height (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dimensions.max_height}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dimensions: { ...formData.dimensions, max_height: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 4.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Length (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dimensions.max_length}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dimensions: { ...formData.dimensions, max_length: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 12.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Width (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dimensions.max_width}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dimensions: { ...formData.dimensions, max_width: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2.55"
                />
              </div>
            </div>
          </div>

          {/* ADR Classifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">ADR Classifications (Optional)</h3>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={adrInput}
                onChange={(e) => setAdrInput(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Class 3, Class 8"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAdrClassification())}
              />
              <button
                type="button"
                onClick={addAdrClassification}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </div>

            {formData.adr_classifications.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.adr_classifications.map((classification, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                  >
                    {classification}
                    <button
                      type="button"
                      onClick={() => removeAdrClassification(classification)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Current Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Current Location (Optional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.current_location.lat}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    current_location: { ...formData.current_location, lat: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 53.4808"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.current_location.lng}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    current_location: { ...formData.current_location, lng: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., -2.2426"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Fetch depots function for AddVehicleModal
const fetchDepotsForModal = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return []

    // Use the utility function to get or create tenant ID
    const tenantId = await getOrCreateTenantId()
    if (!tenantId) {
      console.error('Failed to get tenant ID for depots')
      return []
    }

    const { data, error } = await supabase
      .from('depots')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')

    if (error) {
      console.error('Error fetching depots:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching depots:', error)
    return []
  }
}

const fetchCurrentDepotForEditModal = async (vehicleId: string) => {
  try {
    const { data, error } = await supabase
      .from('depot_vehicles')
      .select('depot_id')
      .eq('vehicle_id', vehicleId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching depot assignment:', error)
      return ''
    }

    return data?.depot_id || ''
  } catch (error) {
    console.error('Error fetching depot assignment:', error)
    return ''
  }
}

// Edit Vehicle Modal Component
function EditVehicleModal({ vehicle, onClose, onSuccess }: { vehicle: Vehicle; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    registration: vehicle.registration,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    vehicle_type_id: vehicle.vehicle_type_id || '',
    depot_id: '',
    fuel_type: vehicle.fuel_type,
    status: vehicle.status,
    dimensions: {
      max_weight: vehicle.dimensions?.max_weight?.toString() || '',
      max_height: vehicle.dimensions?.max_height?.toString() || '',
      max_length: vehicle.dimensions?.max_length?.toString() || '',
      max_width: vehicle.dimensions?.max_width?.toString() || ''
    },
    adr_classifications: vehicle.adr_classifications || [],
    current_location: {
      lat: vehicle.current_location?.coordinates?.[1]?.toString() || '',
      lng: vehicle.current_location?.coordinates?.[0]?.toString() || ''
    },
    tax_due_date: vehicle.tax_due_date || '',
    mot_due_date: vehicle.mot_due_date || '',
    tacho_expiry_date: vehicle.tacho_expiry_date || ''
  })
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([])
  const [depots, setDepots] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [adrInput, setAdrInput] = useState('')

  useEffect(() => {
    fetchVehicleTypes()
    fetchDepotsForModal().then(setDepots)
    fetchCurrentDepotForEditModal(vehicle.id).then(depotId => {
      if (depotId) {
        setFormData(prev => ({ ...prev, depot_id: depotId }))
      }
    })
  }, [])

  const fetchVehicleTypes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Use the utility function to get or create tenant ID
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        console.error('Failed to get tenant ID for vehicle types')
        return
      }

      console.log('Using tenant ID for vehicle types:', tenantId)

      const { data, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name')

      if (error) {
        console.error('Error fetching vehicle types:', error)
        return
      }

      setVehicleTypes(data || [])
    } catch (error) {
      console.error('Error fetching vehicle types:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Prepare dimensions object
      const dimensions = {
        max_weight: formData.dimensions.max_weight ? parseFloat(formData.dimensions.max_weight) : null,
        max_height: formData.dimensions.max_height ? parseFloat(formData.dimensions.max_height) : null,
        max_length: formData.dimensions.max_length ? parseFloat(formData.dimensions.max_length) : null,
        max_width: formData.dimensions.max_width ? parseFloat(formData.dimensions.max_width) : null
      }

      // Prepare current location if provided
      let currentLocation = null
      if (formData.current_location.lat && formData.current_location.lng) {
        currentLocation = `POINT(${formData.current_location.lng} ${formData.current_location.lat})`
      }

      const { error } = await supabase
        .from('vehicles')
        .update({
          registration: formData.registration,
          make: formData.make,
          model: formData.model,
          year: formData.year,
          vehicle_type_id: formData.vehicle_type_id || null,
          fuel_type: formData.fuel_type,
          status: formData.status,
          dimensions: dimensions,
          adr_classifications: formData.adr_classifications,
          current_location: currentLocation,
          tax_due_date: formData.tax_due_date || null,
          mot_due_date: formData.mot_due_date || null,
          tacho_expiry_date: formData.tacho_expiry_date || null
        })
        .eq('id', vehicle.id)

      if (error) {
        console.error('Error updating vehicle:', error)
        alert('Failed to update vehicle')
        return
      }

      // Handle depot assignment
      if (formData.depot_id) {
        // Remove existing depot assignments
        await supabase
          .from('depot_vehicles')
          .delete()
          .eq('vehicle_id', vehicle.id)

        // Add new depot assignment
        const { error: depotError } = await supabase
          .from('depot_vehicles')
          .insert({
            depot_id: formData.depot_id,
            vehicle_id: vehicle.id,
            assigned_at: new Date().toISOString(),
            assigned_by: (await supabase.auth.getSession()).data.session?.user?.id
          })

        if (depotError) {
          console.error('Error updating depot assignment:', depotError)
          alert('Vehicle updated but failed to update depot assignment: ' + depotError.message)
        }
      } else {
        // Remove depot assignment if none selected
        await supabase
          .from('depot_vehicles')
          .delete()
          .eq('vehicle_id', vehicle.id)
      }

      alert('Vehicle updated successfully')
      onSuccess()
    } catch (error) {
      console.error('Error updating vehicle:', error)
      alert('Failed to update vehicle')
    } finally {
      setLoading(false)
    }
  }

  const addAdrClassification = () => {
    if (adrInput.trim() && !formData.adr_classifications.includes(adrInput.trim())) {
      setFormData({
        ...formData,
        adr_classifications: [...formData.adr_classifications, adrInput.trim()]
      })
      setAdrInput('')
    }
  }

  const removeAdrClassification = (classification: string) => {
    setFormData({
      ...formData,
      adr_classifications: formData.adr_classifications.filter(c => c !== classification)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Edit Vehicle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration *</label>
              <input
                type="text"
                required
                value={formData.registration}
                onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
                <input
                  type="text"
                  required
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                <input
                  type="number"
                  required
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select
                  value={formData.vehicle_type_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select vehicle type</option>
                  {vehicleTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type *</label>
                <select
                  value={formData.fuel_type}
                  onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="available">Available</option>
                  <option value="in_use">In Use</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="out_of_service">Out of Service</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Due Date</label>
                <input
                  type="date"
                  value={formData.tax_due_date}
                  onChange={(e) => setFormData({ ...formData, tax_due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MOT Due Date</label>
                <input
                  type="date"
                  value={formData.mot_due_date}
                  onChange={(e) => setFormData({ ...formData, mot_due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tacho Calibration Expiry Date</label>
                <input
                  type="date"
                  value={formData.tacho_expiry_date}
                  onChange={(e) => setFormData({ ...formData, tacho_expiry_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Dimensions (Optional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dimensions.max_weight}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dimensions: { ...formData.dimensions, max_weight: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 26000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Height (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dimensions.max_height}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dimensions: { ...formData.dimensions, max_height: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 4.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Length (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dimensions.max_length}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dimensions: { ...formData.dimensions, max_length: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 12.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Width (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dimensions.max_width}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dimensions: { ...formData.dimensions, max_width: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2.55"
                />
              </div>
            </div>
          </div>

          {/* ADR Classifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">ADR Classifications (Optional)</h3>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={adrInput}
                onChange={(e) => setAdrInput(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Class 3, Class 8"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAdrClassification())}
              />
              <button
                type="button"
                onClick={addAdrClassification}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </div>

            {formData.adr_classifications.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.adr_classifications.map((classification, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                  >
                    {classification}
                    <button
                      type="button"
                      onClick={() => removeAdrClassification(classification)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Current Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Current Location (Optional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.current_location.lat}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    current_location: { ...formData.current_location, lat: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 53.4808"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.current_location.lng}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    current_location: { ...formData.current_location, lng: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., -2.2426"
                />
              </div>
            </div>
          </div>

          {/* Depot Assignment */}
          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Depot Assignment</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Depot</label>
              <select
                value={formData.depot_id}
                onChange={(e) => setFormData({ ...formData, depot_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Depot Assigned</option>
                {depots.map((depot) => (
                  <option key={depot.id} value={depot.id}>
                    {depot.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase, Tables } from '@/lib/supabase'

interface VehicleWithType extends Tables<'vehicles'> {
  vehicle_types?: Tables<'vehicle_types'> | null
}

export default function AdminVehicles() {
  const { userProfile, tenantId } = useAuth()
  const [vehicles, setVehicles] = useState<VehicleWithType[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<Tables<'vehicle_types'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleWithType | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    registration: '',
    make: '',
    model: '',
    year: '',
    vehicle_type_id: '',
    fuel_type: 'diesel',
    status: 'available' as string,
    dimensions: {
      length: '',
      width: '',
      height: '',
      weight: ''
    },
    adr_classifications: [] as string[]
  })

  useEffect(() => {
    if (tenantId) {
      fetchVehicles()
      fetchVehicleTypes()
    }
  }, [tenantId])

  const fetchVehicles = async () => {
    if (!supabase || !tenantId) return

    try {
      setLoading(true)
      
      const { data: vehiclesData, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_types (*)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching vehicles:', error)
        return
      }

      setVehicles(vehiclesData || [])
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchVehicleTypes = async () => {
    if (!supabase) return

    try {
      const { data: typesData, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching vehicle types:', error)
        return
      }

      setVehicleTypes(typesData || [])
    } catch (error) {
      console.error('Error fetching vehicle types:', error)
    }
  }

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !tenantId) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .insert({
          tenant_id: tenantId,
          registration: formData.registration,
          make: formData.make,
          model: formData.model,
          year: formData.year ? parseInt(formData.year) : null,
          vehicle_type_id: formData.vehicle_type_id || null,
          fuel_type: formData.fuel_type,
          status: formData.status as any,
          dimensions: {
            length: formData.dimensions.length ? parseFloat(formData.dimensions.length) : null,
            width: formData.dimensions.width ? parseFloat(formData.dimensions.width) : null,
            height: formData.dimensions.height ? parseFloat(formData.dimensions.height) : null,
            weight: formData.dimensions.weight ? parseFloat(formData.dimensions.weight) : null
          },
          adr_classifications: formData.adr_classifications
        })

      if (error) {
        console.error('Error creating vehicle:', error)
        alert('Error creating vehicle: ' + error.message)
        return
      }

      // Reset form and refresh vehicles
      setFormData({
        registration: '',
        make: '',
        model: '',
        year: '',
        vehicle_type_id: '',
        fuel_type: 'diesel',
        status: 'available',
        dimensions: {
          length: '',
          width: '',
          height: '',
          weight: ''
        },
        adr_classifications: []
      })
      setShowCreateForm(false)
      fetchVehicles()
      alert('Vehicle created successfully!')
    } catch (error) {
      console.error('Error creating vehicle:', error)
      alert('Error creating vehicle')
    }
  }

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !editingVehicle) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          registration: formData.registration,
          make: formData.make,
          model: formData.model,
          year: formData.year ? parseInt(formData.year) : null,
          vehicle_type_id: formData.vehicle_type_id || null,
          fuel_type: formData.fuel_type,
          status: formData.status as any,
          dimensions: {
            length: formData.dimensions.length ? parseFloat(formData.dimensions.length) : null,
            width: formData.dimensions.width ? parseFloat(formData.dimensions.width) : null,
            height: formData.dimensions.height ? parseFloat(formData.dimensions.height) : null,
            weight: formData.dimensions.weight ? parseFloat(formData.dimensions.weight) : null
          },
          adr_classifications: formData.adr_classifications
        })
        .eq('id', editingVehicle.id)

      if (error) {
        console.error('Error updating vehicle:', error)
        alert('Error updating vehicle: ' + error.message)
        return
      }

      setEditingVehicle(null)
      fetchVehicles()
      alert('Vehicle updated successfully!')
    } catch (error) {
      console.error('Error updating vehicle:', error)
      alert('Error updating vehicle')
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

      fetchVehicles()
      alert('Vehicle deleted successfully!')
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      alert('Error deleting vehicle')
    }
  }

  const startEdit = (vehicle: VehicleWithType) => {
    setEditingVehicle(vehicle)
    setFormData({
      registration: vehicle.registration,
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year?.toString() || '',
      vehicle_type_id: vehicle.vehicle_type_id || '',
      fuel_type: vehicle.fuel_type || 'diesel',
      status: vehicle.status || 'available',
      dimensions: {
        length: vehicle.dimensions?.length?.toString() || '',
        width: vehicle.dimensions?.width?.toString() || '',
        height: vehicle.dimensions?.height?.toString() || '',
        weight: vehicle.dimensions?.weight?.toString() || ''
      },
      adr_classifications: vehicle.adr_classifications || []
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading vehicles...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Vehicle Management</h1>
            <p className="mt-2 text-gray-600">Manage your fleet vehicles</p>
          </div>

          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Add New Vehicle
            </button>
          </div>

          {/* Vehicles Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dimensions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{vehicle.registration}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {vehicle.year && `Year: ${vehicle.year}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vehicle.vehicle_types?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        vehicle.status === 'available' ? 'bg-green-100 text-green-800' :
                        vehicle.status === 'in_use' ? 'bg-blue-100 text-blue-800' :
                        vehicle.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {vehicle.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vehicle.dimensions && (
                        <div>
                          {vehicle.dimensions.length && `${vehicle.dimensions.length}m`}
                          {vehicle.dimensions.width && ` × ${vehicle.dimensions.width}m`}
                          {vehicle.dimensions.height && ` × ${vehicle.dimensions.height}m`}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => startEdit(vehicle)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Create/Edit Vehicle Modal */}
          {(showCreateForm || editingVehicle) && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                  </h3>
                  
                  <form onSubmit={editingVehicle ? handleUpdateVehicle : handleCreateVehicle} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Registration *</label>
                        <input
                          type="text"
                          required
                          value={formData.registration}
                          onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Year</label>
                        <input
                          type="number"
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Make</label>
                        <input
                          type="text"
                          value={formData.make}
                          onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Model</label>
                        <input
                          type="text"
                          value={formData.model}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Vehicle Type</label>
                        <select
                          value={formData.vehicle_type_id}
                          onChange={(e) => setFormData({ ...formData, vehicle_type_id: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value="">Select Type</option>
                          {vehicleTypes.map((type) => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fuel Type</label>
                        <select
                          value={formData.fuel_type}
                          onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value="diesel">Diesel</option>
                          <option value="petrol">Petrol</option>
                          <option value="electric">Electric</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="available">Available</option>
                        <option value="in_use">In Use</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="out_of_service">Out of Service</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dimensions</label>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600">Length (m)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={formData.dimensions.length}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              dimensions: { ...formData.dimensions, length: e.target.value }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600">Width (m)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={formData.dimensions.width}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              dimensions: { ...formData.dimensions, width: e.target.value }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600">Height (m)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={formData.dimensions.height}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              dimensions: { ...formData.dimensions, height: e.target.value }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600">Weight (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={formData.dimensions.weight}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              dimensions: { ...formData.dimensions, weight: e.target.value }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false)
                          setEditingVehicle(null)
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {editingVehicle ? 'Update Vehicle' : 'Create Vehicle'}
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

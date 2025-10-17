'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase, Tables } from '@/lib/supabase'

interface VehicleWithType extends Tables<'vehicles'> {
  vehicle_types?: Tables<'vehicle_types'> | null
  depot_vehicles?: Array<{
    depot_id: string
    depots?: Tables<'depots'> | null
  }>
}

export default function AdminVehicles() {
  const { userProfile, tenantId, isSuperUser } = useAuth()
  const [vehicles, setVehicles] = useState<VehicleWithType[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<Tables<'vehicle_types'>[]>([])
  const [depots, setDepots] = useState<Tables<'depots'>[]>([])
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
    depot_id: '',
    fuel_type: 'diesel',
    status: 'available' as string,
    dimensions: {
      length: '',
      width: '',
      height: '',
      weight: ''
    },
    adr_classifications: [] as string[],
    tax_due_date: '',
    mot_due_date: '',
    tacho_expiry_date: ''
  })

  useEffect(() => {
    if (tenantId || isSuperUser) {
      fetchVehicles()
      fetchVehicleTypes()
      fetchDepots()
    }
  }, [tenantId, userProfile])

  const fetchVehicles = async () => {
    if (!supabase || (!tenantId && !isSuperUser)) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_types (*),
          depot_vehicles (
            depot_id,
            depots (*)
          )
        `)
        .order('created_at', { ascending: false })

      // If not super user, filter by tenant
      if (!isSuperUser && tenantId) {
        query = query.eq('tenant_id', tenantId)
      }

      const { data: vehiclesData, error } = await query

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

  const fetchDepots = async () => {
    if (!supabase || (!tenantId && !isSuperUser)) return

    try {
      let query = supabase
        .from('depots')
        .select('*')
        .order('name')

      // If not super user, filter by tenant
      if (!isSuperUser && tenantId) {
        query = query.eq('tenant_id', tenantId)
      }

      const { data: depotsData, error } = await query

      if (error) {
        console.error('Error fetching depots:', error)
        return
      }

      setDepots(depotsData || [])
    } catch (error) {
      console.error('Error fetching depots:', error)
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
    if (!supabase || (!tenantId && !isSuperUser)) return

    try {
      // First create the vehicle
      const { data: vehicleData, error: vehicleError } = await supabase
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
          adr_classifications: formData.adr_classifications,
          tax_due_date: formData.tax_due_date || null,
          mot_due_date: formData.mot_due_date || null,
          tacho_expiry_date: formData.tacho_expiry_date || null
        })
        .select()
        .single()

      if (vehicleError) {
        console.error('Error creating vehicle:', vehicleError)
        alert('Error creating vehicle: ' + vehicleError.message)
        return
      }

      // If depot is selected, assign vehicle to depot
      if (formData.depot_id && vehicleData) {
        const { error: depotError } = await supabase
          .from('depot_vehicles')
          .insert({
            depot_id: formData.depot_id,
            vehicle_id: vehicleData.id,
            assigned_by: userProfile?.id,
            assigned_at: new Date().toISOString()
          })

        if (depotError) {
          console.error('Error assigning vehicle to depot:', depotError)
          alert('Vehicle created but failed to assign to depot: ' + depotError.message)
        }
      }

      // Reset form and refresh vehicles
      setFormData({
        registration: '',
        make: '',
        model: '',
        year: '',
        vehicle_type_id: '',
        depot_id: '',
        fuel_type: 'diesel',
        status: 'available',
        dimensions: {
          length: '',
          width: '',
          height: '',
          weight: ''
        },
        adr_classifications: [],
        tax_due_date: '',
        mot_due_date: '',
        tacho_expiry_date: ''
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
      // Update the vehicle
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
          adr_classifications: formData.adr_classifications,
          tax_due_date: formData.tax_due_date || null,
          mot_due_date: formData.mot_due_date || null,
          tacho_expiry_date: formData.tacho_expiry_date || null
        })
        .eq('id', editingVehicle.id)

      if (error) {
        console.error('Error updating vehicle:', error)
        alert('Error updating vehicle: ' + error.message)
        return
      }

      // Handle depot assignment
      if (formData.depot_id) {
        // Remove existing depot assignments
        await supabase
          .from('depot_vehicles')
          .delete()
          .eq('vehicle_id', editingVehicle.id)

        // Add new depot assignment
        const { error: depotError } = await supabase
          .from('depot_vehicles')
          .insert({
            depot_id: formData.depot_id,
            vehicle_id: editingVehicle.id,
            assigned_by: userProfile?.id,
            assigned_at: new Date().toISOString()
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
          .eq('vehicle_id', editingVehicle.id)
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
    console.log('🔧 startEdit function called')
    console.log('🔧 Vehicle data:', vehicle)
    console.log('🔧 Setting editingVehicle to:', vehicle.id)
    setEditingVehicle(vehicle)
    console.log('🔧 editingVehicle state should now be:', vehicle.id)
    setFormData({
      registration: vehicle.registration,
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year?.toString() || '',
      vehicle_type_id: vehicle.vehicle_type_id || '',
      depot_id: vehicle.depot_vehicles && vehicle.depot_vehicles.length > 0 ? vehicle.depot_vehicles[0].depot_id : '',
      fuel_type: vehicle.fuel_type || 'diesel',
      status: vehicle.status || 'available',
      dimensions: {
        length: vehicle.dimensions?.length?.toString() || '',
        width: vehicle.dimensions?.width?.toString() || '',
        height: vehicle.dimensions?.height?.toString() || '',
        weight: vehicle.dimensions?.weight?.toString() || ''
      },
      adr_classifications: vehicle.adr_classifications || [],
      tax_due_date: vehicle.tax_due_date || '',
      mot_due_date: vehicle.mot_due_date || '',
      tacho_expiry_date: vehicle.tacho_expiry_date || ''
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
    <ProtectedRoute allowedRoles={['admin', 'super_user']}>
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
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="text-lg font-medium text-gray-900">Vehicles ({vehicles.length})</h3>
              {vehicles.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">No vehicles found. Click "Add New Vehicle" to create one.</p>
              )}
            </div>
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
                    Depot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax Due
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MOT Due
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tacho Expiry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No vehicles available
                    </td>
                  </tr>
                ) : (
                  vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gray-50">
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
                      {vehicle.depot_vehicles && vehicle.depot_vehicles.length > 0 ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {vehicle.depot_vehicles[0].depots?.name || 'Unknown Depot'}
                        </span>
                      ) : (
                        <span className="text-gray-400">No Depot</span>
                      )}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => startEdit(vehicle)}
                        className="text-blue-600 hover:text-blue-900 px-3 py-1 border border-blue-300 rounded hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="text-red-600 hover:text-red-900 px-3 py-1 border border-red-300 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  ))
                )}
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

                    <div className="grid grid-cols-2 gap-4">
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
                        <label className="block text-sm font-medium text-gray-700">Depot</label>
                        <select
                          value={formData.depot_id}
                          onChange={(e) => setFormData({ ...formData, depot_id: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value="">Select Depot</option>
                          {depots.map((depot) => (
                            <option key={depot.id} value={depot.id}>{depot.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tax Due Date</label>
                        <input
                          type="date"
                          value={formData.tax_due_date}
                          onChange={(e) => setFormData({ ...formData, tax_due_date: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">MOT Due Date</label>
                        <input
                          type="date"
                          value={formData.mot_due_date}
                          onChange={(e) => setFormData({ ...formData, mot_due_date: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tacho Calibration Expiry Date</label>
                        <input
                          type="date"
                          value={formData.tacho_expiry_date}
                          onChange={(e) => setFormData({ ...formData, tacho_expiry_date: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
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


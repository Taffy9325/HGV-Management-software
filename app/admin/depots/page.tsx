'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase, Tables } from '@/lib/supabase'

interface DepotWithTenant extends Tables<'depots'> {
  tenants?: Tables<'tenants'> | null
}

export default function DepotManagement() {
  const { userProfile, isAdmin, isSuperUser, tenantId } = useAuth()
  const [depots, setDepots] = useState<DepotWithTenant[]>([])
  const [tenants, setTenants] = useState<Tables<'tenants'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingDepot, setEditingDepot] = useState<DepotWithTenant | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    tenant_id: '',
    name: '',
    description: '',
    address: {
      street: '',
      city: '',
      postcode: '',
      country: 'UK',
      lat: '',
      lng: ''
    },
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    operating_hours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '09:00', close: '17:00' },
      sunday: { open: '10:00', close: '16:00' }
    },
    facilities: [] as string[],
    capacity: '',
    is_active: true
  })

  const facilityOptions = [
    'fuel_station',
    'maintenance_bay',
    'loading_dock',
    'storage',
    'wash_bay',
    'inspection_area',
    'office_space',
    'canteen',
    'parking',
    'security_gate'
  ]

  useEffect(() => {
    if (isAdmin || isSuperUser) {
      fetchDepots()
      if (isSuperUser) {
        fetchTenants()
      }
    }
  }, [isAdmin, isSuperUser, tenantId])

  const fetchDepots = async () => {
    if (!supabase) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('depots')
        .select(`
          *,
          tenants (*)
        `)
        .order('created_at', { ascending: false })

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
    } finally {
      setLoading(false)
    }
  }

  const fetchTenants = async () => {
    if (!supabase || !isSuperUser) return

    try {
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching tenants:', error)
        return
      }

      setTenants(tenantsData || [])
    } catch (error) {
      console.error('Error fetching tenants:', error)
    }
  }

  const handleCreateDepot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    try {
      const depotData = {
        tenant_id: isSuperUser ? formData.tenant_id : tenantId,
        name: formData.name,
        description: formData.description || null,
        address: formData.address,
        contact_person: formData.contact_person || null,
        contact_phone: formData.contact_phone || null,
        contact_email: formData.contact_email || null,
        operating_hours: formData.operating_hours,
        facilities: formData.facilities,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        is_active: formData.is_active
      }

      const { error } = await supabase
        .from('depots')
        .insert([depotData])

      if (error) {
        console.error('Error creating depot:', error)
        alert('Error creating depot: ' + error.message)
        return
      }

      setShowCreateForm(false)
      resetForm()
      fetchDepots()
    } catch (error) {
      console.error('Error creating depot:', error)
      alert('Error creating depot')
    }
  }

  const handleUpdateDepot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !editingDepot) return

    try {
      const depotData = {
        name: formData.name,
        description: formData.description || null,
        address: formData.address,
        contact_person: formData.contact_person || null,
        contact_phone: formData.contact_phone || null,
        contact_email: formData.contact_email || null,
        operating_hours: formData.operating_hours,
        facilities: formData.facilities,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        is_active: formData.is_active
      }

      const { error } = await supabase
        .from('depots')
        .update(depotData)
        .eq('id', editingDepot.id)

      if (error) {
        console.error('Error updating depot:', error)
        alert('Error updating depot: ' + error.message)
        return
      }

      setEditingDepot(null)
      resetForm()
      fetchDepots()
    } catch (error) {
      console.error('Error updating depot:', error)
      alert('Error updating depot')
    }
  }

  const handleDeleteDepot = async (depotId: string) => {
    if (!supabase) return
    if (!confirm('Are you sure you want to delete this depot?')) return

    try {
      const { error } = await supabase
        .from('depots')
        .delete()
        .eq('id', depotId)

      if (error) {
        console.error('Error deleting depot:', error)
        alert('Error deleting depot: ' + error.message)
        return
      }

      fetchDepots()
    } catch (error) {
      console.error('Error deleting depot:', error)
      alert('Error deleting depot')
    }
  }

  const resetForm = () => {
    setFormData({
      tenant_id: '',
      name: '',
      description: '',
      address: {
        street: '',
        city: '',
        postcode: '',
        country: 'UK',
        lat: '',
        lng: ''
      },
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      operating_hours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '17:00' },
        sunday: { open: '10:00', close: '16:00' }
      },
      facilities: [],
      capacity: '',
      is_active: true
    })
  }

  const startEdit = (depot: DepotWithTenant) => {
    setEditingDepot(depot)
    setFormData({
      tenant_id: depot.tenant_id,
      name: depot.name,
      description: depot.description || '',
      address: depot.address as any,
      contact_person: depot.contact_person || '',
      contact_phone: depot.contact_phone || '',
      contact_email: depot.contact_email || '',
      operating_hours: depot.operating_hours as any,
      facilities: depot.facilities || [],
      capacity: depot.capacity?.toString() || '',
      is_active: depot.is_active
    })
  }

  const cancelEdit = () => {
    setEditingDepot(null)
    setShowCreateForm(false)
    resetForm()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading depots...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin', 'super_user']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Depot Management</h1>
            <p className="mt-2 text-gray-600">Manage depots and their facilities</p>
          </div>

          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Add New Depot
            </button>
          </div>

          {/* Depots Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  {isSuperUser && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {depots.map((depot) => (
                  <tr key={depot.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{depot.name}</div>
                      {depot.description && (
                        <div className="text-sm text-gray-500">{depot.description}</div>
                      )}
                    </td>
                    {isSuperUser && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {depot.tenants?.name || 'Unknown'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(depot.address as any)?.city}, {(depot.address as any)?.postcode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {depot.current_vehicles || 0} / {depot.capacity || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        depot.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {depot.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => startEdit(depot)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDepot(depot.id)}
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

          {/* Create/Edit Form Modal */}
          {(showCreateForm || editingDepot) && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingDepot ? 'Edit Depot' : 'Create New Depot'}
                  </h3>
                  
                  <form onSubmit={editingDepot ? handleUpdateDepot : handleCreateDepot} className="space-y-4">
                    {isSuperUser && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tenant</label>
                        <select
                          value={formData.tenant_id}
                          onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="">Select Tenant</option>
                          {tenants.map((tenant) => (
                            <option key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Depot Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Street Address</label>
                        <input
                          type="text"
                          value={formData.address.street}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            address: { ...formData.address, street: e.target.value }
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">City</label>
                        <input
                          type="text"
                          value={formData.address.city}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            address: { ...formData.address, city: e.target.value }
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Postcode</label>
                        <input
                          type="text"
                          value={formData.address.postcode}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            address: { ...formData.address, postcode: e.target.value }
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Country</label>
                        <input
                          type="text"
                          value={formData.address.country}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            address: { ...formData.address, country: e.target.value }
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                        <input
                          type="text"
                          value={formData.contact_person}
                          onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                        <input
                          type="tel"
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                        <input
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Capacity</label>
                      <input
                        type="number"
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Facilities</label>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                        {facilityOptions.map((facility) => (
                          <label key={facility} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.facilities.includes(facility)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ 
                                    ...formData, 
                                    facilities: [...formData.facilities, facility]
                                  })
                                } else {
                                  setFormData({ 
                                    ...formData, 
                                    facilities: formData.facilities.filter(f => f !== facility)
                                  })
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            />
                            <span className="ml-2 text-sm text-gray-700 capitalize">
                              {facility.replace('_', ' ')}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <label className="ml-2 text-sm text-gray-700">Active</label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700"
                      >
                        {editingDepot ? 'Update Depot' : 'Create Depot'}
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


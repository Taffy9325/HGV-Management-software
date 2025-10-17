'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase, Tables } from '@/lib/supabase'

interface DriverWithUser extends Tables<'drivers'> {
  users?: Tables<'users'> | null
  depot_drivers?: Array<{
    depot_id: string
    depots?: Tables<'depots'> | null
  }>
}

export default function AdminDrivers() {
  const { userProfile, tenantId, isSuperUser } = useAuth()
  const [drivers, setDrivers] = useState<DriverWithUser[]>([])
  const [users, setUsers] = useState<Tables<'users'>[]>([])
  const [depots, setDepots] = useState<Tables<'depots'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState<DriverWithUser | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    user_id: '',
    depot_id: '',
    licence_number: '',
    licence_expiry: '',
    cpc_expiry: '',
    tacho_card_expiry: '',
    status: 'available' as string
  })

  useEffect(() => {
    if (tenantId || isSuperUser) {
      fetchDrivers()
      fetchUsers()
      fetchDepots()
    }
  }, [tenantId, isSuperUser])

  const fetchDrivers = async () => {
    if (!supabase || (!tenantId && !isSuperUser)) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('drivers')
        .select(`
          *,
          users (*),
          depot_drivers (
            depot_id,
            depots (*)
          )
        `)
        .order('created_at', { ascending: false })

      // If not super user, filter by tenant
      if (!isSuperUser && tenantId) {
        query = query.eq('tenant_id', tenantId)
      }

      const { data: driversData, error } = await query

      if (error) {
        console.error('Error fetching drivers:', error)
        return
      }

      setDrivers(driversData || [])
    } catch (error) {
      console.error('Error fetching drivers:', error)
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

  const fetchUsers = async () => {
    if (!supabase || (!tenantId && !isSuperUser)) return

    try {
      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      // If not super user, filter by tenant
      if (!isSuperUser && tenantId) {
        query = query.eq('tenant_id', tenantId)
      }

      const { data: usersData, error } = await query

      if (error) {
        console.error('Error fetching users:', error)
        return
      }

      setUsers(usersData || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || (!tenantId && !isSuperUser)) return

    try {
      // First create the driver
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .insert({
          tenant_id: tenantId,
          user_id: formData.user_id,
          licence_number: formData.licence_number,
          licence_expiry: formData.licence_expiry || null,
          cpc_expiry: formData.cpc_expiry || null,
          tacho_card_expiry: formData.tacho_card_expiry || null,
          status: formData.status as any
        })
        .select()
        .single()

      if (driverError) {
        console.error('Error creating driver:', driverError)
        alert('Error creating driver: ' + driverError.message)
        return
      }

      // If depot is selected, assign driver to depot
      if (formData.depot_id && driverData) {
        const { error: depotError } = await supabase
          .from('depot_drivers')
          .insert({
            depot_id: formData.depot_id,
            driver_id: driverData.id,
            assigned_by: userProfile?.id,
            assigned_at: new Date().toISOString()
          })

        if (depotError) {
          console.error('Error assigning driver to depot:', depotError)
          alert('Driver created but failed to assign to depot: ' + depotError.message)
        }
      }

      // Reset form and refresh drivers
      setFormData({
        user_id: '',
        depot_id: '',
        licence_number: '',
        licence_expiry: '',
        cpc_expiry: '',
        tacho_card_expiry: '',
        status: 'available'
      })
      setShowCreateForm(false)
      fetchDrivers()
      alert('Driver created successfully!')
    } catch (error) {
      console.error('Error creating driver:', error)
      alert('Error creating driver')
    }
  }

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !editingDriver) return

    try {
      // Update the driver
      const { error } = await supabase
        .from('drivers')
        .update({
          user_id: formData.user_id,
          licence_number: formData.licence_number,
          licence_expiry: formData.licence_expiry || null,
          cpc_expiry: formData.cpc_expiry || null,
          tacho_card_expiry: formData.tacho_card_expiry || null,
          status: formData.status as any
        })
        .eq('id', editingDriver.id)

      if (error) {
        console.error('Error updating driver:', error)
        alert('Error updating driver: ' + error.message)
        return
      }

      // Handle depot assignment
      if (formData.depot_id) {
        // Remove existing depot assignments
        await supabase
          .from('depot_drivers')
          .delete()
          .eq('driver_id', editingDriver.id)

        // Add new depot assignment
        const { error: depotError } = await supabase
          .from('depot_drivers')
          .insert({
            depot_id: formData.depot_id,
            driver_id: editingDriver.id,
            assigned_by: userProfile?.id,
            assigned_at: new Date().toISOString()
          })

        if (depotError) {
          console.error('Error updating depot assignment:', depotError)
          alert('Driver updated but failed to update depot assignment: ' + depotError.message)
        }
      } else {
        // Remove depot assignment if none selected
        await supabase
          .from('depot_drivers')
          .delete()
          .eq('driver_id', editingDriver.id)
      }

      setEditingDriver(null)
      fetchDrivers()
      alert('Driver updated successfully!')
    } catch (error) {
      console.error('Error updating driver:', error)
      alert('Error updating driver')
    }
  }

  const handleDeleteDriver = async (driverId: string) => {
    if (!supabase) return
    if (!confirm('Are you sure you want to delete this driver?')) return

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId)

      if (error) {
        console.error('Error deleting driver:', error)
        alert('Error deleting driver: ' + error.message)
        return
      }

      fetchDrivers()
      alert('Driver deleted successfully!')
    } catch (error) {
      console.error('Error deleting driver:', error)
      alert('Error deleting driver')
    }
  }

  const startEdit = (driver: DriverWithUser) => {
    setEditingDriver(driver)
    setFormData({
      user_id: driver.user_id || '',
      depot_id: driver.depot_drivers && driver.depot_drivers.length > 0 ? driver.depot_drivers[0].depot_id : '',
      licence_number: driver.licence_number,
      licence_expiry: driver.licence_expiry || '',
      cpc_expiry: driver.cpc_expiry || '',
      tacho_card_expiry: driver.tacho_card_expiry || '',
      status: driver.status || 'available'
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const isExpiringSoon = (dateString: string | null, daysThreshold: number = 30) => {
    if (!dateString) return false
    const expiryDate = new Date(dateString)
    const today = new Date()
    const diffTime = expiryDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= daysThreshold && diffDays >= 0
  }

  const isExpired = (dateString: string | null) => {
    if (!dateString) return false
    const expiryDate = new Date(dateString)
    const today = new Date()
    return expiryDate < today
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading drivers...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Driver Management</h1>
            <p className="mt-2 text-gray-600">Manage your drivers and their certifications</p>
          </div>

          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Add New Driver
            </button>
          </div>

          {/* Drivers Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Licence Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPC Expiry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tacho Card Expiry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Depot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {driver.users?.profile?.first_name && driver.users?.profile?.last_name 
                          ? `${driver.users.profile.first_name} ${driver.users.profile.last_name}`
                          : driver.users?.email || 'N/A'
                        }
                      </div>
                      <div className="text-sm text-gray-500">{driver.users?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{driver.licence_number}</div>
                      <div className={`text-sm ${
                        isExpired(driver.licence_expiry) ? 'text-red-600' :
                        isExpiringSoon(driver.licence_expiry) ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        Expires: {formatDate(driver.licence_expiry)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${
                        isExpired(driver.cpc_expiry) ? 'text-red-600' :
                        isExpiringSoon(driver.cpc_expiry) ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        {formatDate(driver.cpc_expiry)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${
                        isExpired(driver.tacho_card_expiry) ? 'text-red-600' :
                        isExpiringSoon(driver.tacho_card_expiry) ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        {formatDate(driver.tacho_card_expiry)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        driver.status === 'available' ? 'bg-green-100 text-green-800' :
                        driver.status === 'on_duty' ? 'bg-blue-100 text-blue-800' :
                        driver.status === 'on_break' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {driver.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {driver.depot_drivers && driver.depot_drivers.length > 0 ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {driver.depot_drivers[0].depots?.name || 'Unknown Depot'}
                        </span>
                      ) : (
                        <span className="text-gray-400">No Depot</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => startEdit(driver)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDriver(driver.id)}
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

          {/* Create/Edit Driver Modal */}
          {(showCreateForm || editingDriver) && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingDriver ? 'Edit Driver' : 'Add New Driver'}
                  </h3>
                  
                  <form onSubmit={editingDriver ? handleUpdateDriver : handleCreateDriver} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">User *</label>
                        <select
                          required
                          value={formData.user_id}
                          onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value="">Select User</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.profile?.first_name && user.profile?.last_name 
                                ? `${user.profile.first_name} ${user.profile.last_name}`
                                : user.email
                              }
                            </option>
                          ))}
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Licence Number *</label>
                      <input
                        type="text"
                        required
                        value={formData.licence_number}
                        onChange={(e) => setFormData({ ...formData, licence_number: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Licence Expiry</label>
                        <input
                          type="date"
                          value={formData.licence_expiry}
                          onChange={(e) => setFormData({ ...formData, licence_expiry: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">CPC Expiry</label>
                        <input
                          type="date"
                          value={formData.cpc_expiry}
                          onChange={(e) => setFormData({ ...formData, cpc_expiry: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tacho Card Expiry</label>
                      <input
                        type="date"
                        value={formData.tacho_card_expiry}
                        onChange={(e) => setFormData({ ...formData, tacho_card_expiry: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="available">Available</option>
                        <option value="on_duty">On Duty</option>
                        <option value="on_break">On Break</option>
                        <option value="off_duty">Off Duty</option>
                      </select>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false)
                          setEditingDriver(null)
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {editingDriver ? 'Update Driver' : 'Create Driver'}
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


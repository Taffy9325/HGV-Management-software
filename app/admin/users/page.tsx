'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase, Tables } from '@/lib/supabase'

interface UserWithProfile extends Tables<'users'> {
  driver?: Tables<'drivers'> | null
  maintenance_provider?: Tables<'maintenance_providers'> | null
}

export default function UserManagement() {
  const { userProfile, isAdmin, isSuperUser, tenantId } = useAuth()
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [organizations, setOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'driver' as string,
    organization_id: '', // For super users to select organization
    profile: {},
    // Driver specific
    licence_number: '',
    licence_expiry: '',
    cpc_expiry: '',
    tacho_card_expiry: '',
    // Maintenance provider specific
    company_name: '',
    certification_number: '',
    certification_expiry: '',
    specializations: [] as string[],
    contact_phone: '',
    contact_email: '',
    address: {}
  })

  useEffect(() => {
    if (isAdmin || isSuperUser) {
      fetchUsers()
      if (isSuperUser) {
        fetchOrganizations()
      }
    }
  }, [isAdmin, isSuperUser, tenantId])

  const fetchUsers = async () => {
    if (!supabase || (!tenantId && !isSuperUser)) return

    try {
      setLoading(true)
      
      // Fetch users first
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

      // For each user, fetch their role-specific data separately
      const usersWithRoles = await Promise.all(
        (usersData || []).map(async (user) => {
          const userWithRoles = { ...user, drivers: [], maintenance_providers: [] }
          
          // Fetch driver data if exists
          if (user.role === 'driver' && supabase) {
            const { data: driverData } = await supabase
              .from('drivers')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle()
            if (driverData) userWithRoles.drivers = [driverData]
          }
          
          // Fetch maintenance provider data if exists
          if (user.role === 'maintenance_provider' && supabase) {
            const { data: maintenanceData } = await supabase
              .from('maintenance_providers')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle()
            if (maintenanceData) userWithRoles.maintenance_providers = [maintenanceData]
          }
          
          return userWithRoles
        })
      )

      setUsers(usersWithRoles)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrganizations = async () => {
    if (!supabase) return

    try {
      const { data: orgsData, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching organizations:', error)
        return
      }

      setOrganizations(orgsData || [])
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    
    // For super users, we need to allow creation even without tenantId
    // For regular admins, tenantId is required
    if (!isSuperUser && !tenantId) return

    try {
      // Determine the tenant_id to use
      const userTenantId = isSuperUser ? formData.organization_id : tenantId
      
      if (!userTenantId) {
        alert('Please select an organization for the user')
        return
      }
      
      // Generate a temporary UUID for the user (they'll link to auth later)
      const tempUserId = crypto.randomUUID()
      
      // Create user profile in our users table first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: tempUserId,
          tenant_id: userTenantId,
          email: formData.email,
          role: formData.role,
          profile: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: '',
            department: formData.role === 'admin' ? 'Administration' : 
                       formData.role === 'driver' ? 'Driving' : 
                       formData.role === 'super_user' ? 'System Administration' : 'Maintenance'
          }
        })
        .select()
        .single()

      if (userError) {
        console.error('Error creating user profile:', userError)
        alert('Error creating user profile: ' + userError.message)
        return
      }

      // Create role-specific records
      if (formData.role === 'driver') {
        const { error: driverError } = await supabase
          .from('drivers')
          .insert({
            tenant_id: userTenantId,
            user_id: tempUserId,
            licence_number: formData.licence_number,
            licence_expiry: formData.licence_expiry || null,
            cpc_expiry: formData.cpc_expiry || null,
            tacho_card_expiry: formData.tacho_card_expiry || null
          })

        if (driverError) {
          console.error('Error creating driver record:', driverError)
        }
      } else if (formData.role === 'maintenance_provider') {
        const { error: maintenanceError } = await supabase
          .from('maintenance_providers')
          .insert({
            tenant_id: userTenantId,
            user_id: tempUserId,
            company_name: formData.company_name,
            certification_number: formData.certification_number,
            certification_expiry: formData.certification_expiry || null,
            specializations: formData.specializations,
            contact_phone: formData.contact_phone,
            contact_email: formData.contact_email,
            address: formData.address
          })

        if (maintenanceError) {
          console.error('Error creating maintenance provider record:', maintenanceError)
        }
      }

      // Reset form and refresh users
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'driver',
        organization_id: '',
        profile: {},
        licence_number: '',
        licence_expiry: '',
        cpc_expiry: '',
        tacho_card_expiry: '',
        company_name: '',
        certification_number: '',
        certification_expiry: '',
        specializations: [],
        contact_phone: '',
        contact_email: '',
        address: {}
      })
      setShowCreateForm(false)
      fetchUsers()
      
      // Generate invitation link
      const invitationToken = crypto.randomUUID()
      const invitationLink = `${window.location.origin}/auth/invited-signup?token=${invitationToken}`
      
      alert(`User created successfully! Send this invitation link to ${formData.email}:\n\n${invitationLink}`)
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Error creating user')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete user')
      }

      // Refresh users list
      fetchUsers()
      alert('User deleted successfully')
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  if (!isAdmin && !isSuperUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin', 'super_user']}>
      <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-gray-600">Manage users in your organization</p>
        </div>

        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Create New User
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.profile?.first_name && user.profile?.last_name 
                          ? `${user.profile.first_name} ${user.profile.last_name}`
                          : user.email
                        }
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'super_user' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'admin' ? 'bg-red-100 text-red-800' :
                      user.role === 'driver' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {user.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.role === 'driver' && user.driver && (
                      <div>
                        <div>Licence: {user.driver.licence_number}</div>
                        {user.driver.licence_expiry && (
                          <div>Expires: {new Date(user.driver.licence_expiry).toLocaleDateString()}</div>
                        )}
                      </div>
                    )}
                    {user.role === 'maintenance_provider' && user.maintenance_provider && (
                      <div>
                        <div>{user.maintenance_provider.company_name}</div>
                        {user.maintenance_provider.certification_number && (
                          <div>Cert: {user.maintenance_provider.certification_number}</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleDeleteUser(user.id)}
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

        {/* Create User Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
                
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  {isSuperUser && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Organization *</label>
                      <select
                        required
                        value={formData.organization_id}
                        onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="">Select Organization</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="admin">Admin</option>
                      <option value="driver">Driver</option>
                      <option value="maintenance_provider">Maintenance Provider</option>
                      {isSuperUser && <option value="super_user">Super User</option>}
                    </select>
                  </div>

                  {/* Driver specific fields */}
                  {formData.role === 'driver' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Licence Number</label>
                        <input
                          type="text"
                          required
                          value={formData.licence_number}
                          onChange={(e) => setFormData({ ...formData, licence_number: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tacho Card Expiry</label>
                        <input
                          type="date"
                          value={formData.tacho_card_expiry}
                          onChange={(e) => setFormData({ ...formData, tacho_card_expiry: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </>
                  )}

                  {/* Maintenance provider specific fields */}
                  {formData.role === 'maintenance_provider' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Company Name</label>
                        <input
                          type="text"
                          required
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Certification Number</label>
                        <input
                          type="text"
                          value={formData.certification_number}
                          onChange={(e) => setFormData({ ...formData, certification_number: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Certification Expiry</label>
                        <input
                          type="date"
                          value={formData.certification_expiry}
                          onChange={(e) => setFormData({ ...formData, certification_expiry: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                        <input
                          type="tel"
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                        <input
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Create User
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

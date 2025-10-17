'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase, Tables } from '@/lib/supabase'

interface TenantWithStats extends Tables<'tenants'> {
  user_count?: number
  depot_count?: number
  vehicle_count?: number
}

export default function OrganizationManagement() {
  const { userProfile, isSuperUser } = useAuth()
  const [organizations, setOrganizations] = useState<TenantWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingOrg, setEditingOrg] = useState<TenantWithStats | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    settings: {
      industry: '',
      size: '',
      location: '',
      contact_email: '',
      contact_phone: ''
    }
  })

  useEffect(() => {
    if (isSuperUser) {
      fetchOrganizations()
    }
  }, [isSuperUser])

  const fetchOrganizations = async () => {
    if (!supabase) return

    try {
      setLoading(true)
      
      // Fetch organizations with stats
      const { data: orgsData, error } = await supabase
        .from('tenants')
        .select(`
          *,
          users:users(count),
          depots:depots(count),
          vehicles:vehicles(count)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching organizations:', error)
        return
      }

      // Process the data to get counts
      const processedOrgs = orgsData?.map(org => ({
        ...org,
        user_count: org.users?.[0]?.count || 0,
        depot_count: org.depots?.[0]?.count || 0,
        vehicle_count: org.vehicles?.[0]?.count || 0
      })) || []

      setOrganizations(processedOrgs)
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    try {
      const orgData = {
        name: formData.name,
        settings: formData.settings
      }

      const { error } = await supabase
        .from('tenants')
        .insert([orgData])

      if (error) {
        console.error('Error creating organization:', error)
        alert('Error creating organization: ' + error.message)
        return
      }

      setShowCreateForm(false)
      resetForm()
      fetchOrganizations()
    } catch (error) {
      console.error('Error creating organization:', error)
      alert('Error creating organization')
    }
  }

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !editingOrg) return

    try {
      const orgData = {
        name: formData.name,
        settings: formData.settings
      }

      const { error } = await supabase
        .from('tenants')
        .update(orgData)
        .eq('id', editingOrg.id)

      if (error) {
        console.error('Error updating organization:', error)
        alert('Error updating organization: ' + error.message)
        return
      }

      setEditingOrg(null)
      resetForm()
      fetchOrganizations()
    } catch (error) {
      console.error('Error updating organization:', error)
      alert('Error updating organization')
    }
  }

  const handleDeleteOrganization = async (orgId: string) => {
    if (!supabase) return
    if (!confirm('Are you sure you want to delete this organization? This will delete all associated data including users, depots, and vehicles.')) return

    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', orgId)

      if (error) {
        console.error('Error deleting organization:', error)
        alert('Error deleting organization: ' + error.message)
        return
      }

      fetchOrganizations()
    } catch (error) {
      console.error('Error deleting organization:', error)
      alert('Error deleting organization')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      settings: {
        industry: '',
        size: '',
        location: '',
        contact_email: '',
        contact_phone: ''
      }
    })
  }

  const startEdit = (org: TenantWithStats) => {
    setEditingOrg(org)
    setFormData({
      name: org.name,
      settings: org.settings as any || {
        industry: '',
        size: '',
        location: '',
        contact_email: '',
        contact_phone: ''
      }
    })
  }

  const cancelEdit = () => {
    setEditingOrg(null)
    setShowCreateForm(false)
    resetForm()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading organizations...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['super_user']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
            <p className="mt-2 text-gray-600">Manage organizations across the entire system</p>
          </div>

          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Add New Organization
            </button>
          </div>

          {/* Organizations Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Depots
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicles
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
                {organizations.map((org) => (
                  <tr key={org.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{org.name}</div>
                      <div className="text-sm text-gray-500">ID: {org.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(org.settings as any)?.industry || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(org.settings as any)?.size || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {org.user_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {org.depot_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {org.vehicle_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => startEdit(org)}
                        className="text-purple-600 hover:text-purple-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteOrganization(org.id)}
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
          {(showCreateForm || editingOrg) && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingOrg ? 'Edit Organization' : 'Create New Organization'}
                  </h3>
                  
                  <form onSubmit={editingOrg ? handleUpdateOrganization : handleCreateOrganization} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Industry</label>
                        <select
                          value={formData.settings.industry}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            settings: { ...formData.settings, industry: e.target.value }
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="">Select Industry</option>
                          <option value="logistics">Logistics</option>
                          <option value="transport">Transport</option>
                          <option value="construction">Construction</option>
                          <option value="retail">Retail</option>
                          <option value="manufacturing">Manufacturing</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Size</label>
                        <select
                          value={formData.settings.size}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            settings: { ...formData.settings, size: e.target.value }
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="">Select Size</option>
                          <option value="small">Small (1-10 vehicles)</option>
                          <option value="medium">Medium (11-50 vehicles)</option>
                          <option value="large">Large (51-200 vehicles)</option>
                          <option value="enterprise">Enterprise (200+ vehicles)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Location</label>
                      <input
                        type="text"
                        value={formData.settings.location}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          settings: { ...formData.settings, location: e.target.value }
                        })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        placeholder="e.g., Manchester, UK"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                        <input
                          type="email"
                          value={formData.settings.contact_email}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            settings: { ...formData.settings, contact_email: e.target.value }
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                        <input
                          type="tel"
                          value={formData.settings.contact_phone}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            settings: { ...formData.settings, contact_phone: e.target.value }
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
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
                        className="px-4 py-2 bg-purple-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-purple-700"
                      >
                        {editingOrg ? 'Update Organization' : 'Create Organization'}
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

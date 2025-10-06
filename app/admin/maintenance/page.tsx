'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase, Tables } from '@/lib/supabase'

// Support both old and new schema formats
interface MaintenanceProviderWithUser {
  id: string
  tenant_id: string
  user_id?: string | null
  company_name?: string | null
  certification_number?: string | null
  certification_expiry?: string | null
  specializations?: string[] | null
  contact_phone?: string | null
  contact_email?: string | null
  address?: any
  // Old schema fields
  name?: string | null
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  is_active?: boolean | null
  created_at: string
  updated_at?: string | null
  users?: Tables<'users'> | null
}

export default function AdminMaintenanceProviders() {
  const { userProfile, tenantId } = useAuth()
  const [maintenanceProviders, setMaintenanceProviders] = useState<MaintenanceProviderWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<MaintenanceProviderWithUser | null>(null)

  // Form state - support both schemas
  const [formData, setFormData] = useState({
    user_id: '',
    company_name: '',
    certification_number: '',
    certification_expiry: '',
    specializations: [] as string[],
    contact_phone: '',
    contact_email: '',
    address: {
      street: '',
      city: '',
      postcode: '',
      country: 'UK'
    },
    // Old schema fields
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    is_active: true
  })

  const specializationOptions = [
    'Engine Repair',
    'Brake Systems',
    'Transmission',
    'Electrical Systems',
    'HVAC',
    'Bodywork',
    'Tire Services',
    'Hydraulic Systems',
    'ADR Compliance',
    'Annual Testing',
    'MOT Testing',
    'General Maintenance'
  ]

  useEffect(() => {
    if (tenantId) {
      fetchMaintenanceProviders()
    }
  }, [tenantId])

  const fetchMaintenanceProviders = async () => {
    if (!supabase || !tenantId) return

    try {
      setLoading(true)
      
      const { data: providersData, error } = await supabase
        .from('maintenance_providers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching maintenance providers:', error)
        return
      }

      setMaintenanceProviders(providersData || [])
      
      // Debug: Log the first provider to see which schema is being used
      if (providersData && providersData.length > 0) {
        console.log('First maintenance provider:', providersData[0])
        console.log('Schema type:', providersData[0].company_name ? 'New Schema' : 'Old Schema')
      }
    } catch (error) {
      console.error('Error fetching maintenance providers:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !tenantId) return

    try {
      // Use old schema since the database doesn't have user_id relationship
      const insertData = {
        tenant_id: tenantId,
        name: formData.company_name || formData.name,
        contact_person: formData.contact_person,
        email: formData.contact_email || formData.email,
        phone: formData.contact_phone || formData.phone,
        address: formData.address.street ? formData.address : null,
        specializations: formData.specializations,
        is_active: formData.is_active
      }

      const { error } = await supabase
        .from('maintenance_providers')
        .insert(insertData)

      if (error) {
        console.error('Error creating maintenance provider:', error)
        alert('Error creating maintenance provider: ' + error.message)
        return
      }

      // Reset form and refresh providers
      setFormData({
        user_id: '',
        company_name: '',
        certification_number: '',
        certification_expiry: '',
        specializations: [],
        contact_phone: '',
        contact_email: '',
        address: {
          street: '',
          city: '',
          postcode: '',
          country: 'UK'
        },
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        is_active: true
      })
      setShowCreateForm(false)
      fetchMaintenanceProviders()
      alert('Maintenance provider created successfully!')
    } catch (error) {
      console.error('Error creating maintenance provider:', error)
      alert('Error creating maintenance provider')
    }
  }

  const handleUpdateProvider = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !editingProvider) return

    try {
      const { error } = await supabase
        .from('maintenance_providers')
        .update({
          name: formData.company_name || formData.name,
          contact_person: formData.contact_person,
          email: formData.contact_email || formData.email,
          phone: formData.contact_phone || formData.phone,
          address: formData.address.street ? formData.address : null,
          specializations: formData.specializations,
          is_active: formData.is_active
        })
        .eq('id', editingProvider.id)

      if (error) {
        console.error('Error updating maintenance provider:', error)
        alert('Error updating maintenance provider: ' + error.message)
        return
      }

      setEditingProvider(null)
      fetchMaintenanceProviders()
      alert('Maintenance provider updated successfully!')
    } catch (error) {
      console.error('Error updating maintenance provider:', error)
      alert('Error updating maintenance provider')
    }
  }

  const handleDeleteProvider = async (providerId: string) => {
    if (!supabase) return
    if (!confirm('Are you sure you want to delete this maintenance provider?')) return

    try {
      const { error } = await supabase
        .from('maintenance_providers')
        .delete()
        .eq('id', providerId)

      if (error) {
        console.error('Error deleting maintenance provider:', error)
        alert('Error deleting maintenance provider: ' + error.message)
        return
      }

      fetchMaintenanceProviders()
      alert('Maintenance provider deleted successfully!')
    } catch (error) {
      console.error('Error deleting maintenance provider:', error)
      alert('Error deleting maintenance provider')
    }
  }

  const startEdit = (provider: MaintenanceProviderWithUser) => {
    setEditingProvider(provider)
    setFormData({
      user_id: provider.user_id || '',
      company_name: provider.company_name || '',
      certification_number: provider.certification_number || '',
      certification_expiry: provider.certification_expiry || '',
      specializations: provider.specializations || [],
      contact_phone: provider.contact_phone || '',
      contact_email: provider.contact_email || '',
      address: provider.address || {
        street: '',
        city: '',
        postcode: '',
        country: 'UK'
      },
      // Old schema fields
      name: provider.name || '',
      contact_person: provider.contact_person || '',
      email: provider.email || '',
      phone: provider.phone || '',
      is_active: provider.is_active ?? true
    })
  }

  const handleSpecializationChange = (specialization: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        specializations: [...formData.specializations, specialization]
      })
    } else {
      setFormData({
        ...formData,
        specializations: formData.specializations.filter(s => s !== specialization)
      })
    }
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
          <p className="mt-4 text-gray-600">Loading maintenance providers...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Maintenance Provider Management</h1>
            <p className="mt-2 text-gray-600">Manage maintenance providers and their certifications</p>
          </div>

          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Add New Provider
            </button>
          </div>

          {/* Maintenance Providers Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Certification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Specializations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {maintenanceProviders.map((provider) => (
                  <tr key={provider.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {provider.contact_person || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">{provider.email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{provider.company_name || provider.name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{provider.certification_number || 'N/A'}</div>
                      <div className={`text-sm ${
                        isExpired(provider.certification_expiry) ? 'text-red-600' :
                        isExpiringSoon(provider.certification_expiry) ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        Expires: {formatDate(provider.certification_expiry)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {provider.specializations && provider.specializations.length > 0 
                          ? provider.specializations.slice(0, 2).join(', ') + 
                            (provider.specializations.length > 2 ? '...' : '')
                          : 'N/A'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {(provider.contact_phone || provider.phone) && <div>{provider.contact_phone || provider.phone}</div>}
                        {(provider.contact_email || provider.email) && <div>{provider.contact_email || provider.email}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => startEdit(provider)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
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

          {/* Create/Edit Provider Modal */}
          {(showCreateForm || editingProvider) && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingProvider ? 'Edit Maintenance Provider' : 'Add New Maintenance Provider'}
                  </h3>
                  
                  <form onSubmit={editingProvider ? handleUpdateProvider : handleCreateProvider} className="space-y-4">

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Company Name / Provider Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.company_name || formData.name}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          company_name: e.target.value,
                          name: e.target.value // Keep both in sync for compatibility
                        })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter company name or provider name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                      <input
                        type="text"
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Contact person name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Specializations</label>
                      <div className="grid grid-cols-3 gap-2">
                        {specializationOptions.map((specialization) => (
                          <label key={specialization} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.specializations.includes(specialization)}
                              onChange={(e) => handleSpecializationChange(specialization, e.target.checked)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">{specialization}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                        <input
                          type="tel"
                          value={formData.contact_phone || formData.phone}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            contact_phone: e.target.value,
                            phone: e.target.value // Keep both in sync
                          })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                        <input
                          type="email"
                          value={formData.contact_email || formData.email}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            contact_email: e.target.value,
                            email: e.target.value // Keep both in sync
                          })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="Email address"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600">Street</label>
                          <input
                            type="text"
                            value={formData.address.street}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              address: { ...formData.address, street: e.target.value }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600">City</label>
                          <input
                            type="text"
                            value={formData.address.city}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              address: { ...formData.address, city: e.target.value }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600">Postcode</label>
                          <input
                            type="text"
                            value={formData.address.postcode}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              address: { ...formData.address, postcode: e.target.value }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600">Country</label>
                          <input
                            type="text"
                            value={formData.address.country}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              address: { ...formData.address, country: e.target.value }
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false)
                          setEditingProvider(null)
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {editingProvider ? 'Update Provider' : 'Create Provider'}
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

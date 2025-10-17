'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createRecurringSchedules } from '@/lib/scheduling'

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
}

interface MaintenanceProvider {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  specializations?: string[]
  is_active: boolean
}

interface OverdueInspection {
  id: string
  tenant_id: string
  vehicle_id: string
  maintenance_provider_id?: string
  inspection_type: string
  scheduled_date: string
  frequency_weeks?: number
  notes?: string
  is_active: boolean
  created_at: string
  updated_at?: string
  vehicles?: Vehicle
  maintenance_providers?: MaintenanceProvider
}

interface OverdueInspectionsModalProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  onInspectionUpdate: () => void
}

export default function OverdueInspectionsModal({ isOpen, onClose, tenantId, onInspectionUpdate }: OverdueInspectionsModalProps) {
  const [overdueInspections, setOverdueInspections] = useState<OverdueInspection[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceProviders, setMaintenanceProviders] = useState<MaintenanceProvider[]>([])
  const [editingInspection, setEditingInspection] = useState<OverdueInspection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state for editing
  const [editForm, setEditForm] = useState({
    vehicle_id: '',
    maintenance_provider_id: '',
    inspection_type: '',
    scheduled_date: '',
    frequency_weeks: 26,
    notes: '',
    is_active: true
  })

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchOverdueInspections()
      fetchVehicles()
      fetchMaintenanceProviders()
    }
  }, [isOpen, tenantId])

  const fetchOverdueInspections = async () => {
    if (!supabase || !tenantId) return

    try {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]
      
      // First, get all overdue inspection schedules
      const { data: inspectionsData, error } = await supabase
        .from('inspection_schedules')
        .select(`
          *,
          vehicles (id, registration, make, model, year),
          maintenance_providers (id, name, contact_person)
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .lt('scheduled_date', today)
        .order('scheduled_date', { ascending: true })

      if (error) {
        console.error('Error fetching overdue inspections:', error)
        setError('Failed to load overdue inspections')
        return
      }

      // Get all completed inspection IDs to filter them out
      const { data: completedData, error: completedError } = await supabase
        .from('inspection_completions')
        .select('inspection_schedule_id')
        .eq('tenant_id', tenantId)

      if (completedError) {
        console.error('Error fetching completed inspections:', completedError)
        setError('Failed to load completed inspections')
        return
      }

      const completedScheduleIds = new Set(completedData?.map(c => c.inspection_schedule_id) || [])
      
      // Filter out completed inspections
      const overdueNotCompleted = (inspectionsData || []).filter(
        inspection => !completedScheduleIds.has(inspection.id)
      )

      console.log('Overdue inspections fetched:', overdueNotCompleted)
      setOverdueInspections(overdueNotCompleted)
    } catch (error) {
      console.error('Error fetching overdue inspections:', error)
      setError('Failed to load overdue inspections')
    } finally {
      setLoading(false)
    }
  }

  const fetchVehicles = async () => {
    if (!supabase || !tenantId) return

    try {
      const { data: vehiclesData, error } = await supabase
        .from('vehicles')
        .select('id, registration, make, model, year')
        .eq('tenant_id', tenantId)
        .order('registration')

      if (error) {
        console.error('Error fetching vehicles:', error)
        return
      }

      setVehicles(vehiclesData || [])
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    }
  }

  const fetchMaintenanceProviders = async () => {
    if (!supabase || !tenantId) return

    try {
      const { data: providersData, error } = await supabase
        .from('maintenance_providers')
        .select('id, name, contact_person, email, phone, specializations, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('Error fetching maintenance providers:', error)
        return
      }

      setMaintenanceProviders(providersData || [])
    } catch (error) {
      console.error('Error fetching maintenance providers:', error)
    }
  }

  const handleEditInspection = async (inspection: OverdueInspection) => {
    try {
      setLoading(true)
      
      // Populate the edit form with the actual data
      setEditForm({
        vehicle_id: inspection.vehicle_id,
        maintenance_provider_id: inspection.maintenance_provider_id || '',
        inspection_type: inspection.inspection_type,
        scheduled_date: inspection.scheduled_date,
        frequency_weeks: inspection.frequency_weeks || 26,
        notes: inspection.notes || '',
        is_active: inspection.is_active
      })
      setEditingInspection(inspection)
    } catch (error) {
      console.error('Error preparing edit form:', error)
      alert('Error preparing edit form')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateInspection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !tenantId || !editingInspection) return

    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase
        .from('inspection_schedules')
        .update({
          vehicle_id: editForm.vehicle_id,
          maintenance_provider_id: editForm.maintenance_provider_id || null,
          inspection_type: editForm.inspection_type,
          scheduled_date: editForm.scheduled_date,
          frequency_weeks: editForm.frequency_weeks,
          notes: editForm.notes || null,
          is_active: editForm.is_active
        })
        .eq('id', editingInspection.id)

      if (error) {
        throw error
      }

      // Check if we need to create recurring schedules for this inspection
      const { data: futureSchedules, error: futureError } = await supabase
        .from('inspection_schedules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vehicle_id', editForm.vehicle_id)
        .eq('inspection_type', editForm.inspection_type)
        .eq('is_active', true)
        .gt('scheduled_date', editForm.scheduled_date)
        .order('scheduled_date', { ascending: true })

      if (!futureError && (!futureSchedules || futureSchedules.length < 3)) {
        // Create recurring schedules if there are fewer than 3 future schedules
        console.log('Creating recurring schedules for updated inspection')
        
        const recurringResult = await createRecurringSchedules({
          tenant_id: tenantId,
          vehicle_id: editForm.vehicle_id,
          maintenance_provider_id: editForm.maintenance_provider_id,
          inspection_type: editForm.inspection_type,
          start_date: editForm.scheduled_date,
          frequency_weeks: editForm.frequency_weeks,
          notes: editForm.notes,
          max_future_schedules: Math.ceil(52 / editForm.frequency_weeks)
        })

        if (recurringResult.success) {
          console.log(`Created ${recurringResult.created} additional recurring schedules`)
        } else {
          console.warn('Failed to create recurring schedules:', recurringResult.errors)
        }
      }

      setEditingInspection(null)
      await fetchOverdueInspections()
      onInspectionUpdate()
      alert('Inspection updated successfully!')
    } catch (err: any) {
      console.error('Error updating inspection:', err)
      setError(err.message || 'Failed to update inspection')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInspection = async (inspection: OverdueInspection) => {
    // Show options for deletion behavior
    const deleteOption = confirm(
      'Delete Options:\n\n' +
      'OK = Delete only this inspection\n' +
      'Cancel = Cancel deletion\n\n' +
      'Would you like to delete only this inspection?'
    )
    
    if (!deleteOption) return
    
    const deleteAllFuture = confirm(
      'Do you also want to delete ALL future recurring inspections for this vehicle and inspection type?\n\n' +
      'OK = Delete all future inspections\n' +
      'Cancel = Keep future inspections'
    )

    try {
      setLoading(true)
      
      if (deleteAllFuture) {
        // Delete all future inspections for this vehicle and inspection type
        const { error } = await supabase
          .from('inspection_schedules')
          .delete()
          .eq('vehicle_id', inspection.vehicle_id)
          .eq('inspection_type', inspection.inspection_type)
          .gte('scheduled_date', inspection.scheduled_date)
        
        if (error) {
          throw error
        }
        
        alert('Deleted this inspection and all future recurring inspections')
      } else {
        // Delete only this specific inspection
        const { error } = await supabase
          .from('inspection_schedules')
          .delete()
          .eq('id', inspection.id)
        
        if (error) {
          throw error
        }
        
        alert('Deleted this inspection only. Future inspections remain.')
      }

      await fetchOverdueInspections()
      onInspectionUpdate()
    } catch (error) {
      console.error('Error deleting inspection:', error)
      alert('Error deleting inspection')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getDaysOverdue = (scheduledDate: string) => {
    const scheduled = new Date(scheduledDate)
    const today = new Date()
    const diffTime = today.getTime() - scheduled.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const formatInspectionType = (type: string) => {
    return type
      .replace('_', ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-6xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Overdue Inspections ({overdueInspections.length})
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {loading && overdueInspections.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <p className="ml-3 text-gray-600">Loading overdue inspections...</p>
            </div>
          ) : overdueInspections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No overdue inspections</h3>
              <p className="mt-1 text-sm text-gray-500">All inspections are up to date!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {overdueInspections.map(inspection => (
                <div
                  key={inspection.id}
                  className="bg-red-50 border border-red-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-semibold text-red-900">
                          {formatInspectionType(inspection.inspection_type)} - {inspection.vehicles?.registration || 'Unknown Vehicle'}
                        </h4>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          {getDaysOverdue(inspection.scheduled_date)} days overdue
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-red-700">
                        <p><strong>Scheduled:</strong> {formatDate(inspection.scheduled_date)}</p>
                        <p><strong>Vehicle:</strong> {inspection.vehicles?.make} {inspection.vehicles?.model} ({inspection.vehicles?.year})</p>
                        {inspection.maintenance_providers && (
                          <p><strong>Provider:</strong> {inspection.maintenance_providers.name}</p>
                        )}
                        {inspection.notes && (
                          <p><strong>Notes:</strong> {inspection.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEditInspection(inspection)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteInspection(inspection)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edit Form */}
          {editingInspection && (
            <div className="border-t pt-6 mt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Edit Inspection</h4>
              <form onSubmit={handleUpdateInspection} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Vehicle</label>
                    <select
                      required
                      value={editForm.vehicle_id}
                      onChange={(e) => setEditForm({ ...editForm, vehicle_id: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select Vehicle</option>
                      {vehicles.map(vehicle => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.registration} - {vehicle.make} {vehicle.model}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Maintenance Provider</label>
                    <select
                      value={editForm.maintenance_provider_id}
                      onChange={(e) => setEditForm({ ...editForm, maintenance_provider_id: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select Provider</option>
                      {maintenanceProviders.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Inspection Type</label>
                    <select
                      value={editForm.inspection_type}
                      onChange={(e) => setEditForm({ ...editForm, inspection_type: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="safety_inspection">Safety Inspection</option>
                      <option value="tacho_calibration">Tachograph Calibration</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Scheduled Date</label>
                    <input
                      type="date"
                      required
                      value={editForm.scheduled_date}
                      onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Frequency (weeks)</label>
                    <input
                      type="number"
                      min="1"
                      max="104"
                      value={editForm.frequency_weeks}
                      onChange={(e) => setEditForm({ ...editForm, frequency_weeks: parseInt(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                      Active
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingInspection(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update Inspection'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'scheduled' | 'completed' | 'overdue'
  inspection_type: string
  vehicle_registration: string
  maintenance_provider?: string
  notes?: string
  inspection_data?: any
  inspection_passed?: boolean
}

interface DayViewModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  events: CalendarEvent[]
  tenantId: string
  onEventUpdate: () => void
  onCompleteInspection?: (event: CalendarEvent) => void
}

export default function DayViewModal({ isOpen, onClose, date, events, tenantId, onEventUpdate, onCompleteInspection }: DayViewModalProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceProviders, setMaintenanceProviders] = useState<MaintenanceProvider[]>([])
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state for editing
  const [editForm, setEditForm] = useState({
    vehicle_id: '',
    maintenance_provider_id: '',
    inspection_type: 'safety_inspection' as string,
    scheduled_date: '',
    frequency_weeks: 26,
    notes: '',
    is_active: true
  })

  // Form state for creating new inspection
  const [createForm, setCreateForm] = useState({
    vehicle_id: '',
    maintenance_provider_id: '',
    inspection_type: 'safety_inspection' as string,
    scheduled_date: date,
    frequency_weeks: 26,
    notes: '',
    is_active: true
  })

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchVehicles()
      fetchMaintenanceProviders()
      fetchDayEvents()
    }
  }, [isOpen, tenantId, date])

  const fetchDayEvents = async () => {
    if (!supabase || !tenantId || !date) {
      console.log('DayViewModal fetchDayEvents: Missing requirements', { 
        supabase: !!supabase, 
        tenantId, 
        date 
      })
      return
    }

    console.log('DayViewModal fetchDayEvents: Starting fetch for date:', date)

    try {
      // Try exact date match first
      let { data: schedulesData, error } = await supabase
        .from('inspection_schedules')
        .select(`
          *,
          vehicles (id, registration, make, model, year),
          maintenance_providers (id, name, contact_person)
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('scheduled_date', date)

      // If no results, try with date range (in case of timezone issues)
      if (!schedulesData || schedulesData.length === 0) {
        console.log('DayViewModal: No exact match, trying date range query')
        const { data: rangeData, error: rangeError } = await supabase
          .from('inspection_schedules')
          .select(`
            *,
            vehicles (id, registration, make, model, year),
            maintenance_providers (id, name, contact_person)
          `)
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .gte('scheduled_date', date)
          .lt('scheduled_date', new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

        if (!rangeError) {
          schedulesData = rangeData
          error = rangeError
        }
      }

      console.log('DayViewModal fetchDayEvents: Query result', {
        date,
        tenantId,
        schedulesData,
        error,
        count: schedulesData?.length || 0
      })

      if (error) {
        console.error('Error fetching day events:', error)
        return
      }

      const formattedEvents: CalendarEvent[] = (schedulesData || []).map(schedule => {
        // Format inspection type for display
        const inspectionTypeDisplay = schedule.inspection_type
          .replace('_', ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        
        // Get vehicle registration with fallback
        const vehicleRegistration = schedule.vehicles?.registration || 'Unknown Vehicle'
        
        // Determine event type
        const isOverdue = new Date(schedule.scheduled_date) < new Date()
        const eventType = isOverdue ? 'overdue' : 'scheduled'
        
        console.log('DayViewModal: Processing schedule:', {
          id: schedule.id,
          inspection_type: schedule.inspection_type,
          inspection_type_display: inspectionTypeDisplay,
          scheduled_date: schedule.scheduled_date,
          vehicle: schedule.vehicles,
          vehicle_registration: vehicleRegistration,
          isOverdue: isOverdue,
          eventType: eventType,
          currentDate: new Date().toISOString()
        })
        
        return {
          id: `schedule-${schedule.id}`,
          title: `${inspectionTypeDisplay} - ${vehicleRegistration}`,
          date: schedule.scheduled_date,
          type: eventType,
          inspection_type: schedule.inspection_type,
          vehicle_registration: vehicleRegistration,
          maintenance_provider: schedule.maintenance_providers?.name,
          notes: schedule.notes
        }
      })

      setDayEvents(formattedEvents)
    } catch (error) {
      console.error('Error fetching day events:', error)
    }
  }

  const fetchVehicles = async () => {
    if (!supabase || !tenantId) {
      console.log('DayViewModal: Missing supabase or tenantId', { supabase: !!supabase, tenantId })
      return
    }

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
    if (!supabase || !tenantId) {
      console.log('DayViewModal: Missing supabase or tenantId for providers', { supabase: !!supabase, tenantId })
      return
    }

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

  const handleEditEvent = async (event: CalendarEvent) => {
    if (!supabase || !tenantId) return

    try {
      setLoading(true)
      
      // Find the original schedule data from the database
      const scheduleId = event.id.replace('schedule-', '')
      
      const { data: scheduleData, error } = await supabase
        .from('inspection_schedules')
        .select(`
          *,
          vehicles (id, registration, make, model, year),
          maintenance_providers (id, name, contact_person)
        `)
        .eq('id', scheduleId)
        .single()

      if (error) {
        console.error('Error fetching schedule for edit:', error)
        alert('Error loading inspection details')
        return
      }

      console.log('DayViewModal: Editing schedule data:', scheduleData)

      // Populate the edit form with the actual data
      setEditForm({
        vehicle_id: scheduleData.vehicle_id,
        maintenance_provider_id: scheduleData.maintenance_provider_id || '',
        inspection_type: scheduleData.inspection_type,
        scheduled_date: scheduleData.scheduled_date,
        frequency_weeks: scheduleData.frequency_weeks || 26,
        notes: scheduleData.notes || '',
        is_active: scheduleData.is_active
      })
      setEditingEvent(event)
    } catch (error) {
      console.error('Error preparing edit form:', error)
      alert('Error preparing edit form')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !tenantId || !editingEvent) return

    try {
      setLoading(true)
      const scheduleId = editingEvent.id.replace('schedule-', '')

      const { error } = await supabase
        .from('inspection_schedules')
        .update({
          vehicle_id: editForm.vehicle_id,
          maintenance_provider_id: editForm.maintenance_provider_id || null,
          inspection_type: editForm.inspection_type,
          scheduled_date: editForm.scheduled_date,
          frequency_weeks: editForm.frequency_weeks,
          notes: editForm.notes,
          is_active: editForm.is_active
        })
        .eq('id', scheduleId)

      if (error) {
        console.error('Error updating inspection schedule:', error)
        alert('Error updating inspection: ' + error.message)
        return
      }

      setEditingEvent(null)
      onEventUpdate()
      alert('Inspection updated successfully!')
    } catch (error) {
      console.error('Error updating inspection:', error)
      alert('Error updating inspection')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !tenantId) return

    try {
      setLoading(true)

      // First, create the initial inspection schedule
      const { data: newSchedule, error } = await supabase
        .from('inspection_schedules')
        .insert({
          tenant_id: tenantId,
          vehicle_id: createForm.vehicle_id,
          maintenance_provider_id: createForm.maintenance_provider_id || null,
          inspection_type: createForm.inspection_type,
          scheduled_date: createForm.scheduled_date,
          frequency_weeks: createForm.frequency_weeks,
          notes: createForm.notes,
          is_active: createForm.is_active
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating inspection schedule:', error)
        alert('Error creating inspection: ' + error.message)
        return
      }

      // Automatically create recurring schedules
      console.log('Creating recurring schedules for:', {
        inspection_type: createForm.inspection_type,
        frequency_weeks: createForm.frequency_weeks,
        vehicle_id: createForm.vehicle_id
      })

      const recurringResult = await createRecurringSchedules({
        tenant_id: tenantId,
        vehicle_id: createForm.vehicle_id,
        maintenance_provider_id: createForm.maintenance_provider_id,
        inspection_type: createForm.inspection_type,
        start_date: createForm.scheduled_date,
        frequency_weeks: createForm.frequency_weeks,
        notes: createForm.notes,
        max_future_schedules: Math.ceil(52 / createForm.frequency_weeks) // 12 months worth
      })

      if (recurringResult.success) {
        console.log(`Successfully created ${recurringResult.created} recurring schedules`)
        alert(`Inspection scheduled successfully! Created ${recurringResult.created + 1} total schedules (including recurring).`)
      } else {
        console.warn('Initial schedule created but recurring schedules failed:', recurringResult.errors)
        alert('Inspection scheduled successfully, but some recurring schedules failed to create.')
      }

      setShowCreateForm(false)
      setCreateForm({
        vehicle_id: '',
        maintenance_provider_id: '',
        inspection_type: 'safety_inspection',
        scheduled_date: date,
        frequency_weeks: 26,
        notes: '',
        is_active: true
      })
      onEventUpdate()
    } catch (error) {
      console.error('Error creating inspection:', error)
      alert('Error creating inspection')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (!supabase) return
    
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
      const scheduleId = event.id.replace('schedule-', '')
      
      if (deleteAllFuture) {
        // Get vehicle and inspection type info first
        const { data: scheduleData, error: fetchError } = await supabase
          .from('inspection_schedules')
          .select('vehicle_id, inspection_type, scheduled_date')
          .eq('id', scheduleId)
          .single()
        
        if (fetchError) {
          throw fetchError
        }
        
        // Delete all future inspections for this vehicle and inspection type
        const { error } = await supabase
          .from('inspection_schedules')
          .delete()
          .eq('vehicle_id', scheduleData.vehicle_id)
          .eq('inspection_type', scheduleData.inspection_type)
          .gte('scheduled_date', scheduleData.scheduled_date)
        
        if (error) {
          throw error
        }
        
        alert('Deleted this inspection and all future recurring inspections')
      } else {
        // Delete only this specific inspection
        const { error } = await supabase
          .from('inspection_schedules')
          .delete()
          .eq('id', scheduleId)
        
        if (error) {
          throw error
        }
        
        alert('Deleted this inspection only. Future inspections remain.')
      }

      onEventUpdate()
    } catch (error) {
      console.error('Error deleting inspection:', error)
      alert('Error deleting inspection')
    }
  }

  const formatDate = (dateStr: string) => {
    // Parse the date string safely to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    
    console.log('DayViewModal formatDate debug:', {
      input: dateStr,
      parsed: { year, month, day },
      date: date,
      formatted: date.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    })
    
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Inspections for {formatDate(date)}
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

          {/* Events List */}
          <div className="space-y-3 mb-6">
            {dayEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No inspections scheduled for this day
              </div>
            ) : (
              dayEvents.map(event => (
                <div
                  key={event.id}
                  className={`p-4 rounded-lg border ${getEventTypeColor(event.type)}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{event.title}</h4>
                      <p className="text-sm opacity-75 mt-1">
                        Type: {event.inspection_type.replace('_', ' ').toUpperCase()}
                      </p>
                      {event.maintenance_provider && (
                        <p className="text-sm opacity-75">
                          Provider: {event.maintenance_provider}
                        </p>
                      )}
                      {event.notes && (
                        <p className="text-sm opacity-75 mt-1">
                          Notes: {event.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        event.type === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        event.type === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {event.type.toUpperCase()}
                      </span>
                      {(event.type === 'scheduled' || event.type === 'overdue') && (
                        <>
                          {onCompleteInspection && (
                            <button
                              onClick={() => onCompleteInspection(event)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add New Inspection Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Schedule New Inspection
            </button>
          </div>

          {/* Edit Form */}
          {editingEvent && (
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Edit Inspection</h4>
              <form onSubmit={handleUpdateEvent} className="space-y-4">
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
                    onClick={() => setEditingEvent(null)}
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

          {/* Create Form */}
          {showCreateForm && (
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Schedule New Inspection</h4>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Vehicle *</label>
                    <select
                      required
                      value={createForm.vehicle_id}
                      onChange={(e) => setCreateForm({ ...createForm, vehicle_id: e.target.value })}
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
                      value={createForm.maintenance_provider_id}
                      onChange={(e) => setCreateForm({ ...createForm, maintenance_provider_id: e.target.value })}
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
                    <label className="block text-sm font-medium text-gray-700">Inspection Type *</label>
                    <select
                      required
                      value={createForm.inspection_type}
                      onChange={(e) => setCreateForm({ ...createForm, inspection_type: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="safety_inspection">Safety Inspection</option>
                      <option value="tacho_calibration">Tachograph Calibration</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Scheduled Date *</label>
                    <input
                      type="date"
                      required
                      value={createForm.scheduled_date}
                      onChange={(e) => setCreateForm({ ...createForm, scheduled_date: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Frequency (weeks) *</label>
                    <input
                      type="number"
                      min="1"
                      max="104"
                      required
                      value={createForm.frequency_weeks}
                      onChange={(e) => setCreateForm({ ...createForm, frequency_weeks: parseInt(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="create_is_active"
                      checked={createForm.is_active}
                      onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <label htmlFor="create_is_active" className="text-sm font-medium text-gray-700">
                      Active
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Schedule Inspection'}
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

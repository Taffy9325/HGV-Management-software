'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

interface InspectionSchedule {
  id: string
  vehicle_id: string
  maintenance_provider_id?: string
  inspection_type: 'safety_inspection' | 'tacho_calibration'
  scheduled_date: string
  frequency_weeks: number
  notes?: string
  is_active: boolean
  created_at: string
  vehicle?: Vehicle
  maintenance_provider?: MaintenanceProvider
}

interface ThisWeekInspectionsModalProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  onCompleteInspection?: (schedule: InspectionSchedule) => void
}

export default function ThisWeekInspectionsModal({
  isOpen,
  onClose,
  tenantId,
  onCompleteInspection
}: ThisWeekInspectionsModalProps) {
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchThisWeekInspections()
    }
  }, [isOpen, tenantId])

  const fetchThisWeekInspections = async () => {
    try {
      setLoading(true)
      setError(null)

      const now = new Date()
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('inspection_schedules')
        .select(`
          id,
          vehicle_id,
          maintenance_provider_id,
          inspection_type,
          scheduled_date,
          frequency_weeks,
          notes,
          is_active,
          created_at,
          vehicles!inner (
            id,
            registration,
            make,
            model,
            year
          ),
          maintenance_providers (
            id,
            name,
            contact_person,
            email,
            phone
          )
        `)
        .eq('vehicles.tenant_id', tenantId)
        .eq('is_active', true)
        .gte('scheduled_date', now.toISOString().split('T')[0])
        .lte('scheduled_date', oneWeekFromNow.toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true })

      if (error) {
        throw error
      }

      const formattedSchedules = (data || []).map(schedule => ({
        ...schedule,
        vehicle: schedule.vehicles,
        maintenance_provider: schedule.maintenance_providers
      }))

      setSchedules(formattedSchedules)
    } catch (err: any) {
      console.error('Error fetching this week inspections:', err)
      setError(err.message || 'Failed to load this week inspections')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getDaysUntilDue = (scheduledDate: string) => {
    const now = new Date()
    const due = new Date(scheduledDate)
    const diffTime = due.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getStatusColor = (scheduledDate: string) => {
    const daysUntil = getDaysUntilDue(scheduledDate)
    if (daysUntil < 0) return 'bg-red-100 text-red-800'
    if (daysUntil === 0) return 'bg-orange-100 text-orange-800'
    if (daysUntil <= 3) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getStatusText = (scheduledDate: string) => {
    const daysUntil = getDaysUntilDue(scheduledDate)
    if (daysUntil < 0) return 'Overdue'
    if (daysUntil === 0) return 'Due Today'
    if (daysUntil === 1) return 'Due Tomorrow'
    if (daysUntil <= 3) return `Due in ${daysUntil} days`
    return `Due in ${daysUntil} days`
  }

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { weekday: 'long' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">This Week's Inspections</h2>
              <p className="text-sm text-gray-600 mt-1">
                Inspections scheduled for the next 7 days
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading this week's inspections...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
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
          ) : schedules.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500">No inspections scheduled this week</p>
              <p className="text-sm text-gray-400 mt-1">Schedule inspections to see them here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {schedule.vehicle?.registration} - {schedule.vehicle?.make} {schedule.vehicle?.model}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            schedule.inspection_type === 'safety_inspection' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {schedule.inspection_type === 'safety_inspection' ? 'Safety Inspection' : 'Tacho Calibration'}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(schedule.scheduled_date)}`}>
                            {getStatusText(schedule.scheduled_date)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getDayOfWeek(schedule.scheduled_date)} - {formatDate(schedule.scheduled_date)}
                          </span>
                        </div>
                        {schedule.maintenance_provider && (
                          <p className="text-xs text-gray-500 mt-1">
                            Provider: {schedule.maintenance_provider.name}
                          </p>
                        )}
                        {schedule.notes && (
                          <p className="text-xs text-gray-500 mt-1">
                            Notes: {schedule.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {getDaysUntilDue(schedule.scheduled_date) === 0 
                          ? 'Due Today'
                          : getDaysUntilDue(schedule.scheduled_date) === 1
                          ? 'Due Tomorrow'
                          : `${getDaysUntilDue(schedule.scheduled_date)} days until due`
                        }
                      </p>
                      <p className="text-xs text-gray-500">
                        Frequency: Every {schedule.frequency_weeks} weeks
                      </p>
                      {onCompleteInspection && (
                        <button
                          onClick={() => onCompleteInspection(schedule)}
                          className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
  tax_due_date?: string
  mot_due_date?: string
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

interface SafetyInspection {
  id: string
  vehicle_id: string
  inspector_id: string
  inspection_data: any
  inspection_passed: boolean
  next_inspection_due: string
  inspection_date: string
  vehicle?: Vehicle
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'scheduled' | 'completed' | 'overdue' | 'tax_due' | 'mot_due'
  inspection_type: string
  vehicle_registration: string
  maintenance_provider?: string
  notes?: string
  inspection_data?: any
  inspection_passed?: boolean
}

interface CalendarViewProps {
  tenantId: string
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: string) => void
  onCompleteInspection?: (schedule: InspectionSchedule) => void
}

export default function InspectionCalendar({ tenantId, onEventClick, onDateClick, onCompleteInspection }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    if (tenantId) {
      fetchInspectionData()
    }
  }, [tenantId, currentDate])

  const fetchInspectionData = async () => {
    if (!supabase || !tenantId) {
      console.log('Calendar: Missing supabase or tenantId', { supabase: !!supabase, tenantId })
      return
    }

    try {
      setLoading(true)
      
      // Get the start and end of the current view period
      const startDate = getViewStartDate()
      const endDate = getViewEndDate()

      // Fetch scheduled inspections
      const { data: schedules, error: schedulesError } = await supabase
        .from('inspection_schedules')
        .select(`
          *,
          vehicles (id, registration, make, model, year, tax_due_date, mot_due_date),
          maintenance_providers (id, name, contact_person)
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .gte('scheduled_date', startDate.toISOString().split('T')[0])
        .lte('scheduled_date', endDate.toISOString().split('T')[0])

      // Fetch vehicles with MOT and Tax due dates
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, registration, make, model, year, tax_due_date, mot_due_date')
        .eq('tenant_id', tenantId)
        .or('tax_due_date.not.is.null,mot_due_date.not.is.null')
        .order('registration')

      if (schedulesError) {
        console.error('Error fetching inspection data:', schedulesError)
        return
      }

      if (vehiclesError) {
        console.error('Error fetching vehicles data:', vehiclesError)
        return
      }

      // Combine and format events
      const calendarEvents: CalendarEvent[] = []

      // Add scheduled inspections
      schedules?.forEach(schedule => {
        const isOverdue = new Date(schedule.scheduled_date) < new Date()
        
        // Format inspection type for display
        const inspectionTypeDisplay = schedule.inspection_type
          .replace('_', ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        
        // Get vehicle registration with fallback
        const vehicleRegistration = schedule.vehicles?.registration || 'Unknown Vehicle'
        
        // Ensure date is in YYYY-MM-DD format
        const eventDate = schedule.scheduled_date.includes('T') 
          ? schedule.scheduled_date.split('T')[0] 
          : schedule.scheduled_date
        
        calendarEvents.push({
          id: `schedule-${schedule.id}`,
          title: `${inspectionTypeDisplay} - ${vehicleRegistration}`,
          date: eventDate,
          type: isOverdue ? 'overdue' : 'scheduled',
          inspection_type: schedule.inspection_type,
          vehicle_registration: vehicleRegistration,
          maintenance_provider: schedule.maintenance_providers?.name,
          notes: schedule.notes
        })
      })

      // Add MOT and Tax due dates
      vehicles?.forEach(vehicle => {
        const today = new Date()
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

        // Add Tax due date
        if (vehicle.tax_due_date) {
          const taxDate = new Date(vehicle.tax_due_date)
          const taxDateStr = vehicle.tax_due_date.includes('T') 
            ? vehicle.tax_due_date.split('T')[0] 
            : vehicle.tax_due_date

          // Only add if within current view range
          if (taxDate >= startDate && taxDate <= endDate) {
            const isOverdue = taxDate < today
            const isDueSoon = taxDate <= thirtyDaysFromNow && taxDate >= today

            calendarEvents.push({
              id: `tax-${vehicle.id}`,
              title: `Tax Due - ${vehicle.registration}`,
              date: taxDateStr,
              type: isOverdue ? 'overdue' : 'tax_due',
              inspection_type: 'tax',
              vehicle_registration: vehicle.registration,
              notes: isOverdue ? 'Tax overdue' : isDueSoon ? 'Tax due soon' : 'Tax due'
            })
          }
        }

        // Add MOT due date
        if (vehicle.mot_due_date) {
          const motDate = new Date(vehicle.mot_due_date)
          const motDateStr = vehicle.mot_due_date.includes('T') 
            ? vehicle.mot_due_date.split('T')[0] 
            : vehicle.mot_due_date

          // Only add if within current view range
          if (motDate >= startDate && motDate <= endDate) {
            const isOverdue = motDate < today
            const isDueSoon = motDate <= thirtyDaysFromNow && motDate >= today

            calendarEvents.push({
              id: `mot-${vehicle.id}`,
              title: `MOT Due - ${vehicle.registration}`,
              date: motDateStr,
              type: isOverdue ? 'overdue' : 'mot_due',
              inspection_type: 'mot',
              vehicle_registration: vehicle.registration,
              notes: isOverdue ? 'MOT overdue' : isDueSoon ? 'MOT due soon' : 'MOT due'
            })
          }
        }
      })

      setEvents(calendarEvents)
      
      // Debug logging
      console.log('Calendar: Fetched schedules:', schedules?.length || 0)
      console.log('Calendar: Sample schedule:', schedules?.[0])
      console.log('Calendar: Only showing scheduled inspections (no completed inspections)')
    } catch (error) {
      console.error('Error fetching inspection data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getViewStartDate = () => {
    const date = new Date(currentDate)
    switch (view) {
      case 'month':
        return new Date(date.getFullYear(), date.getMonth(), 1)
      case 'week':
        const dayOfWeek = date.getDay()
        const startOfWeek = new Date(date)
        startOfWeek.setDate(date.getDate() - dayOfWeek)
        return startOfWeek
      case 'day':
        return new Date(date)
      default:
        return date
    }
  }

  const getViewEndDate = () => {
    const date = new Date(currentDate)
    switch (view) {
      case 'month':
        return new Date(date.getFullYear(), date.getMonth() + 1, 0)
      case 'week':
        const dayOfWeek = date.getDay()
        const endOfWeek = new Date(date)
        endOfWeek.setDate(date.getDate() + (6 - dayOfWeek))
        return endOfWeek
      case 'day':
        return new Date(date)
      default:
        return date
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const getWeekDays = (date: Date) => {
    const dayOfWeek = date.getDay()
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - dayOfWeek)
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getEventsForDate = (date: Date) => {
    // Create date string in YYYY-MM-DD format for comparison
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    const matchingEvents = events.filter(event => {
      // Ensure event date is also in YYYY-MM-DD format
      const eventDateStr = event.date.includes('T') 
        ? event.date.split('T')[0] 
        : event.date
      const matches = eventDateStr === dateStr
      
      // Debug logging for date matching
      if (events.indexOf(event) < 2) {
        console.log('Date matching debug:', {
          calendarDate: dateStr,
          eventDate: event.date,
          eventDateStr: eventDateStr,
          matches: matches,
          eventTitle: event.title
        })
      }
      
      return matches
    })
    
    return matchingEvents
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'tax_due':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'mot_due':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    
    switch (view) {
      case 'month':
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'day':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1))
        break
    }
    
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleDateClick = (date: Date) => {
    // Create date string in YYYY-MM-DD format without timezone issues
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    console.log('Calendar handleDateClick debug:', {
      clickedDate: date,
      dateStr: dateStr,
      isoString: date.toISOString().split('T')[0]
    })
    
    setSelectedDate(dateStr)
    onDateClick?.(dateStr)
  }

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate)
    const monthName = currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{monthName}</h2>
        </div>
        
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {/* Header */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
          
          {/* Days */}
          {days.map((day, index) => {
            if (!day) {
              return <div key={index} className="bg-white h-24"></div>
            }
            
            const dayEvents = getEventsForDate(day)
            const isToday = day.toDateString() === new Date().toDateString()
            const isSelected = selectedDate === day.toISOString().split('T')[0]
            
            return (
              <div
                key={day.toISOString()}
                className={`bg-white h-24 p-1 cursor-pointer hover:bg-gray-50 ${
                  isToday ? 'bg-blue-50' : ''
                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className={`text-xs px-1 py-0.5 rounded border ${getEventTypeColor(event.type)}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick?.(event)
                      }}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate)
    const weekStart = weekDays[0]
    const weekEnd = weekDays[6]
    const weekRange = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Week of {weekRange}</h2>
        </div>
        
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {/* Header */}
          {weekDays.map(day => (
            <div key={day.toISOString()} className="bg-gray-50 p-2 text-center">
              <div className="text-sm font-medium text-gray-700">
                {day.toLocaleDateString('en-GB', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-semibold ${
                day.toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-gray-900'
              }`}>
                {day.getDate()}
              </div>
            </div>
          ))}
          
          {/* Events */}
          {weekDays.map(day => {
            const dayEvents = getEventsForDate(day)
            const isToday = day.toDateString() === new Date().toDateString()
            
            return (
              <div
                key={day.toISOString()}
                className={`bg-white min-h-32 p-2 cursor-pointer hover:bg-gray-50 ${
                  isToday ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleDateClick(day)}
              >
                <div className="space-y-1">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      className={`text-xs px-2 py-1 rounded border ${getEventTypeColor(event.type)}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick?.(event)
                      }}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate)
    const isToday = currentDate.toDateString() === new Date().toDateString()
    
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {formatDate(currentDate)}
            {isToday && <span className="ml-2 text-sm text-blue-600">(Today)</span>}
          </h2>
        </div>
        
        <div className="p-4">
          {dayEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No inspections scheduled for this day
            </div>
          ) : (
            <div className="space-y-3">
              {dayEvents.map(event => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border ${getEventTypeColor(event.type)} hover:shadow-md transition-shadow`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 cursor-pointer" onClick={() => onEventClick?.(event)}>
                      <h3 className="font-medium">{event.title}</h3>
                      <p className="text-sm opacity-75">
                        {event.inspection_type.replace('_', ' ').toUpperCase()}
                      </p>
                      {event.maintenance_provider && (
                        <p className="text-sm opacity-75">
                          Provider: {event.maintenance_provider}
                        </p>
                      )}
                      {event.notes && (
                        <p className="text-sm opacity-75 mt-1">
                          {event.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        event.type === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        event.type === 'completed' ? 'bg-green-100 text-green-800' :
                        event.type === 'overdue' ? 'bg-red-100 text-red-800' :
                        event.type === 'tax_due' ? 'bg-purple-100 text-purple-800' :
                        event.type === 'mot_due' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {event.type.toUpperCase()}
                      </span>
                      {(event.type === 'scheduled' || event.type === 'overdue') && event.inspection_type !== 'tax' && event.inspection_type !== 'mot' && onCompleteInspection && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Find the original schedule data
                            const scheduleId = event.id.replace('schedule-', '')
                            const schedule = events.find(e => e.id === event.id)
                            if (schedule) {
                              // Create a mock schedule object for the completion modal
                              const mockSchedule: InspectionSchedule = {
                                id: scheduleId,
                                vehicle_id: '', // Will be filled by the modal
                                inspection_type: event.inspection_type as 'safety_inspection' | 'tacho_calibration',
                                scheduled_date: event.date,
                                vehicle: {
                                  id: '',
                                  registration: event.vehicle_registration,
                                  make: '',
                                  model: '',
                                  year: 0
                                }
                              }
                              onCompleteInspection(mockSchedule)
                            }
                          }}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
    )
  }

  if (loading || !tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">
          {!tenantId ? 'Loading tenant information...' : 'Loading calendar...'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Today
          </button>
          
          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              view === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              view === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              view === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Day
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
          <span>Scheduled</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
          <span>Overdue</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
          <span>Tax Due</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"></div>
          <span>MOT Due</span>
        </div>
      </div>

      {/* Calendar View */}
      {view === 'month' && renderMonthView()}
      {view === 'week' && renderWeekView()}
      {view === 'day' && renderDayView()}
    </div>
  )
}

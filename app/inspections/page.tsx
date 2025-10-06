'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getOrCreateTenantId } from '@/lib/tenant'
import { User } from '@supabase/supabase-js'
import InspectionCalendar from '@/components/InspectionCalendar'
import DayViewModal from '@/components/DayViewModal'
import OverdueInspectionsModal from '@/components/OverdueInspectionsModal'
import { maintainRecurringSchedules, createRecurringSchedules } from '@/lib/scheduling'

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
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
  inspection_type: 'safety_inspection' | 'tax' | 'mot' | 'tacho_calibration'
  scheduled_date: string
  frequency_weeks: number
  notes?: string
  is_active: boolean
  created_at: string
  vehicle?: Vehicle
  maintenance_provider?: MaintenanceProvider
}

interface InspectionType {
  value: 'safety_inspection' | 'tax' | 'mot' | 'tacho_calibration'
  label: string
  defaultFrequency: number
  description: string
}

interface InspectionStats {
  totalInspections: number
  upcomingInspections: number
  overdueInspections: number
  passedInspections: number
  failedInspections: number
  totalScheduled: number
  upcomingScheduled: number
  overdueScheduled: number
  thisWeekScheduled: number
}

const inspectionTypes: InspectionType[] = [
  {
    value: 'safety_inspection',
    label: 'Safety Inspection',
    defaultFrequency: 26,
    description: 'Regular safety inspection as per DVSA requirements'
  },
  {
    value: 'tax',
    label: 'Vehicle Tax',
    defaultFrequency: 52,
    description: 'Annual vehicle tax renewal'
  },
  {
    value: 'mot',
    label: 'MOT Test',
    defaultFrequency: 52,
    description: 'Annual MOT test for vehicles over 3 years old'
  },
  {
    value: 'tacho_calibration',
    label: 'Tachograph Calibration',
    defaultFrequency: 8,
    description: 'Tachograph calibration and inspection'
  }
]

export default function InspectionsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [inspections, setInspections] = useState<SafetyInspection[]>([])
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceProviders, setMaintenanceProviders] = useState<MaintenanceProvider[]>([])
  const [stats, setStats] = useState<InspectionStats>({
    totalInspections: 0,
    upcomingInspections: 0,
    overdueInspections: 0,
    passedInspections: 0,
    failedInspections: 0,
    totalScheduled: 0,
    upcomingScheduled: 0,
    overdueScheduled: 0,
    thisWeekScheduled: 0
  })
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [showDayViewModal, setShowDayViewModal] = useState(false)
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null)
  const [showOverdueModal, setShowOverdueModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [selectedDaySchedules, setSelectedDaySchedules] = useState<InspectionSchedule[]>([])
  const [showDayModal, setShowDayModal] = useState(false)
  const [selectedInspection, setSelectedInspection] = useState<InspectionSchedule | null>(null)
  const [showInspectionModal, setShowInspectionModal] = useState(false)
  const [isEditingInspection, setIsEditingInspection] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/auth/login')
        return
      }

      setUser(session.user)
      await fetchData()
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/auth/login')
      } else {
        setUser(session.user)
        if (session) {
          fetchData()
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const tenantIdResult = await getOrCreateTenantId()
      if (!tenantIdResult) {
        console.error('Failed to get tenant ID')
        setError('Failed to get tenant ID')
        return
      }
      setTenantId(tenantIdResult)

      // Fetch vehicles
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, registration, make, model, year')
        .eq('tenant_id', tenantIdResult)
        .order('registration')

      if (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError)
        setVehicles([])
      } else {
        setVehicles(vehiclesData || [])
      }

      // Fetch maintenance providers
      const { data: providersData, error: providersError } = await supabase
        .from('maintenance_providers')
        .select('*')
        .eq('tenant_id', tenantIdResult)
        .eq('is_active', true)
        .order('name')

      if (providersError) {
        console.error('Error fetching maintenance providers:', providersError)
        setMaintenanceProviders([])
      } else {
        setMaintenanceProviders(providersData || [])
      }

      // Fetch inspection schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('inspection_schedules')
        .select(`
          id,
          tenant_id,
          vehicle_id,
          maintenance_provider_id,
          inspection_type,
          scheduled_date,
          frequency_weeks,
          notes,
          is_active,
          created_at,
          updated_at,
          vehicles!inner(id, registration, make, model, year),
          maintenance_providers(id, name, contact_person, phone)
        `)
        .eq('tenant_id', tenantIdResult)
        .eq('is_active', true)
        .order('scheduled_date', { ascending: true })

      if (schedulesError) {
        console.error('Error fetching inspection schedules:', schedulesError)
        setSchedules([])
      } else {
        const formattedSchedules = (schedulesData || []).map(schedule => ({
          ...schedule,
          vehicle: schedule.vehicles,
          maintenance_provider: schedule.maintenance_providers
        }))
        setSchedules(formattedSchedules)
      }

      // Fetch inspections
      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from('safety_inspections')
        .select(`
          id,
          vehicle_id,
          inspector_id,
          inspection_data,
          inspection_passed,
          next_inspection_due,
          inspection_date,
          vehicles!inner(id, registration, make, model, year)
        `)
        .eq('vehicles.tenant_id', tenantIdResult)
        .order('next_inspection_due', { ascending: true })

      if (inspectionsError) {
        console.error('Error fetching inspections:', inspectionsError)
        setInspections([])
      } else {
        const formattedInspections = (inspectionsData || []).map(inspection => ({
          ...inspection,
          vehicle: inspection.vehicles
        }))
        setInspections(formattedInspections)
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load inspection data')
    } finally {
      setLoading(false)
      // Maintain recurring schedules after initial data load
      if (tenantId) {
        setTimeout(() => maintainSchedules(), 1000) // Delay to avoid blocking UI
      }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Calendar handlers
  const handleCalendarRefresh = () => {
    fetchData()
  }

  // Maintain recurring schedules
  const maintainSchedules = async () => {
    if (!tenantId) return

    try {
      console.log('Maintaining recurring schedules...')
      const result = await maintainRecurringSchedules(tenantId)
      
      if (result.success && result.processed > 0) {
        console.log(`Maintained ${result.processed} recurring schedules`)
        // Refresh data to show new schedules
        fetchData()
      }
    } catch (error) {
      console.error('Error maintaining recurring schedules:', error)
    }
  }

  // Manual test function for S15VJM
  const testS15VJMScheduling = async () => {
    if (!tenantId) return

    try {
      console.log('Testing S15VJM scheduling...')
      console.log('Available vehicles:', vehicles.map(v => ({ id: v.id, registration: v.registration })))
      
      // Find the S15VJM vehicle (case insensitive)
      const s15vjmVehicle = vehicles.find(v => 
        v.registration.toLowerCase() === 's15vjm' || 
        v.registration.toLowerCase() === 's15 vjm' ||
        v.registration === 'S15VJM' ||
        v.registration === 'S15 VJM'
      )
      
      if (!s15vjmVehicle) {
        console.log('S15VJM vehicle not found. Available vehicles:', vehicles)
        alert(`S15VJM vehicle not found. Available vehicles: ${vehicles.map(v => v.registration).join(', ')}`)
        return
      }

      console.log('Found S15VJM vehicle:', s15vjmVehicle)

      // Create recurring schedules for S15VJM safety inspection
      const result = await createRecurringSchedules({
        tenant_id: tenantId,
        vehicle_id: s15vjmVehicle.id,
        inspection_type: 'safety_inspection',
        start_date: '2025-10-04',
        frequency_weeks: 8,
        notes: 'Automatic recurring schedule',
        max_future_schedules: Math.ceil(52 / 8) // Create schedules for 52 weeks (8-week frequency = 7 schedules)
      })

      if (result.success) {
        alert(`Successfully created ${result.created} recurring schedules for S15VJM`)
        fetchData() // Refresh to show new schedules
      } else {
        alert(`Failed to create schedules: ${result.errors.join(', ')}`)
      }
    } catch (error) {
      console.error('Error testing S15VJM scheduling:', error)
      alert('Error testing scheduling')
    }
  }

  // General test function for any vehicle with existing schedules
  const testGeneralScheduling = async () => {
    if (!tenantId) return

    try {
      console.log('Testing general scheduling...')
      
      // Find any vehicle that has existing schedules
      const vehicleWithSchedules = schedules.find(schedule => {
        const vehicle = vehicles.find(v => v.id === schedule.vehicle_id)
        return vehicle && schedule.frequency_weeks > 0
      })
      
      if (!vehicleWithSchedules) {
        alert('No vehicles with existing schedules found')
        return
      }
      
      const vehicle = vehicles.find(v => v.id === vehicleWithSchedules.vehicle_id)
      console.log('Testing scheduling for vehicle:', vehicle?.registration)
      
      // Create recurring schedules for this vehicle
      const result = await createRecurringSchedules({
        tenant_id: tenantId,
        vehicle_id: vehicleWithSchedules.vehicle_id,
        inspection_type: vehicleWithSchedules.inspection_type,
        start_date: vehicleWithSchedules.scheduled_date,
        frequency_weeks: vehicleWithSchedules.frequency_weeks,
        notes: 'Automatic recurring schedule test',
        max_future_schedules: Math.ceil(52 / vehicleWithSchedules.frequency_weeks) // Create schedules for 52 weeks
      })

      if (result.success) {
        alert(`Successfully created ${result.created} recurring schedules for ${vehicle?.registration}`)
        fetchData() // Refresh to show new schedules
      } else {
        alert(`Failed to create schedules: ${result.errors.join(', ')}`)
      }
    } catch (error) {
      console.error('Error testing general scheduling:', error)
      alert('Error testing scheduling')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Helper functions for stats calculation
  const calculateStats = () => {
    const now = new Date()
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const totalScheduled = schedules.length
    const upcomingScheduled = schedules.filter(schedule => 
      new Date(schedule.scheduled_date) > now
    ).length
    const overdueScheduled = schedules.filter(schedule => 
      new Date(schedule.scheduled_date) < now
    ).length
    const thisWeekScheduled = schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.scheduled_date)
      return scheduleDate >= now && scheduleDate <= oneWeekFromNow
    }).length

    return {
      totalScheduled,
      upcomingScheduled,
      overdueScheduled,
      thisWeekScheduled
    }
  }

  const getDaysUntilDue = (scheduledDate: string) => {
    const now = new Date()
    const due = new Date(scheduledDate)
    const diffTime = due.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getUpcomingInspections = () => {
    const now = new Date()
    return schedules.filter(schedule => 
      new Date(schedule.scheduled_date) > now
    ).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
  }

  const getOverdueInspections = () => {
    const now = new Date()
    return schedules.filter(schedule => 
      new Date(schedule.scheduled_date) < now
    ).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inspections...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vehicle Inspections</h1>
                <p className="text-gray-600 mt-1">Manage and schedule vehicle safety inspections</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Profile */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}</p>
                  <p className="text-xs text-gray-500">{user?.user_metadata?.company || 'Fleet Management'}</p>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Inspections</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalInspections}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scheduled Inspections</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{stats.totalScheduled}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Inspection Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Scheduled Inspections */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Scheduled</p>
                <p className="text-2xl font-semibold text-gray-900">{calculateStats().totalScheduled}</p>
              </div>
            </div>
          </div>

          {/* Upcoming Inspections */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-semibold text-gray-900">{calculateStats().upcomingScheduled}</p>
              </div>
            </div>
          </div>

          {/* Overdue Inspections */}
          <div 
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setShowOverdueModal(true)}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-semibold text-gray-900">{calculateStats().overdueScheduled}</p>
                <p className="text-xs text-gray-500 mt-1">Click to view details</p>
              </div>
            </div>
          </div>

          {/* This Week Inspections */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-semibold text-gray-900">{calculateStats().thisWeekScheduled}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Debug/Test Section */}
        <div className="mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">Debug: Test S15VJM Scheduling</h3>
            <p className="text-xs text-yellow-700 mb-3">
              Click this button to manually test the recurring schedule creation for S15VJM safety inspection (8-week frequency)
            </p>
            <button
              onClick={testS15VJMScheduling}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
            >
              Test S15VJM Scheduling
            </button>
            <button
              onClick={testGeneralScheduling}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm ml-2"
            >
              Test Any Vehicle
            </button>
          </div>
        </div>

        {/* View Mode Toggle and Action Buttons */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Inspection Schedule</h2>
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Calendar View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List View
              </button>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Schedule Inspection</span>
            </button>
            <button
              onClick={() => setShowProviderModal(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Manage Providers</span>
            </button>
          </div>
        </div>

        {/* Calendar View */}
        {viewMode === 'calendar' && tenantId && (
          <InspectionCalendar
            tenantId={tenantId}
            onDateClick={(date) => {
              setSelectedDayDate(date)
              setShowDayViewModal(true)
            }}
            onEventClick={(event) => {
              console.log('Event clicked:', event)
              // Handle event click if needed
            }}
          />
        )}

        {/* Day View Modal */}
        {showDayViewModal && selectedDayDate && tenantId && (
          <DayViewModal
            isOpen={showDayViewModal}
            onClose={() => {
              setShowDayViewModal(false)
              setSelectedDayDate(null)
            }}
            date={selectedDayDate}
            events={[]} // The calendar component will handle fetching events
            tenantId={tenantId}
            onEventUpdate={handleCalendarRefresh}
          />
        )}

        {/* Overdue Inspections Modal */}
        {showOverdueModal && tenantId && (
          <OverdueInspectionsModal
            isOpen={showOverdueModal}
            onClose={() => setShowOverdueModal(false)}
            tenantId={tenantId}
            onInspectionUpdate={handleCalendarRefresh}
          />
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="space-y-6">
            {/* Scheduled Inspections */}
            {schedules.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Scheduled Inspections</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {schedules.map((schedule) => (
                    <div 
                      key={schedule.id} 
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('List view inspection clicked:', schedule)
                        setSelectedInspection(schedule)
                        setShowInspectionModal(true)
                        setIsEditingInspection(false)
                      }}
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {schedule.vehicle?.registration} - {schedule.vehicle?.make} {schedule.vehicle?.model}
                            </p>
                            <p className="text-sm text-gray-500">
                              {schedule.inspection_type.replace('_', ' ').toUpperCase()} - {formatDate(schedule.scheduled_date)}
                            </p>
                            {schedule.maintenance_provider && (
                              <p className="text-xs text-gray-400">
                                Provider: {schedule.maintenance_provider.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            new Date(schedule.scheduled_date) < new Date()
                              ? 'bg-red-100 text-red-800'
                              : new Date(schedule.scheduled_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {new Date(schedule.scheduled_date) < new Date()
                              ? 'Overdue'
                              : new Date(schedule.scheduled_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                              ? 'This Week'
                              : 'Upcoming'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Add Inspection Modal */}
        {showAddModal && (
          <AddInspectionModal
            vehicles={vehicles}
            maintenanceProviders={maintenanceProviders}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false)
              fetchData()
            }}
          />
        )}

        {/* Provider Management Modal */}
        {showProviderModal && (
          <ProviderManagementModal
            providers={maintenanceProviders}
            onClose={() => setShowProviderModal(false)}
            onSuccess={() => {
              setShowProviderModal(false)
              fetchData()
            }}
          />
        )}

        {/* Inspection Detail Modal */}
        {showInspectionModal && selectedInspection && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isEditingInspection ? 'Edit Inspection' : 'Inspection Details'}
                  </h2>
                  <div className="flex items-center space-x-2">
                    {!isEditingInspection && (
                      <button
                        onClick={() => setIsEditingInspection(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowInspectionModal(false)
                        setSelectedInspection(null)
                        setIsEditingInspection(false)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {isEditingInspection ? (
                  <EditInspectionForm
                    inspection={selectedInspection}
                    vehicles={vehicles}
                    maintenanceProviders={maintenanceProviders}
                    onSave={() => {
                      setIsEditingInspection(false)
                      fetchData()
                    }}
                    onCancel={() => setIsEditingInspection(false)}
                  />
                ) : (
                  <div className="space-y-6">
                    {/* Vehicle Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Registration</p>
                          <p className="text-lg font-semibold text-gray-900">{selectedInspection.vehicle?.registration}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Make & Model</p>
                          <p className="text-lg font-semibold text-gray-900">{selectedInspection.vehicle?.make} {selectedInspection.vehicle?.model}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Year</p>
                          <p className="text-lg font-semibold text-gray-900">{selectedInspection.vehicle?.year}</p>
                        </div>
                      </div>
                    </div>

                    {/* Inspection Details */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Inspection Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Type</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedInspection.inspection_type.replace('_', ' ').toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Scheduled Date</p>
                          <p className="text-lg font-semibold text-gray-900">{formatDate(selectedInspection.scheduled_date)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Frequency</p>
                          <p className="text-lg font-semibold text-gray-900">Every {selectedInspection.frequency_weeks} weeks</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Status</p>
                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                            new Date(selectedInspection.scheduled_date) < new Date()
                              ? 'bg-red-100 text-red-800'
                              : new Date(selectedInspection.scheduled_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {new Date(selectedInspection.scheduled_date) < new Date()
                              ? 'Overdue'
                              : new Date(selectedInspection.scheduled_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                              ? 'This Week'
                              : 'Upcoming'
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Maintenance Provider */}
                    {selectedInspection.maintenance_provider && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Maintenance Provider</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Provider Name</p>
                            <p className="text-lg font-semibold text-gray-900">{selectedInspection.maintenance_provider.name}</p>
                          </div>
                          {selectedInspection.maintenance_provider.contact_person && (
                            <div>
                              <p className="text-sm font-medium text-gray-600">Contact Person</p>
                              <p className="text-lg font-semibold text-gray-900">{selectedInspection.maintenance_provider.contact_person}</p>
                            </div>
                          )}
                          {selectedInspection.maintenance_provider.phone && (
                            <div>
                              <p className="text-sm font-medium text-gray-600">Phone</p>
                              <p className="text-lg font-semibold text-gray-900">{selectedInspection.maintenance_provider.phone}</p>
                            </div>
                          )}
                          {selectedInspection.maintenance_provider.email && (
                            <div>
                              <p className="text-sm font-medium text-gray-600">Email</p>
                              <p className="text-lg font-semibold text-gray-900">{selectedInspection.maintenance_provider.email}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedInspection.notes && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                        <p className="text-gray-900">{selectedInspection.notes}</p>
                      </div>
                    )}

                    {/* Schedule Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Schedule Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Created</p>
                          <p className="text-lg font-semibold text-gray-900">{formatDate(selectedInspection.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Last Updated</p>
                          <p className="text-lg font-semibold text-gray-900">{formatDate(selectedInspection.updated_at)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Active</p>
                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                            selectedInspection.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedInspection.is_active ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// EditInspectionForm Component
function EditInspectionForm({
  inspection,
  vehicles,
  maintenanceProviders,
  onSave,
  onCancel
}: {
  inspection: InspectionSchedule
  vehicles: Vehicle[]
  maintenanceProviders: MaintenanceProvider[]
  onSave: () => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    vehicle_id: inspection.vehicle_id,
    inspection_type: inspection.inspection_type,
    scheduled_date: inspection.scheduled_date,
    frequency_weeks: inspection.frequency_weeks,
    maintenance_provider_id: inspection.maintenance_provider_id || '',
    notes: inspection.notes || '',
    is_active: inspection.is_active
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      const updateData = {
        vehicle_id: formData.vehicle_id,
        inspection_type: formData.inspection_type,
        scheduled_date: formData.scheduled_date,
        frequency_weeks: formData.frequency_weeks,
        maintenance_provider_id: formData.maintenance_provider_id || null,
        notes: formData.notes || null,
        is_active: formData.is_active
      }

      const { error: updateError } = await supabase
        .from('inspection_schedules')
        .update(updateData)
        .eq('id', inspection.id)
        .eq('tenant_id', tenantIdResult)

      if (updateError) {
        throw updateError
      }

      onSave()
    } catch (err: any) {
      console.error('Error updating inspection:', err)
      setError(err.message || 'Failed to update inspection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
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
      )}

      {/* Vehicle Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Vehicle *
        </label>
        <select
          value={formData.vehicle_id}
          onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Select a vehicle</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registration} - {vehicle.make} {vehicle.model} ({vehicle.year})
            </option>
          ))}
        </select>
      </div>

      {/* Inspection Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Inspection Type *
        </label>
        <select
          value={formData.inspection_type}
          onChange={(e) => setFormData({ ...formData, inspection_type: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="safety_inspection">Safety Inspection</option>
          <option value="mot">MOT</option>
          <option value="tax">Tax</option>
          <option value="tacho_calibration">Tacho Calibration</option>
        </select>
      </div>

      {/* Scheduled Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Scheduled Date *
        </label>
        <input
          type="date"
          value={formData.scheduled_date}
          onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Frequency (weeks) *
        </label>
        <input
          type="number"
          min="1"
          max="52"
          value={formData.frequency_weeks}
          onChange={(e) => setFormData({ ...formData, frequency_weeks: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
        <p className="text-sm text-gray-500 mt-1">
          How often this inspection should be repeated (in weeks)
        </p>
      </div>

      {/* Maintenance Provider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Maintenance Provider
        </label>
        <select
          value={formData.maintenance_provider_id}
          onChange={(e) => setFormData({ ...formData, maintenance_provider_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select a provider (optional)</option>
          {maintenanceProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Additional notes or comments..."
        />
      </div>

      {/* Active Status */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
          Active Schedule
        </label>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {loading && (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          <span>{loading ? 'Updating...' : 'Update Inspection'}</span>
        </button>
      </div>
    </form>
  )
}

// AddInspectionModal Component
function AddInspectionModal({
  vehicles,
  maintenanceProviders,
  onClose,
  onSuccess
}: {
  vehicles: Vehicle[]
  maintenanceProviders: MaintenanceProvider[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    vehicle_id: '',
    inspection_type: 'safety_inspection' as 'safety_inspection' | 'tax' | 'mot' | 'tacho_calibration',
    scheduled_date: '',
    frequency_weeks: 8,
    maintenance_provider_id: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      const inspectionData = {
        tenant_id: tenantId,
        vehicle_id: formData.vehicle_id,
        inspection_type: formData.inspection_type,
        scheduled_date: formData.scheduled_date,
        frequency_weeks: formData.frequency_weeks,
        maintenance_provider_id: formData.maintenance_provider_id || null,
        notes: formData.notes || null,
        is_active: true
      }

      const { error: insertError } = await supabase
        .from('inspection_schedules')
        .insert(inspectionData)

      if (insertError) {
        throw insertError
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error scheduling inspection:', err)
      setError(err.message || 'Failed to schedule inspection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Schedule New Inspection</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
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
          )}

          {/* Vehicle Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle *
            </label>
            <select
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration} - {vehicle.make} {vehicle.model} ({vehicle.year})
                </option>
              ))}
            </select>
          </div>

          {/* Inspection Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Inspection Type *
            </label>
            <select
              value={formData.inspection_type}
              onChange={(e) => setFormData({ ...formData, inspection_type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="safety_inspection">Safety Inspection</option>
              <option value="mot">MOT</option>
              <option value="tax">Tax</option>
              <option value="tacho_calibration">Tacho Calibration</option>
            </select>
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scheduled Date *
            </label>
            <input
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frequency (weeks) *
            </label>
            <input
              type="number"
              min="1"
              max="52"
              value={formData.frequency_weeks}
              onChange={(e) => setFormData({ ...formData, frequency_weeks: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              How often this inspection should be repeated (in weeks)
            </p>
          </div>

          {/* Maintenance Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maintenance Provider
            </label>
            <select
              value={formData.maintenance_provider_id}
              onChange={(e) => setFormData({ ...formData, maintenance_provider_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a provider (optional)</option>
              {maintenanceProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes or comments..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{loading ? 'Scheduling...' : 'Schedule Inspection'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ProviderManagementModal Component
function ProviderManagementModal({
  providers,
  onClose,
  onSuccess
}: {
  providers: MaintenanceProvider[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [showAddEditModal, setShowAddEditModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<MaintenanceProvider | null>(null)

  const handleEdit = (provider: MaintenanceProvider) => {
    setEditingProvider(provider)
    setShowAddEditModal(true)
  }

  const handleAdd = () => {
    setEditingProvider(null)
    setShowAddEditModal(true)
  }

  const handleDelete = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return

    try {
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      const { error } = await supabase
        .from('maintenance_providers')
        .delete()
        .eq('id', providerId)
        .eq('tenant_id', tenantIdResult)

      if (error) {
        throw error
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error deleting provider:', err)
      alert('Failed to delete provider: ' + err.message)
    }
  }

  const handleToggleActive = async (provider: MaintenanceProvider) => {
    try {
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      const { error } = await supabase
        .from('maintenance_providers')
        .update({ is_active: !provider.is_active })
        .eq('id', provider.id)
        .eq('tenant_id', tenantIdResult)

      if (error) {
        throw error
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error updating provider:', err)
      alert('Failed to update provider: ' + err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Manage Maintenance Providers</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Provider</span>
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {providers.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-gray-500">No maintenance providers found</p>
              <p className="text-sm text-gray-400 mt-1">Add your first provider to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {providers.map((provider) => (
                <div key={provider.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          provider.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {provider.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {provider.contact_person && (
                        <p className="text-sm text-gray-600 mt-1">Contact: {provider.contact_person}</p>
                      )}
                      {provider.email && (
                        <p className="text-sm text-gray-600">Email: {provider.email}</p>
                      )}
                      {provider.phone && (
                        <p className="text-sm text-gray-600">Phone: {provider.phone}</p>
                      )}
                      {provider.specializations && provider.specializations.length > 0 && (
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-1">
                            {provider.specializations.map((spec, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {spec}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleActive(provider)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          provider.is_active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {provider.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleEdit(provider)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(provider.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Provider Modal */}
      {showAddEditModal && (
        <AddEditProviderModal
          provider={editingProvider}
          onClose={() => setShowAddEditModal(false)}
          onSuccess={() => {
            setShowAddEditModal(false)
            onSuccess()
          }}
        />
      )}
    </div>
  )
}

// AddEditProviderModal Component
function AddEditProviderModal({
  provider,
  onClose,
  onSuccess
}: {
  provider: MaintenanceProvider | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: provider?.name || '',
    contact_person: provider?.contact_person || '',
    email: provider?.email || '',
    phone: provider?.phone || '',
    address: provider?.address || '',
    specializations: provider?.specializations || [],
    is_active: provider?.is_active ?? true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newSpecialization, setNewSpecialization] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      const providerData = {
        tenant_id: tenantId,
        name: formData.name,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        specializations: formData.specializations,
        is_active: formData.is_active
      }

      if (provider) {
        // Update existing provider
        const { error: updateError } = await supabase
          .from('maintenance_providers')
          .update(providerData)
          .eq('id', provider.id)
          .eq('tenant_id', tenantIdResult)

        if (updateError) {
          throw updateError
        }
      } else {
        // Create new provider
        const { error: insertError } = await supabase
          .from('maintenance_providers')
          .insert(providerData)

        if (insertError) {
          throw insertError
        }
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error saving provider:', err)
      setError(err.message || 'Failed to save provider')
    } finally {
      setLoading(false)
    }
  }

  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.specializations.includes(newSpecialization.trim())) {
      setFormData({
        ...formData,
        specializations: [...formData.specializations, newSpecialization.trim()]
      })
      setNewSpecialization('')
    }
  }

  const removeSpecialization = (specialization: string) => {
    setFormData({
      ...formData,
      specializations: formData.specializations.filter(s => s !== specialization)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {provider ? 'Edit Provider' : 'Add New Provider'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
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
          )}

          {/* Provider Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Person
            </label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Specializations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specializations
            </label>
            <div className="space-y-3">
              {/* Add new specialization */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newSpecialization}
                  onChange={(e) => setNewSpecialization(e.target.value)}
                  placeholder="Add specialization..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={addSpecialization}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Add
                </button>
              </div>
              
              {/* Current specializations */}
              <div className="flex flex-wrap gap-2">
                {formData.specializations.map((specialization, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {specialization}
                    <button
                      type="button"
                      onClick={() => removeSpecialization(specialization)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
              Active Provider
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{loading ? 'Saving...' : (provider ? 'Update Provider' : 'Add Provider')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

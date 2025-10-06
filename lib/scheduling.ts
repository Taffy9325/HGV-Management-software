import { supabase } from './supabase'

export interface InspectionSchedule {
  id: string
  tenant_id: string
  vehicle_id: string
  maintenance_provider_id?: string
  inspection_type: string
  scheduled_date: string
  frequency_weeks: number
  notes?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface RecurringScheduleConfig {
  tenant_id: string
  vehicle_id: string
  maintenance_provider_id?: string
  inspection_type: string
  start_date: string
  frequency_weeks: number
  notes?: string
  max_future_schedules?: number // Default to 12 months worth
}

/**
 * Calculate the next scheduled date based on frequency weeks
 */
export function calculateNextScheduledDate(
  lastScheduledDate: string, 
  frequencyWeeks: number
): string {
  const lastDate = new Date(lastScheduledDate)
  const nextDate = new Date(lastDate)
  
  // Add the frequency weeks (7 days per week)
  nextDate.setDate(nextDate.getDate() + (frequencyWeeks * 7))
  
  const result = nextDate.toISOString().split('T')[0]
  
  console.log('calculateNextScheduledDate:', {
    lastScheduledDate,
    frequencyWeeks,
    lastDate: lastDate.toISOString(),
    nextDate: nextDate.toISOString(),
    result
  })
  
  return result
}

/**
 * Generate multiple future scheduled dates
 */
export function generateFutureScheduledDates(
  startDate: string,
  frequencyWeeks: number,
  count: number
): string[] {
  const dates: string[] = []
  let currentDate = startDate
  
  for (let i = 0; i < count; i++) {
    dates.push(currentDate)
    currentDate = calculateNextScheduledDate(currentDate, frequencyWeeks)
  }
  
  return dates
}

/**
 * Create recurring inspection schedules
 */
export async function createRecurringSchedules(config: RecurringScheduleConfig): Promise<{
  success: boolean
  created: number
  errors: string[]
}> {
  const errors: string[] = []
  let created = 0
  
  try {
    console.log('createRecurringSchedules called with config:', config)
    
    // Calculate how many schedules to create for exactly 52 weeks
    const maxSchedules = Math.ceil(52 / config.frequency_weeks)
    
    console.log('Creating schedules:', {
      maxSchedules,
      frequencyWeeks: config.frequency_weeks,
      startDate: config.start_date
    })
    
    // Generate future scheduled dates
    const scheduledDates = generateFutureScheduledDates(
      config.start_date,
      config.frequency_weeks,
      maxSchedules
    )
    
    console.log('Generated scheduled dates:', scheduledDates)
    
    // Validate required fields
    if (!config.tenant_id || !config.vehicle_id || !config.inspection_type) {
      errors.push('Missing required fields: tenant_id, vehicle_id, or inspection_type')
      return { success: false, created, errors }
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(config.tenant_id)) {
      errors.push(`Invalid tenant_id format: ${config.tenant_id}`)
      return { success: false, created, errors }
    }
    if (!uuidRegex.test(config.vehicle_id)) {
      errors.push(`Invalid vehicle_id format: ${config.vehicle_id}`)
      return { success: false, created, errors }
    }
    
    console.log('Validated config:', {
      tenant_id: config.tenant_id,
      vehicle_id: config.vehicle_id,
      inspection_type: config.inspection_type,
      maintenance_provider_id: config.maintenance_provider_id
    })
    
    // Check for existing schedules to avoid duplicates
    const { data: existingSchedules, error: checkError } = await supabase
      .from('inspection_schedules')
      .select('scheduled_date')
      .eq('tenant_id', config.tenant_id)
      .eq('vehicle_id', config.vehicle_id)
      .eq('inspection_type', config.inspection_type)
      .eq('is_active', true)
    
    if (checkError) {
      console.warn('Error checking existing schedules:', checkError)
    }
    
    const existingDates = new Set(existingSchedules?.map(s => s.scheduled_date) || [])
    console.log('Existing schedule dates:', Array.from(existingDates))
    
    // Filter out dates that already exist
    const newScheduledDates = scheduledDates.filter(date => !existingDates.has(date))
    console.log('New schedule dates to create:', newScheduledDates)
    
    if (newScheduledDates.length === 0) {
      console.log('All scheduled dates already exist, no new schedules to create')
      return { success: true, created: 0, errors: [] }
    }
    
    // Prepare batch insert data
    const schedulesToCreate = newScheduledDates.map(date => ({
      tenant_id: config.tenant_id,
      vehicle_id: config.vehicle_id,
      maintenance_provider_id: config.maintenance_provider_id || null,
      inspection_type: config.inspection_type,
      scheduled_date: date,
      frequency_weeks: config.frequency_weeks,
      notes: config.notes || null,
      is_active: true
    }))
    
    // Insert schedules in batches to avoid database limits
    const batchSize = 50
    for (let i = 0; i < schedulesToCreate.length; i += batchSize) {
      const batch = schedulesToCreate.slice(i, i + batchSize)
      
      const { error } = await supabase
        .from('inspection_schedules')
        .insert(batch)
      
      if (error) {
        console.error(`Error creating schedules batch ${i / batchSize + 1}:`, error)
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`)
      } else {
        created += batch.length
      }
    }
    
    console.log(`Created ${created} recurring schedules for ${config.inspection_type}`)
    
    return {
      success: errors.length === 0,
      created,
      errors
    }
    
  } catch (error: any) {
    console.error('Error creating recurring schedules:', error)
    errors.push(error.message || 'Unknown error occurred')
    
    return {
      success: false,
      created,
      errors
    }
  }
}

/**
 * Update recurring schedules when an inspection is completed
 */
export async function updateRecurringSchedules(
  completedScheduleId: string,
  tenantId: string
): Promise<{
  success: boolean
  created: number
  errors: string[]
}> {
  const errors: string[] = []
  let created = 0
  
  try {
    // Get the completed schedule details
    const { data: completedSchedule, error: fetchError } = await supabase
      .from('inspection_schedules')
      .select('*')
      .eq('id', completedScheduleId)
      .single()
    
    if (fetchError || !completedSchedule) {
      errors.push('Could not find completed schedule')
      return { success: false, created, errors }
    }
    
    // Check if there are future schedules for this vehicle and inspection type
    const { data: futureSchedules, error: futureError } = await supabase
      .from('inspection_schedules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', completedSchedule.vehicle_id)
      .eq('inspection_type', completedSchedule.inspection_type)
      .eq('is_active', true)
      .gt('scheduled_date', completedSchedule.scheduled_date)
      .order('scheduled_date', { ascending: true })
    
    if (futureError) {
      errors.push('Error checking future schedules')
      return { success: false, created, errors }
    }
    
    // If no future schedules exist, create them
    if (!futureSchedules || futureSchedules.length === 0) {
      const nextDate = calculateNextScheduledDate(
        completedSchedule.scheduled_date,
        completedSchedule.frequency_weeks
      )
      
      const result = await createRecurringSchedules({
        tenant_id: tenantId,
        vehicle_id: completedSchedule.vehicle_id,
        maintenance_provider_id: completedSchedule.maintenance_provider_id,
        inspection_type: completedSchedule.inspection_type,
        start_date: nextDate,
        frequency_weeks: completedSchedule.frequency_weeks,
        notes: completedSchedule.notes,
        max_future_schedules: Math.ceil(52 / completedSchedule.frequency_weeks) // 12 months worth
      })
      
      created = result.created
      errors.push(...result.errors)
    }
    
    return {
      success: errors.length === 0,
      created,
      errors
    }
    
  } catch (error: any) {
    console.error('Error updating recurring schedules:', error)
    errors.push(error.message || 'Unknown error occurred')
    
    return {
      success: false,
      created,
      errors
    }
  }
}

/**
 * Clean up old completed schedules and ensure future schedules exist
 */
export async function maintainRecurringSchedules(tenantId: string): Promise<{
  success: boolean
  processed: number
  errors: string[]
}> {
  const errors: string[] = []
  let processed = 0
  
  try {
    console.log('maintainRecurringSchedules called for tenant:', tenantId)
    
    // Get all active schedules
    const { data: allSchedules, error: fetchError } = await supabase
      .from('inspection_schedules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('scheduled_date', { ascending: true })
    
    console.log('Found schedules:', allSchedules?.length || 0)
    
    if (fetchError) {
      errors.push('Error fetching schedules')
      return { success: false, processed, errors }
    }
    
    if (!allSchedules || allSchedules.length === 0) {
      return { success: true, processed: 0, errors }
    }
    
    // Group schedules by vehicle and inspection type
    const scheduleGroups = new Map<string, InspectionSchedule[]>()
    
    allSchedules.forEach(schedule => {
      const key = `${schedule.vehicle_id}::${schedule.inspection_type}`
      if (!scheduleGroups.has(key)) {
        scheduleGroups.set(key, [])
      }
      scheduleGroups.get(key)!.push(schedule)
    })
    
    // Process each group
    for (const [key, schedules] of scheduleGroups) {
      const [vehicleId, inspectionType] = key.split('::')
      
      // Sort schedules by date
      schedules.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
      
      // Find the most recent schedule
      const mostRecent = schedules[schedules.length - 1]
      
      // Check if we need to create future schedules
      const today = new Date().toISOString().split('T')[0]
      const futureSchedules = schedules.filter(s => s.scheduled_date > today)
      
      if (futureSchedules.length < 3) { // Ensure at least 3 future schedules
        // Find the latest future schedule to avoid duplicates
        const latestFutureSchedule = futureSchedules.length > 0 
          ? futureSchedules[futureSchedules.length - 1]
          : mostRecent
        
        const nextDate = calculateNextScheduledDate(
          latestFutureSchedule.scheduled_date,
          mostRecent.frequency_weeks
        )
        
        console.log(`Creating recurring schedules for ${vehicleId} - ${inspectionType}`)
        console.log('Schedule details:', {
          vehicle_id: vehicleId,
          inspection_type: inspectionType,
          maintenance_provider_id: mostRecent.maintenance_provider_id,
          frequency_weeks: mostRecent.frequency_weeks,
          latest_schedule_date: latestFutureSchedule.scheduled_date,
          next_date: nextDate,
          existing_future_count: futureSchedules.length
        })
        
        const result = await createRecurringSchedules({
          tenant_id: tenantId,
          vehicle_id: vehicleId,
          maintenance_provider_id: mostRecent.maintenance_provider_id,
          inspection_type: inspectionType,
          start_date: nextDate,
          frequency_weeks: mostRecent.frequency_weeks,
          notes: mostRecent.notes,
          max_future_schedules: Math.ceil(52 / mostRecent.frequency_weeks) // Create schedules for 52 weeks
        })
        
        processed += result.created
        errors.push(...result.errors)
      }
    }
    
    return {
      success: errors.length === 0,
      processed,
      errors
    }
    
  } catch (error: any) {
    console.error('Error maintaining recurring schedules:', error)
    errors.push(error.message || 'Unknown error occurred')
    
    return {
      success: false,
      processed,
      errors
    }
  }
}

/**
 * Get scheduling statistics for a tenant
 */
export async function getSchedulingStats(tenantId: string): Promise<{
  totalSchedules: number
  upcomingSchedules: number
  overdueSchedules: number
  recurringTypes: { [key: string]: number }
}> {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Get all active schedules
    const { data: schedules, error } = await supabase
      .from('inspection_schedules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
    
    if (error) {
      console.error('Error fetching scheduling stats:', error)
      return {
        totalSchedules: 0,
        upcomingSchedules: 0,
        overdueSchedules: 0,
        recurringTypes: {}
      }
    }
    
    const totalSchedules = schedules?.length || 0
    const upcomingSchedules = schedules?.filter(s => s.scheduled_date >= today).length || 0
    const overdueSchedules = schedules?.filter(s => s.scheduled_date < today).length || 0
    
    // Count recurring types
    const recurringTypes: { [key: string]: number } = {}
    schedules?.forEach(schedule => {
      const key = `${schedule.inspection_type}-${schedule.frequency_weeks}w`
      recurringTypes[key] = (recurringTypes[key] || 0) + 1
    })
    
    return {
      totalSchedules,
      upcomingSchedules,
      overdueSchedules,
      recurringTypes
    }
    
  } catch (error) {
    console.error('Error getting scheduling stats:', error)
    return {
      totalSchedules: 0,
      upcomingSchedules: 0,
      overdueSchedules: 0,
      recurringTypes: {}
    }
  }
}

import { DVSAWalkaround, DefectReport, SafetyInspection } from './schemas'
import { supabase } from './supabase'

/**
 * Process DVSA walkaround check and determine VOR status
 */
export async function processWalkaroundCheck(
  walkaroundData: DVSAWalkaround
): Promise<{
  id: string
  vor_required: boolean
  vehicle_status: string
  defects_count: number
  nil_defect: boolean
}> {
  // Determine if VOR is required based on defect severity
  const dangerousDefects = walkaroundData.defects?.filter(
    defect => defect.severity === 'dangerous'
  ) || []
  
  const vor_required = dangerousDefects.length > 0 || walkaroundData.vor_required
  
  // Insert walkaround check
  const { data, error } = await supabase
    .from('walkaround_checks')
    .insert({
      driver_id: walkaroundData.driver_id,
      vehicle_id: walkaroundData.vehicle_id,
      check_data: walkaroundData,
      defects_found: (walkaroundData.defects?.length || 0) > 0,
      vor_required: vor_required
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to save walkaround check: ${error.message}`)
  }
  
  // Insert defects if any
  if (walkaroundData.defects && walkaroundData.defects.length > 0) {
    const defectInserts = walkaroundData.defects.map(defect => ({
      walkaround_id: data.id,
      vehicle_id: walkaroundData.vehicle_id,
      defect_type: defect.category,
      severity: defect.severity,
      description: defect.description,
      status: defect.severity === 'dangerous' ? 'immediate_vor' : 'open'
    }))
    
    await supabase
      .from('defects')
      .insert(defectInserts)
  }
  
  // Update vehicle status if VOR required
  if (vor_required) {
    await supabase
      .from('vehicles')
      .update({ status: 'out_of_service' })
      .eq('id', walkaroundData.vehicle_id)
  }
  
  return {
    id: data.id,
    vor_required,
    vehicle_status: vor_required ? 'out_of_service' : 'in_service',
    defects_count: walkaroundData.defects?.length || 0,
    nil_defect: walkaroundData.nil_defect
  }
}

/**
 * Process defect report
 */
export async function processDefectReport(
  defectData: DefectReport
): Promise<{
  id: string
  vor_immediate: boolean
  repair_required: boolean
}> {
  const vor_immediate = defectData.severity === 'dangerous' || defectData.vor_immediate
  
  const { data, error } = await supabase
    .from('defects')
    .insert({
      vehicle_id: defectData.vehicle_id,
      defect_type: defectData.defect_type,
      severity: defectData.severity,
      description: defectData.description,
      status: vor_immediate ? 'immediate_vor' : 'open'
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to save defect report: ${error.message}`)
  }
  
  // Update vehicle status if immediate VOR required
  if (vor_immediate) {
    await supabase
      .from('vehicles')
      .update({ status: 'out_of_service' })
      .eq('id', defectData.vehicle_id)
  }
  
  return {
    id: data.id,
    vor_immediate,
    repair_required: defectData.repair_required
  }
}

/**
 * Process safety inspection (PMI)
 */
export async function processSafetyInspection(
  inspectionData: SafetyInspection
): Promise<{
  id: string
  inspection_passed: boolean
  next_inspection_due: string
  defects_found: number
}> {
  const { data, error } = await supabase
    .from('safety_inspections')
    .insert({
      vehicle_id: inspectionData.vehicle_id,
      inspector_id: inspectionData.inspector_id,
      inspection_data: inspectionData,
      inspection_passed: inspectionData.inspection_passed,
      next_inspection_due: inspectionData.next_inspection_due
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to save safety inspection: ${error.message}`)
  }
  
  // Insert defects if any
  if (inspectionData.defects_found && inspectionData.defects_found.length > 0) {
    const defectInserts = inspectionData.defects_found.map(defect => ({
      inspection_id: data.id,
      vehicle_id: inspectionData.vehicle_id,
      defect_type: defect.defect_type,
      severity: defect.severity,
      description: defect.description,
      status: 'open'
    }))
    
    await supabase
      .from('defects')
      .insert(defectInserts)
  }
  
  return {
    id: data.id,
    inspection_passed: inspectionData.inspection_passed,
    next_inspection_due: inspectionData.next_inspection_due,
    defects_found: inspectionData.defects_found?.length || 0
  }
}

/**
 * Generate DVSA examiner pack for 15-month retention
 */
export async function generateExaminerPack(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<{
  packId: string
  downloadUrl: string
  recordCount: number
}> {
  // Get all inspection data for the period
  const [walkarounds, defects, inspections] = await Promise.all([
    supabase
      .from('walkaround_checks')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('completed_at', startDate)
      .lte('completed_at', endDate),
    
    supabase
      .from('defects')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('reported_at', startDate)
      .lte('reported_at', endDate),
    
    supabase
      .from('safety_inspections')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('inspection_date', startDate)
      .lte('inspection_date', endDate)
  ])
  
  const packData = {
    tenant_id: tenantId,
    period: { start: startDate, end: endDate },
    generated_at: new Date().toISOString(),
    walkaround_checks: walkarounds.data || [],
    defects: defects.data || [],
    safety_inspections: inspections.data || []
  }
  
  // Generate ZIP file (simplified - in production use a proper ZIP library)
  const packId = `examiner_pack_${tenantId}_${Date.now()}`
  
  // Store pack metadata
  await supabase
    .from('examiner_packs')
    .insert({
      id: packId,
      tenant_id: tenantId,
      period_start: startDate,
      period_end: endDate,
      pack_data: packData,
      generated_at: new Date().toISOString()
    })
  
  // Generate download URL (in production, this would be a signed URL to a ZIP file)
  const downloadUrl = `/api/examiner-packs/${packId}/download`
  
  return {
    packId,
    downloadUrl,
    recordCount: (walkarounds.data?.length || 0) + (defects.data?.length || 0) + (inspections.data?.length || 0)
  }
}

/**
 * Check DVSA compliance status for a vehicle
 */
export async function checkVehicleCompliance(vehicleId: string): Promise<{
  compliant: boolean
  issues: string[]
  lastWalkaround: string | null
  lastInspection: string | null
  outstandingDefects: number
}> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  
  // Get recent walkaround checks
  const { data: walkarounds } = await supabase
    .from('walkaround_checks')
    .select('completed_at, vor_required')
    .eq('vehicle_id', vehicleId)
    .gte('completed_at', sevenDaysAgo)
    .order('completed_at', { ascending: false })
  
  // Get outstanding defects
  const { data: defects } = await supabase
    .from('defects')
    .select('id, severity, status')
    .eq('vehicle_id', vehicleId)
    .in('status', ['open', 'immediate_vor'])
  
  // Get last safety inspection
  const { data: inspections } = await supabase
    .from('safety_inspections')
    .select('inspection_date, inspection_passed')
    .eq('vehicle_id', vehicleId)
    .order('inspection_date', { ascending: false })
    .limit(1)
  
  const issues: string[] = []
  let compliant = true
  
  // Check if walkaround required (daily for commercial vehicles)
  if (!walkarounds || walkarounds.length === 0) {
    issues.push('No walkaround check in the last 7 days')
    compliant = false
  }
  
  // Check for VOR status
  const vorRequired = walkarounds?.some(w => w.vor_required) || false
  if (vorRequired) {
    issues.push('Vehicle is out of service due to defects')
    compliant = false
  }
  
  // Check outstanding defects
  const dangerousDefects = defects?.filter(d => d.severity === 'dangerous' && d.status !== 'closed') || []
  if (dangerousDefects.length > 0) {
    issues.push(`${dangerousDefects.length} dangerous defects outstanding`)
    compliant = false
  }
  
  // Check safety inspection status
  const lastInspection = inspections?.[0]
  if (lastInspection && !lastInspection.inspection_passed) {
    issues.push('Last safety inspection failed')
    compliant = false
  }
  
  return {
    compliant,
    issues,
    lastWalkaround: walkarounds?.[0]?.completed_at || null,
    lastInspection: lastInspection?.inspection_date || null,
    outstandingDefects: defects?.length || 0
  }
}

/**
 * Get DVSA compliance dashboard data
 */
export async function getComplianceDashboard(tenantId: string): Promise<{
  totalVehicles: number
  compliantVehicles: number
  nonCompliantVehicles: number
  vehiclesInVOR: number
  outstandingDefects: number
  recentWalkarounds: number
  upcomingInspections: number
}> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  
  const [
    vehiclesResult,
    vorVehiclesResult,
    defectsResult,
    walkaroundsResult,
    inspectionsResult
  ] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, status')
      .eq('tenant_id', tenantId),
    
    supabase
      .from('vehicles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'out_of_service'),
    
    supabase
      .from('defects')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'immediate_vor']),
    
    supabase
      .from('walkaround_checks')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('completed_at', sevenDaysAgo),
    
    supabase
      .from('safety_inspections')
      .select('id')
      .eq('tenant_id', tenantId)
      .lte('next_inspection_due', thirtyDaysFromNow)
  ])
  
  const totalVehicles = vehiclesResult.data?.length || 0
  const vehiclesInVOR = vorVehiclesResult.data?.length || 0
  const compliantVehicles = totalVehicles - vehiclesInVOR
  const nonCompliantVehicles = vehiclesInVOR
  
  return {
    totalVehicles,
    compliantVehicles,
    nonCompliantVehicles,
    vehiclesInVOR,
    outstandingDefects: defectsResult.data?.length || 0,
    recentWalkarounds: walkaroundsResult.data?.length || 0,
    upcomingInspections: inspectionsResult.data?.length || 0
  }
}


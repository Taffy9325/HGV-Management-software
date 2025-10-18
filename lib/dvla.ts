import { supabase } from './supabase'
import { DVSAWalkaround, DefectReport, SafetyInspection } from './schemas'

// DVLA API Configuration
const DVLA_API_BASE_URL = 'https://driver-vehicle-licensing.api.gov.uk'
const DVLA_API_KEY = process.env.DVLA_VEHICLE_API_KEY || process.env.DVLA_API_KEY

export interface DVLALicenceResponse {
  licenceNumber: string
  surname: string
  forenames: string[]
  dateOfBirth: string
  entitlements: {
    category: string
    validFrom: string
    validTo: string
    restrictions: string[]
  }[]
  endorsements: {
    offenceDate: string
    offenceCode: string
    convictionDate: string
    penaltyPoints: number
  }[]
}

export interface DVLAMOTResponse {
  registrationNumber: string
  make: string
  model: string
  firstUsedDate: string
  fuelType: string
  motTestExpiryDate: string
  motTestNumber: string
  rfrAndComments: {
    text: string
    type: string
  }[]
}

export interface DVLATaxResponse {
  registrationNumber: string
  taxStatus: string
  taxDueDate: string
  artEndDate: string
  motStatus: string
  motExpiryDate: string
  yearOfManufacture: number
  co2Emissions: number
  fuelType: string
  markedForExport: boolean
  colour: string
  typeApproval: string
  wheelplan: string
  revenueWeight: number
  realDrivingEmissions: string
  dateOfFirstRegistration: string
  euroStatus: string
}

// Combined response interface for the actual DVLA API
export interface DVLAResponse {
  registrationNumber: string
  make: string
  model?: string
  firstUsedDate?: string
  fuelType: string
  motTestExpiryDate?: string
  motTestNumber?: string
  rfrAndComments?: {
    text: string
    type: string
  }[]
  taxStatus: string
  taxDueDate: string
  artEndDate?: string
  motStatus: string
  motExpiryDate: string
  yearOfManufacture: number
  co2Emissions: number
  markedForExport: boolean
  colour: string
  typeApproval: string
  wheelplan: string
  revenueWeight?: number
  realDrivingEmissions?: string
  dateOfFirstRegistration?: string
  euroStatus?: string
  engineCapacity?: number
  dateOfLastV5CIssued?: string
  monthOfFirstRegistration?: string
}

/**
 * Check driver licence status via DVLA API
 */
export async function checkDriverLicence(
  licenceNumber: string,
  surname: string,
  dateOfBirth: string
): Promise<DVLALicenceResponse> {
  if (!DVLA_API_KEY) {
    throw new Error('DVLA API key not configured')
  }

  const response = await fetch(`${DVLA_API_BASE_URL}/driver-check/v1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DVLA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      licenceNumber,
      surname,
      dateOfBirth
    })
  })

  if (!response.ok) {
    throw new Error(`DVLA API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Check vehicle information via DVLA API (includes MOT and tax data)
 */
export async function checkVehicleInfo(registration: string): Promise<DVLAResponse> {
  if (!DVLA_API_KEY) {
    throw new Error('DVLA API key not configured')
  }

  const response = await fetch(`${DVLA_API_BASE_URL}/vehicle-enquiry/v1/vehicles`, {
    method: 'POST',
    headers: {
      'x-api-key': DVLA_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      registrationNumber: registration
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DVLA API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

/**
 * Check vehicle MOT status via DVLA API
 */
export async function checkMOTStatus(registration: string): Promise<DVLAMOTResponse> {
  const data = await checkVehicleInfo(registration)
  return {
    registrationNumber: data.registrationNumber,
    make: data.make,
    model: data.model,
    firstUsedDate: data.firstUsedDate,
    fuelType: data.fuelType,
    motTestExpiryDate: data.motTestExpiryDate,
    motTestNumber: data.motTestNumber,
    rfrAndComments: data.rfrAndComments
  }
}

/**
 * Check vehicle tax status via DVLA API
 */
export async function checkTaxStatus(registration: string): Promise<DVLATaxResponse> {
  const data = await checkVehicleInfo(registration)
  return {
    registrationNumber: data.registrationNumber,
    taxStatus: data.taxStatus,
    taxDueDate: data.taxDueDate,
    artEndDate: data.artEndDate,
    motStatus: data.motStatus,
    motExpiryDate: data.motExpiryDate,
    yearOfManufacture: data.yearOfManufacture,
    co2Emissions: data.co2Emissions,
    fuelType: data.fuelType,
    markedForExport: data.markedForExport,
    colour: data.colour,
    typeApproval: data.typeApproval,
    wheelplan: data.wheelplan,
    revenueWeight: data.revenueWeight,
    realDrivingEmissions: data.realDrivingEmissions,
    dateOfFirstRegistration: data.dateOfFirstRegistration,
    euroStatus: data.euroStatus
  }
}

/**
 * Validate driver licence and store result
 */
export async function validateAndStoreDriverLicence(
  driverId: string,
  licenceNumber: string,
  surname: string,
  dateOfBirth: string
): Promise<{
  isValid: boolean
  expiresSoon: boolean
  hasEndorsements: boolean
  data: DVLALicenceResponse
}> {
  try {
    const licenceData = await checkDriverLicence(licenceNumber, surname, dateOfBirth)
    
    // Check if licence is valid
    const now = new Date()
    const expiryDate = new Date(licenceData.entitlements[0]?.validTo || '')
    const isValid = expiryDate > now
    
    // Check if expires within 30 days
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expiresSoon = expiryDate <= thirtyDaysFromNow
    
    // Check for endorsements
    const hasEndorsements = licenceData.endorsements.length > 0
    
    // Store result in database
    await supabase
      .from('driver_licence_checks')
      .insert({
        driver_id: driverId,
        licence_number: licenceNumber,
        check_date: now.toISOString(),
        licence_data: licenceData,
        is_valid: isValid,
        expires_soon: expiresSoon,
        has_endorsements: hasEndorsements
      })
    
    return {
      isValid,
      expiresSoon,
      hasEndorsements,
      data: licenceData
    }
  } catch (error) {
    console.error('Driver licence validation failed:', error)
    throw error
  }
}

/**
 * Validate vehicle MOT and tax status
 */
export async function validateAndStoreVehicleStatus(
  vehicleId: string,
  registration: string
): Promise<{
  motValid: boolean
  motExpiresSoon: boolean
  taxValid: boolean
  motData: DVLAMOTResponse
  taxData: DVLATaxResponse
}> {
  try {
    const [motData, taxData] = await Promise.all([
      checkMOTStatus(registration),
      checkTaxStatus(registration)
    ])
    
    const now = new Date()
    const motExpiryDate = new Date(motData.motTestExpiryDate)
    const motValid = motExpiryDate > now
    
    // Check if MOT expires within 30 days
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const motExpiresSoon = motExpiryDate <= thirtyDaysFromNow
    
    // Check tax status
    const taxValid = taxData.taxStatus === 'Taxed' || taxData.taxStatus === 'SORN'
    
    // Store results in database
    await supabase
      .from('vehicle_status_checks')
      .insert({
        vehicle_id: vehicleId,
        registration: registration,
        check_date: now.toISOString(),
        mot_data: motData,
        tax_data: taxData,
        mot_valid: motValid,
        mot_expires_soon: motExpiresSoon,
        tax_valid: taxValid
      })
    
    return {
      motValid,
      motExpiresSoon,
      taxValid,
      motData,
      taxData
    }
  } catch (error) {
    console.error('Vehicle status validation failed:', error)
    throw error
  }
}

/**
 * Check if driver can be assigned to jobs (licence valid, no endorsements)
 */
export async function canDriverBeAssigned(driverId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('driver_licence_checks')
    .select('is_valid, has_endorsements, check_date')
    .eq('driver_id', driverId)
    .order('check_date', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !data) {
    return false
  }
  
  // Check if licence check is recent (within 24 hours)
  const checkDate = new Date(data.check_date)
  const now = new Date()
  const hoursSinceCheck = (now.getTime() - checkDate.getTime()) / (1000 * 60 * 60)
  
  if (hoursSinceCheck > 24) {
    return false // Need fresh check
  }
  
  return data.is_valid && !data.has_endorsements
}

/**
 * Check if vehicle can be assigned to jobs (MOT and tax valid)
 */
export async function canVehicleBeAssigned(vehicleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('vehicle_status_checks')
    .select('mot_valid, tax_valid, check_date')
    .eq('vehicle_id', vehicleId)
    .order('check_date', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !data) {
    return false
  }
  
  // Check if status check is recent (within 24 hours)
  const checkDate = new Date(data.check_date)
  const now = new Date()
  const hoursSinceCheck = (now.getTime() - checkDate.getTime()) / (1000 * 60 * 60)
  
  if (hoursSinceCheck > 24) {
    return false // Need fresh check
  }
  
  return data.mot_valid && data.tax_valid
}

/**
 * Get expiring licences and MOTs for alerts
 */
export async function getExpiringLicencesAndMOTs(tenantId: string): Promise<{
  expiringLicences: any[]
  expiringMOTs: any[]
}> {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  
  const [licenceResult, motResult] = await Promise.all([
    supabase
      .from('driver_licence_checks')
      .select(`
        *,
        drivers!inner(tenant_id, licence_number, licence_expiry)
      `)
      .eq('drivers.tenant_id', tenantId)
      .lte('drivers.licence_expiry', thirtyDaysFromNow)
      .eq('is_valid', true),
    
    supabase
      .from('vehicle_status_checks')
      .select(`
        *,
        vehicles!inner(tenant_id, registration)
      `)
      .eq('vehicles.tenant_id', tenantId)
      .lte('mot_expiry_date', thirtyDaysFromNow)
      .eq('mot_valid', true)
  ])
  
  return {
    expiringLicences: licenceResult.data || [],
    expiringMOTs: motResult.data || []
  }
}


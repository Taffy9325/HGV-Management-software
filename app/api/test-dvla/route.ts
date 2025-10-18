import { NextRequest, NextResponse } from 'next/server'
import { checkVehicleInfo, validateAndStoreVehicleStatus } from '@/lib/dvla'

export async function POST(request: NextRequest) {
  try {
    const { registration, vehicleId } = await request.json()
    
    if (!registration) {
      return NextResponse.json(
        { error: 'Registration number is required' },
        { status: 400 }
      )
    }
    
    // Check if DVLA API key is configured
    if (!process.env.DVLA_VEHICLE_API_KEY && !process.env.DVLA_API_KEY) {
      return NextResponse.json(
        { error: 'DVLA API key not configured' },
        { status: 500 }
      )
    }
    
    // Test basic API connectivity
    const vehicleData = await checkVehicleInfo(registration)
    
    // If vehicleId is provided, store the results
    let storedResults = null
    if (vehicleId) {
      storedResults = await validateAndStoreVehicleStatus(vehicleId, registration)
    }
    
    return NextResponse.json({
      success: true,
      registration,
      vehicleData,
      storedResults,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('DVLA API test error:', error)
    
    return NextResponse.json(
      { 
        error: error.message,
        details: error.message.includes('404') ? 'Vehicle registration not found' : 
                error.message.includes('401') ? 'Invalid API key' :
                error.message.includes('403') ? 'API key access denied' :
                error.message.includes('400') ? 'Invalid request format' :
                'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'DVLA API Test Endpoint',
    usage: 'POST with { "registration": "AB12CDE", "vehicleId": "optional" }',
    endpoints: {
      mot: 'Check MOT status',
      tax: 'Check tax status',
      store: 'Store results in database (if vehicleId provided)'
    }
  })
}

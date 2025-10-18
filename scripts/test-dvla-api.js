// Test script for DVLA API integration
import { checkMOTStatus, checkTaxStatus } from './lib/dvla'

async function testDVLAAPI() {
  console.log('🧪 Testing DVLA API Integration...')
  
  // Test with a sample registration (you can replace this with a real one)
  const testRegistration = 'AB12CDE' // Replace with a real registration for testing
  
  try {
    console.log(`📋 Testing MOT status for registration: ${testRegistration}`)
    const motData = await checkMOTStatus(testRegistration)
    console.log('✅ MOT Status:', motData)
    
    console.log(`📋 Testing Tax status for registration: ${testRegistration}`)
    const taxData = await checkTaxStatus(testRegistration)
    console.log('✅ Tax Status:', taxData)
    
    console.log('🎉 DVLA API integration is working correctly!')
  } catch (error) {
    console.error('❌ DVLA API test failed:', error.message)
    
    if (error.message.includes('API key not configured')) {
      console.log('💡 Make sure DVLA_VEHICLE_API_KEY is set in your .env.local file')
    } else if (error.message.includes('404')) {
      console.log('💡 Registration not found - try with a real vehicle registration')
    } else if (error.message.includes('401') || error.message.includes('403')) {
      console.log('💡 API key may be invalid or expired')
    }
  }
}

// Run the test
testDVLAAPI()

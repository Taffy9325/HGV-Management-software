'use client'

import { useState } from 'react'

export default function DVLATestComponent() {
  const [registration, setRegistration] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testDVLAAPI = async () => {
    if (!registration.trim()) {
      setError('Please enter a vehicle registration')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/test-dvla', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registration: registration.trim().toUpperCase() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'API request failed')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">DVLA API Test</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="registration" className="block text-sm font-medium text-gray-700 mb-2">
            Vehicle Registration
          </label>
          <input
            type="text"
            id="registration"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            placeholder="Enter vehicle registration (e.g., AB12CDE)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <button
          onClick={testDVLAAPI}
          disabled={loading || !registration.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Testing...' : 'Test DVLA API'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success!</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p><strong>Registration:</strong> {result.registration}</p>
                  <p><strong>Make:</strong> {result.vehicleData?.make || 'Unknown'}</p>
                  <p><strong>Model:</strong> {result.vehicleData?.model || 'Unknown'}</p>
                  <p><strong>Year:</strong> {result.vehicleData?.yearOfManufacture || 'Unknown'}</p>
                  <p><strong>Fuel Type:</strong> {result.vehicleData?.fuelType || 'Unknown'}</p>
                  <p><strong>MOT Status:</strong> {result.vehicleData?.motStatus || 'Unknown'}</p>
                  <p><strong>MOT Expiry:</strong> {result.vehicleData?.motExpiryDate ? new Date(result.vehicleData.motExpiryDate).toLocaleDateString() : 'No MOT data'}</p>
                  <p><strong>Tax Status:</strong> {result.vehicleData?.taxStatus || 'No tax data'}</p>
                  <p><strong>Tax Due:</strong> {result.vehicleData?.taxDueDate ? new Date(result.vehicleData.taxDueDate).toLocaleDateString() : 'No tax data'}</p>
                  <p><strong>Colour:</strong> {result.vehicleData?.colour || 'Unknown'}</p>
                  <p><strong>Weight:</strong> {result.vehicleData?.revenueWeight ? result.vehicleData.revenueWeight + 'kg' : 'Unknown'}</p>
                  <p><strong>Engine:</strong> {result.vehicleData?.engineCapacity ? result.vehicleData.engineCapacity + 'cc' : 'Unknown'}</p>
                  <p><strong>CO2:</strong> {result.vehicleData?.co2Emissions ? result.vehicleData.co2Emissions + 'g/km' : 'Unknown'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <h3 className="font-medium mb-2">What this tests:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>DVLA API connectivity</li>
          <li>Vehicle MOT status</li>
          <li>Vehicle tax status</li>
          <li>Vehicle details (make, model, etc.)</li>
        </ul>
      </div>
    </div>
  )
}

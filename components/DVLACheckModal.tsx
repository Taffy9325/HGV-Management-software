'use client'

import { useState } from 'react'

interface DVLACheckModalProps {
  isOpen: boolean
  onClose: () => void
  onVehicleFound?: (vehicleData: any) => void
}

export default function DVLACheckModal({ isOpen, onClose, onVehicleFound }: DVLACheckModalProps) {
  const [registration, setRegistration] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheckVehicle = async () => {
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

  const handleClose = () => {
    setRegistration('')
    setResult(null)
    setError(null)
    onClose()
  }

  const handleUseVehicleData = () => {
    if (result && onVehicleFound) {
      onVehicleFound(result.vehicleData)
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">DVLA Vehicle Check</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label htmlFor="registration" className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Registration
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="registration"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                placeholder="Enter vehicle registration (e.g., AB12CDE)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                onKeyPress={(e) => e.key === 'Enter' && handleCheckVehicle()}
              />
              <button
                onClick={handleCheckVehicle}
                disabled={loading || !registration.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Checking...' : 'Check'}
              </button>
            </div>
          </div>

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
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-green-800 mb-2">Vehicle Found!</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm text-green-700">
                    <div>
                      <p><strong>Registration:</strong> {result.registration}</p>
                      <p><strong>Make:</strong> {result.vehicleData?.make || 'Unknown'}</p>
                      <p><strong>Model:</strong> {result.vehicleData?.model || 'Unknown'}</p>
                      <p><strong>Year:</strong> {result.vehicleData?.yearOfManufacture || 'Unknown'}</p>
                    </div>
                    <div>
                      <p><strong>Fuel Type:</strong> {result.vehicleData?.fuelType || 'Unknown'}</p>
                      <p><strong>MOT Status:</strong> {result.vehicleData?.motStatus || 'Unknown'}</p>
                      <p><strong>Tax Status:</strong> {result.vehicleData?.taxStatus || 'Unknown'}</p>
                      <p><strong>Colour:</strong> {result.vehicleData?.colour || 'Unknown'}</p>
                    </div>
                  </div>
                  {onVehicleFound && (
                    <div className="mt-4">
                      <button
                        onClick={handleUseVehicleData}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        Use This Vehicle Data
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">What this checks:</h3>
            <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
              <li>Vehicle registration validity</li>
              <li>Make, model, and year information</li>
              <li>MOT status and expiry date</li>
              <li>Tax status and due date</li>
              <li>Vehicle specifications (fuel type, colour, etc.)</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

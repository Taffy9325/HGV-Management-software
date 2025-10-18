import DVLATestComponent from '@/components/DVLATestComponent'

export default function DVLATestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">DVLA API Integration Test</h1>
          <p className="mt-2 text-gray-600">
            Test your DVLA API key and vehicle information checking functionality
          </p>
        </div>
        
        <DVLATestComponent />
        
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">API Key Status</h3>
          <div className="text-sm text-blue-700">
            <p>Environment Variable: <code className="bg-blue-100 px-1 rounded">DVLA_VEHICLE_API_KEY</code></p>
            <p>Status: {process.env.DVLA_VEHICLE_API_KEY ? '✅ Configured' : '❌ Not configured'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

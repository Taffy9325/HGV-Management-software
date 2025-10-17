'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
}

interface CompletedInspection {
  id: string
  vehicle_id: string
  inspection_type: 'safety_inspection' | 'tacho_calibration'
  completion_date: string
  inspector_id?: string
  mileage?: number
  notes?: string
  inspection_passed?: boolean
  next_due_date?: string
  vehicle?: Vehicle
}

interface CompletedInspectionsModalProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
}

export default function CompletedInspectionsModal({
  isOpen,
  onClose,
  tenantId
}: CompletedInspectionsModalProps) {
  const [inspections, setInspections] = useState<CompletedInspection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchCompletedInspections()
    }
  }, [isOpen, tenantId])

  const fetchCompletedInspections = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('inspection_completions')
        .select(`
          id,
          vehicle_id,
          inspection_type,
          completion_date,
          inspector_id,
          mileage,
          notes,
          inspection_passed,
          next_due_date,
          vehicles!inner (
            id,
            registration,
            make,
            model,
            year
          )
        `)
        .eq('tenant_id', tenantId)
        .order('completion_date', { ascending: false })

      if (error) {
        throw error
      }

      const formattedInspections = (data || []).map(inspection => ({
        ...inspection,
        vehicle: inspection.vehicles
      }))

      setInspections(formattedInspections)
    } catch (err: any) {
      console.error('Error fetching completed inspections:', err)
      setError(err.message || 'Failed to load completed inspections')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const generateInspectionReport = async (inspection: CompletedInspection) => {
    try {
      // Fetch inspection documents
      const { data: documents } = await supabase
        .from('inspection_document_attachments')
        .select('*')
        .eq('inspection_completion_id', inspection.id)

      // Create HTML report
      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Inspection Report - ${inspection.vehicle?.registration}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .section h3 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .info-item { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .status-passed { color: green; font-weight: bold; }
            .status-failed { color: red; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Vehicle Inspection Report</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
          </div>
          
          <div class="section">
            <h3>Vehicle Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Registration:</span> ${inspection.vehicle?.registration}
              </div>
              <div class="info-item">
                <span class="label">Make/Model:</span> ${inspection.vehicle?.make} ${inspection.vehicle?.model}
              </div>
              <div class="info-item">
                <span class="label">Year:</span> ${inspection.vehicle?.year}
              </div>
              <div class="info-item">
                <span class="label">Mileage:</span> ${inspection.mileage || 'N/A'}
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3>Inspection Details</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Type:</span> ${inspection.inspection_type === 'safety_inspection' ? 'Safety Inspection' : 'Tacho Calibration'}
              </div>
              <div class="info-item">
                <span class="label">Completion Date:</span> ${formatDate(inspection.completion_date)}
              </div>
              <div class="info-item">
                <span class="label">Result:</span> 
                <span class="${inspection.inspection_passed ? 'status-passed' : 'status-failed'}">
                  ${inspection.inspection_passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
              <div class="info-item">
                <span class="label">Next Due:</span> ${inspection.next_due_date ? formatDate(inspection.next_due_date) : 'N/A'}
              </div>
            </div>
          </div>
          
          ${inspection.notes ? `
          <div class="section">
            <h3>Notes</h3>
            <p>${inspection.notes}</p>
          </div>
          ` : ''}
          
          ${documents && documents.length > 0 ? `
          <div class="section">
            <h3>Attached Documents</h3>
            <ul>
              ${documents.map(doc => `<li>${doc.document_name}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
        </body>
        </html>
      `

      // Open in new window for printing
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(reportHtml)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Failed to generate inspection report')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Completed Inspections</h2>
              <p className="text-sm text-gray-600 mt-1">
                All completed inspections across the fleet
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading completed inspections...</span>
            </div>
          ) : error ? (
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
          ) : inspections.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No completed inspections found</p>
              <p className="text-sm text-gray-400 mt-1">Complete inspections to see them here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {inspections.map((inspection) => (
                <div key={inspection.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        inspection.inspection_passed ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <svg className={`w-5 h-5 ${
                          inspection.inspection_passed ? 'text-green-600' : 'text-red-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {inspection.vehicle?.registration} - {inspection.vehicle?.make} {inspection.vehicle?.model}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            inspection.inspection_type === 'safety_inspection' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {inspection.inspection_type === 'safety_inspection' ? 'Safety Inspection' : 'Tacho Calibration'}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            inspection.inspection_passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {inspection.inspection_passed ? 'PASSED' : 'FAILED'}
                          </span>
                          <span className="text-xs text-gray-500">
                            Completed {formatDate(inspection.completion_date)}
                          </span>
                        </div>
                        {inspection.mileage && (
                          <p className="text-xs text-gray-500 mt-1">
                            Mileage: {inspection.mileage.toLocaleString()}
                          </p>
                        )}
                        {inspection.next_due_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Next due: {formatDate(inspection.next_due_date)}
                          </p>
                        )}
                        {inspection.notes && (
                          <p className="text-xs text-gray-500 mt-1">
                            Notes: {inspection.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => generateInspectionReport(inspection)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

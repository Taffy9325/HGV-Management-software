'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import InspectionDetailsModal from './InspectionDetailsModal'

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
}

interface FailedInspection {
  id: string
  vehicle_id: string
  inspection_type: 'safety_inspection' | 'tacho_calibration'
  completion_date: string
  completed_by?: string
  inspector_name?: string
  inspector_certificate_number?: string
  mileage?: number
  notes?: string
  inspection_passed?: boolean
  next_inspection_due?: string
  vehicle?: Vehicle
}

interface FailedInspectionsModalProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
}

export default function FailedInspectionsModal({
  isOpen,
  onClose,
  tenantId
}: FailedInspectionsModalProps) {
  const [inspections, setInspections] = useState<FailedInspection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingInspection, setEditingInspection] = useState<FailedInspection | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedInspection, setSelectedInspection] = useState<FailedInspection | null>(null)
  const [editFormData, setEditFormData] = useState({
    completion_date: '',
    inspector_name: '',
    inspector_certificate_number: '',
    mileage: '',
    notes: '',
    inspection_passed: false,
    next_inspection_due: ''
  })

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchFailedInspections()
    }
  }, [isOpen, tenantId])

  const fetchFailedInspections = async () => {
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
          completed_by,
          inspector_name,
          inspector_certificate_number,
          mileage,
          notes,
          inspection_passed,
          next_inspection_due,
          vehicles!inner (
            id,
            registration,
            make,
            model,
            year
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('inspection_passed', false)
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
      console.error('Error fetching failed inspections:', err)
      setError(err.message || 'Failed to load failed inspections')
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

  const handleEditInspection = (inspection: FailedInspection) => {
    setEditingInspection(inspection)
    setEditFormData({
      completion_date: inspection.completion_date,
      inspector_name: inspection.inspector_name || '',
      inspector_certificate_number: inspection.inspector_certificate_number || '',
      mileage: inspection.mileage?.toString() || '',
      notes: inspection.notes || '',
      inspection_passed: inspection.inspection_passed || false,
      next_inspection_due: inspection.next_inspection_due || ''
    })
    setShowEditModal(true)
  }

  const handleViewDetails = (inspection: FailedInspection) => {
    setSelectedInspection(inspection)
    setShowDetailsModal(true)
  }

  const handleUpdateInspection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingInspection) return

    try {
      const updateData = {
        completion_date: editFormData.completion_date,
        inspector_name: editFormData.inspector_name || null,
        inspector_certificate_number: editFormData.inspector_certificate_number || null,
        mileage: editFormData.mileage ? parseInt(editFormData.mileage) : null,
        notes: editFormData.notes || null,
        inspection_passed: editFormData.inspection_passed,
        next_inspection_due: editFormData.next_inspection_due || null,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('inspection_completions')
        .update(updateData)
        .eq('id', editingInspection.id)

      if (error) {
        throw error
      }

      // Refresh the inspections list
      await fetchFailedInspections()
      setShowEditModal(false)
      setEditingInspection(null)
    } catch (err: any) {
      console.error('Error updating inspection:', err)
      alert('Failed to update inspection: ' + err.message)
    }
  }

  const handleDeleteInspection = async (inspection: FailedInspection) => {
    if (!confirm(`Are you sure you want to delete this failed inspection for ${inspection.vehicle?.registration}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('inspection_completions')
        .delete()
        .eq('id', inspection.id)

      if (error) {
        throw error
      }

      // Refresh the inspections list
      await fetchFailedInspections()
    } catch (err: any) {
      console.error('Error deleting inspection:', err)
      alert('Failed to delete inspection: ' + err.message)
    }
  }

  const generateInspectionReport = async (inspection: FailedInspection) => {
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
          <title>Failed Inspection Report - ${inspection.vehicle?.registration}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .section h3 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .info-item { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .status-failed { color: red; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Failed Inspection Report</h1>
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
                <span class="status-failed">FAILED</span>
              </div>
              <div class="info-item">
                <span class="label">Next Due:</span> ${inspection.next_inspection_due ? formatDate(inspection.next_inspection_due) : 'N/A'}
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
              <h2 className="text-xl font-semibold text-gray-900">Failed Inspections</h2>
              <p className="text-sm text-gray-600 mt-1">
                All failed inspections across the fleet
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <span className="ml-2 text-gray-600">Loading failed inspections...</span>
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
              <p className="text-gray-500">No failed inspections found</p>
              <p className="text-sm text-gray-400 mt-1">All inspections are passing</p>
            </div>
          ) : (
            <div className="space-y-4">
              {inspections.map((inspection) => (
                <div key={inspection.id} className="bg-white border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            FAILED
                          </span>
                          <span className="text-xs text-gray-500">
                            Failed {formatDate(inspection.completion_date)}
                          </span>
                        </div>
                        {inspection.mileage && (
                          <p className="text-xs text-gray-500 mt-1">
                            Mileage: {inspection.mileage.toLocaleString()}
                          </p>
                        )}
                        {inspection.next_inspection_due && (
                          <p className="text-xs text-gray-500 mt-1">
                            Next due: {formatDate(inspection.next_inspection_due)}
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
                        onClick={() => handleViewDetails(inspection)}
                        className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>View Details</span>
                      </button>
                      <button
                        onClick={() => handleEditInspection(inspection)}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteInspection(inspection)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
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

      {/* Edit Inspection Modal */}
      {showEditModal && editingInspection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Failed Inspection - {editingInspection.vehicle?.registration}
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingInspection(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateInspection} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.completion_date}
                    onChange={(e) => setEditFormData({ ...editFormData, completion_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Inspection Due
                  </label>
                  <input
                    type="date"
                    value={editFormData.next_inspection_due}
                    onChange={(e) => setEditFormData({ ...editFormData, next_inspection_due: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inspector Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.inspector_name}
                    onChange={(e) => setEditFormData({ ...editFormData, inspector_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inspector Certificate Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.inspector_certificate_number}
                    onChange={(e) => setEditFormData({ ...editFormData, inspector_certificate_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mileage
                </label>
                <input
                  type="number"
                  value={editFormData.mileage}
                  onChange={(e) => setEditFormData({ ...editFormData, mileage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="inspection_passed"
                  checked={editFormData.inspection_passed}
                  onChange={(e) => setEditFormData({ ...editFormData, inspection_passed: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="inspection_passed" className="ml-2 block text-sm text-gray-900">
                  Inspection Passed
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingInspection(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Update Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspection Details Modal */}
      {showDetailsModal && selectedInspection && (
        <InspectionDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedInspection(null)
          }}
          inspection={selectedInspection}
          tenantId={tenantId}
        />
      )}
    </div>
  )
}

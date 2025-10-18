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
  completed_by?: string
  inspector_name?: string
  inspector_certificate_number?: string
  mileage?: number
  notes?: string
  inspection_passed?: boolean
  next_inspection_due?: string
  vehicle?: Vehicle
}

interface InspectionDocument {
  id: string
  vehicle_document_id: string
  attachment_type: string
  vehicle_documents: {
    id: string
    document_name: string
    supabase_path: string
    file_type?: string
    file_size?: number
    uploaded_at: string
    notes?: string
  }
}

interface InspectionDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  inspection: CompletedInspection | null
  tenantId: string
}

export default function InspectionDetailsModal({
  isOpen,
  onClose,
  inspection,
  tenantId
}: InspectionDetailsModalProps) {
  const [documents, setDocuments] = useState<InspectionDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewingFile, setViewingFile] = useState<string | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && inspection) {
      fetchInspectionDocuments()
    }
  }, [isOpen, inspection])

  const fetchInspectionDocuments = async () => {
    if (!inspection) return

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('inspection_document_attachments')
        .select(`
          id,
          vehicle_document_id,
          attachment_type,
          vehicle_documents!inner (
            id,
            document_name,
            supabase_path,
            file_type,
            file_size,
            uploaded_at,
            notes
          )
        `)
        .eq('inspection_completion_id', inspection.id)

      if (error) {
        throw error
      }

      setDocuments(data || [])
    } catch (err: any) {
      console.error('Error fetching inspection documents:', err)
      setError(err.message || 'Failed to load inspection documents')
    } finally {
      setLoading(false)
    }
  }

  const handleViewFile = async (document: InspectionDocument) => {
    try {
      setViewingFile(document.vehicle_documents.document_name)
      
      // Generate signed URL for the file - try both possible buckets
      let signedUrl: string | null = null
      let error: any = null

      // First try the inspections bucket (where files are actually stored)
      try {
        const { data, error: inspectionsError } = await supabase.storage
          .from('inspections')
          .createSignedUrl(document.vehicle_documents.supabase_path, 3600)

        if (!inspectionsError && data) {
          signedUrl = data.signedUrl
          console.log('File found in inspections bucket:', document.vehicle_documents.supabase_path)
        } else {
          error = inspectionsError
        }
      } catch (e) {
        error = e
      }

      // If that fails, try the vehicle-documents bucket
      if (!signedUrl) {
        try {
          const { data, error: vehicleDocsError } = await supabase.storage
            .from('vehicle-documents')
            .createSignedUrl(document.vehicle_documents.supabase_path, 3600)

          if (!vehicleDocsError && data) {
            signedUrl = data.signedUrl
            console.log('File found in vehicle-documents bucket:', document.vehicle_documents.supabase_path)
          } else {
            error = vehicleDocsError
          }
        } catch (e) {
          error = e
        }
      }

      if (!signedUrl) {
        throw error || new Error('File not found in any storage bucket')
      }

      setFileUrl(signedUrl)
    } catch (err: any) {
      console.error('Error generating file URL:', err)
      setError('Failed to load file: ' + err.message)
    }
  }

  const handleDownloadFile = async (document: InspectionDocument) => {
    try {
      // Try both possible buckets for download
      let signedUrl: string | null = null
      let error: any = null

      // First try the inspections bucket
      try {
        const { data, error: inspectionsError } = await supabase.storage
          .from('inspections')
          .createSignedUrl(document.vehicle_documents.supabase_path, 3600)

        if (!inspectionsError && data) {
          signedUrl = data.signedUrl
        } else {
          error = inspectionsError
        }
      } catch (e) {
        error = e
      }

      // If that fails, try the vehicle-documents bucket
      if (!signedUrl) {
        try {
          const { data, error: vehicleDocsError } = await supabase.storage
            .from('vehicle-documents')
            .createSignedUrl(document.vehicle_documents.supabase_path, 3600)

          if (!vehicleDocsError && data) {
            signedUrl = data.signedUrl
            console.log('File found in vehicle-documents bucket:', document.vehicle_documents.supabase_path)
          } else {
            error = vehicleDocsError
          }
        } catch (e) {
          error = e
        }
      }

      if (!signedUrl) {
        throw error || new Error('File not found in any storage bucket')
      }

      // Create a temporary link to download the file
      const link = document.createElement('a')
      link.href = signedUrl
      link.download = document.vehicle_documents.document_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err: any) {
      console.error('Error downloading file:', err)
      setError('Failed to download file: ' + err.message)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return '📄'
    
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊'
    return '📄'
  }

  if (!isOpen || !inspection) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Inspection Details</h2>
              <p className="text-sm text-gray-600 mt-1">
                {inspection.vehicle?.registration} - {inspection.vehicle?.make} {inspection.vehicle?.model}
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

        <div className="p-6 space-y-6">
          {error && (
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
          )}

          {/* Vehicle Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Registration</p>
                <p className="text-lg font-semibold text-gray-900">{inspection.vehicle?.registration}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Make & Model</p>
                <p className="text-lg font-semibold text-gray-900">{inspection.vehicle?.make} {inspection.vehicle?.model}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Year</p>
                <p className="text-lg font-semibold text-gray-900">{inspection.vehicle?.year}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Mileage</p>
                <p className="text-lg font-semibold text-gray-900">
                  {inspection.mileage ? inspection.mileage.toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Inspection Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Inspection Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Type</p>
                <p className="text-lg font-semibold text-gray-900">
                  {inspection.inspection_type === 'safety_inspection' ? 'Safety Inspection' : 'Tacho Calibration'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Date</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(inspection.completion_date)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Result</p>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  inspection.inspection_passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {inspection.inspection_passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Next Due</p>
                <p className="text-lg font-semibold text-gray-900">
                  {inspection.next_inspection_due ? formatDate(inspection.next_inspection_due) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Inspector Information */}
          {(inspection.inspector_name || inspection.inspector_certificate_number) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Inspector Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inspection.inspector_name && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Inspector Name</p>
                    <p className="text-lg font-semibold text-gray-900">{inspection.inspector_name}</p>
                  </div>
                )}
                {inspection.inspector_certificate_number && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Certificate Number</p>
                    <p className="text-lg font-semibold text-gray-900">{inspection.inspector_certificate_number}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {inspection.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
              <p className="text-gray-900">{inspection.notes}</p>
            </div>
          )}

          {/* Attached Documents */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Attached Documents</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">No documents attached to this inspection</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getFileIcon(doc.vehicle_documents.file_type)}</span>
                        <div>
                          <h4 className="font-medium text-gray-900">{doc.vehicle_documents.document_name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{formatFileSize(doc.vehicle_documents.file_size)}</span>
                            <span>Uploaded {formatDate(doc.vehicle_documents.uploaded_at)}</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {doc.attachment_type}
                            </span>
                          </div>
                          {doc.vehicle_documents.notes && (
                            <p className="text-sm text-gray-600 mt-1">{doc.vehicle_documents.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewFile(doc)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center space-x-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleDownloadFile(doc)}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center space-x-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Download</span>
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

      {/* File Viewer Modal */}
      {viewingFile && fileUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{viewingFile}</h3>
              <button
                onClick={() => {
                  setViewingFile(null)
                  setFileUrl(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 h-[calc(90vh-80px)]">
              <iframe
                src={fileUrl}
                className="w-full h-full border-0 rounded-lg"
                title={viewingFile}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

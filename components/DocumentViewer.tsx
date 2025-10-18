'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getOrCreateTenantId } from '@/lib/tenant'

interface VehicleDocument {
  id: string
  vehicle_id: string
  document_type: 'brake_test_certificate' | 'tacho_calibration_certificate' | 'safety_inspection_certificate' | 'mot_certificate' | 'insurance_certificate' | 'other'
  document_name: string
  supabase_path: string
  file_type?: string
  file_size?: number
  expiry_date?: string
  uploaded_by: string
  uploaded_at: string
  notes?: string
  is_active: boolean
}

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
}

interface DocumentViewerProps {
  isOpen: boolean
  onClose: () => void
  document: VehicleDocument | null
  vehicle: Vehicle | null
}

export default function DocumentViewer({
  isOpen,
  onClose,
  document,
  vehicle
}: DocumentViewerProps) {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'preview' | 'download'>('preview')

  useEffect(() => {
    if (isOpen && document) {
      loadDocument()
    }
  }, [isOpen, document])

  const loadDocument = async () => {
    if (!document) return

    try {
      setLoading(true)
      setError(null)

      // Try both possible buckets for signed URL
      let signedUrl: string | null = null
      let error: any = null

      // First try the vehicle-documents bucket
      try {
        const { data, error: vehicleDocsError } = await supabase.storage
          .from('vehicle-documents')
          .createSignedUrl(document.supabase_path, 3600)

        if (!vehicleDocsError && data) {
          signedUrl = data.signedUrl
        } else {
          error = vehicleDocsError
        }
      } catch (e) {
        error = e
      }

      // If that fails, try the inspections bucket
      if (!signedUrl) {
        try {
          const { data, error: inspectionsError } = await supabase.storage
            .from('inspections')
            .createSignedUrl(document.supabase_path, 3600)

          if (!inspectionsError && data) {
            signedUrl = data.signedUrl
          } else {
            error = inspectionsError
          }
        } catch (e) {
          error = e
        }
      }

      if (!signedUrl) {
        throw error || new Error('File not found in any storage bucket')
      }

      setDocumentUrl(signedUrl)
    } catch (err: any) {
      console.error('Error loading document:', err)
      setError(err.message || 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const downloadDocument = async () => {
    if (!document) return

    try {
      // Try both possible buckets for download
      let data: Blob | null = null
      let error: any = null

      // First try the vehicle-documents bucket
      try {
        const { data: vehicleDocsData, error: vehicleDocsError } = await supabase.storage
          .from('vehicle-documents')
          .download(document.supabase_path)

        if (!vehicleDocsError && vehicleDocsData) {
          data = vehicleDocsData
        } else {
          error = vehicleDocsError
        }
      } catch (e) {
        error = e
      }

      // If that fails, try the inspections bucket
      if (!data) {
        try {
          const { data: inspectionsData, error: inspectionsError } = await supabase.storage
            .from('inspections')
            .download(document.supabase_path)

          if (!inspectionsError && inspectionsData) {
            data = inspectionsData
          } else {
            error = inspectionsError
          }
        } catch (e) {
          error = e
        }
      }

      if (!data) {
        throw error || new Error('File not found in any storage bucket')
      }

      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = document.document_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Error downloading document:', err)
      setError(err.message || 'Failed to download document')
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDocumentTypeLabel = (type: VehicleDocument['document_type']) => {
    const labels = {
      brake_test_certificate: 'Brake Test Certificate',
      tacho_calibration_certificate: 'Tacho Calibration Certificate',
      safety_inspection_certificate: 'Safety Inspection Certificate',
      mot_certificate: 'MOT Certificate',
      insurance_certificate: 'Insurance Certificate',
      other: 'Other Document'
    }
    return labels[type]
  }

  const getDocumentTypeColor = (type: VehicleDocument['document_type']) => {
    const colors = {
      brake_test_certificate: 'bg-red-100 text-red-800',
      tacho_calibration_certificate: 'bg-blue-100 text-blue-800',
      safety_inspection_certificate: 'bg-green-100 text-green-800',
      mot_certificate: 'bg-purple-100 text-purple-800',
      insurance_certificate: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 text-gray-800'
    }
    return colors[type]
  }

  const isImageFile = (fileType?: string) => {
    return fileType?.startsWith('image/') || false
  }

  const isPdfFile = (fileType?: string) => {
    return fileType === 'application/pdf'
  }

  if (!isOpen || !document || !vehicle) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {document.document_name}
              </h2>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDocumentTypeColor(document.document_type)}`}>
                  {getDocumentTypeLabel(document.document_type)}
                </span>
                <span className="text-sm text-gray-500">
                  {vehicle.registration} - {vehicle.make} {vehicle.model} ({vehicle.year})
                </span>
                <span className="text-sm text-gray-500">
                  {formatFileSize(document.file_size)}
                </span>
                {document.expiry_date && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    new Date(document.expiry_date) <= new Date() ? 'bg-red-100 text-red-800' :
                    new Date(document.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    Expires: {formatDate(document.expiry_date)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'preview'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewMode('download')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'download'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Download
                </button>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {error && (
            <div className="p-6">
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
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading document...</p>
              </div>
            </div>
          ) : viewMode === 'download' ? (
            <div className="p-6">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Download Document</h3>
                <p className="text-gray-600 mb-6">
                  Click the button below to download this document to your device.
                </p>
                <button
                  onClick={downloadDocument}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download {document.document_name}</span>
                </button>
              </div>
            </div>
          ) : documentUrl ? (
            <div className="h-full overflow-hidden">
              {isImageFile(document.file_type) ? (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <img
                    src={documentUrl}
                    alt={document.document_name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : isPdfFile(document.file_type) ? (
                <iframe
                  src={documentUrl}
                  className="w-full h-full border-0"
                  title={document.document_name}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
                    <p className="text-gray-600 mb-4">
                      This file type cannot be previewed in the browser.
                    </p>
                    <button
                      onClick={downloadDocument}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Download Document</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading document...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              <p>Uploaded on {formatDate(document.uploaded_at)}</p>
              {document.notes && (
                <p className="mt-1">Notes: {document.notes}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={downloadDocument}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

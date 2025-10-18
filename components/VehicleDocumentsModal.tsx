'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getOrCreateTenantId } from '@/lib/tenant'
import DocumentViewer from './DocumentViewer'

interface Vehicle {
  id: string
  registration: string
  make: string | null
  model: string | null
  year: number | null
}

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
  source_table?: 'vehicle_documents' | 'brake_test_documents' | 'tacho_calibration_documents'
  test_result?: 'passed' | 'failed'
  test_condition?: 'unloaded' | 'loaded'
  calibration_date?: string
}

interface VehicleDocumentsModalProps {
  isOpen: boolean
  onClose: () => void
  vehicle: Vehicle
}

export default function VehicleDocumentsModal({
  isOpen,
  onClose,
  vehicle
}: VehicleDocumentsModalProps) {
  const [documents, setDocuments] = useState<VehicleDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    document_type: 'other' as VehicleDocument['document_type'],
    document_name: '',
    expiry_date: '',
    notes: ''
  })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showDocumentViewer, setShowDocumentViewer] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<VehicleDocument | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'inspections' | 'brake_tests' | 'tacho_calibrations' | 'tax_mot' | 'other'>('all')

  useEffect(() => {
    if (isOpen && vehicle.id) {
      fetchDocuments()
    }
  }, [isOpen, vehicle.id])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      setError(null)

      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      // Fetch from vehicle_documents table
      const { data: vehicleDocs, error: vehicleDocsError } = await supabase
        .from('vehicle_documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vehicle_id', vehicle.id)
        .eq('is_active', true)
        .order('uploaded_at', { ascending: false })

      if (vehicleDocsError) {
        throw vehicleDocsError
      }

      // Fetch brake test documents
      const { data: brakeTestDocs, error: brakeTestError } = await supabase
        .from('brake_test_documents')
        .select(`
          *,
          brake_tests (
            vehicle_id,
            test_result,
            test_condition,
            test_date
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('uploaded_at', { ascending: false })

      if (brakeTestError) {
        throw brakeTestError
      }

      // Filter brake test documents by vehicle_id
      const filteredBrakeTestDocs = brakeTestDocs?.filter(doc => 
        doc.brake_tests?.vehicle_id === vehicle.id
      ) || []

      // Fetch tacho calibration documents
      const { data: tachoDocs, error: tachoError } = await supabase
        .from('tacho_calibration_documents')
        .select(`
          *,
          tacho_calibrations (
            vehicle_id,
            calibration_date,
            expiry_date
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('uploaded_at', { ascending: false })

      if (tachoError) {
        throw tachoError
      }

      // Filter tacho calibration documents by vehicle_id
      const filteredTachoDocs = tachoDocs?.filter(doc => 
        doc.tacho_calibrations?.vehicle_id === vehicle.id
      ) || []

      // Combine all documents
      const allDocuments: VehicleDocument[] = [
        // Vehicle documents
        ...(vehicleDocs || []).map(doc => ({
          ...doc,
          source_table: 'vehicle_documents' as const
        })),
        // Brake test documents
        ...filteredBrakeTestDocs.map(doc => ({
          ...doc,
          source_table: 'brake_test_documents' as const,
          test_result: doc.brake_tests?.test_result,
          test_condition: doc.brake_tests?.test_condition,
          uploaded_at: doc.uploaded_at
        })),
        // Tacho calibration documents
        ...filteredTachoDocs.map(doc => ({
          ...doc,
          source_table: 'tacho_calibration_documents' as const,
          calibration_date: doc.tacho_calibrations?.calibration_date,
          expiry_date: doc.tacho_calibrations?.expiry_date,
          uploaded_at: doc.uploaded_at
        }))
      ]

      // Sort by upload date
      allDocuments.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())

      setDocuments(allDocuments)
    } catch (err: any) {
      console.error('Error fetching documents:', err)
      setError(err.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFile = async (file: File, userId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('vehicle-documents')
      .upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    return filePath
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0) {
      setError('Please select at least one file to upload')
      return
    }

    try {
      setUploading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error('User not authenticated')
      }

      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      // Upload files and create document records
      const uploadPromises = selectedFiles.map(async (file) => {
        const filePath = await uploadFile(file, session.user.id)
        
        return {
          tenant_id: tenantId,
          vehicle_id: vehicle.id,
          document_type: uploadForm.document_type,
          document_name: uploadForm.document_name || file.name,
          supabase_path: filePath,
          file_type: file.type,
          file_size: file.size,
          expiry_date: uploadForm.expiry_date || null,
          uploaded_by: session.user.id,
          notes: uploadForm.notes || null,
          is_active: true
        }
      })

      const documentData = await Promise.all(uploadPromises)

      const { error: insertError } = await supabase
        .from('vehicle_documents')
        .insert(documentData)

      if (insertError) {
        throw insertError
      }

      // Reset form and refresh documents
      setUploadForm({
        document_type: 'other',
        document_name: '',
        expiry_date: '',
        notes: ''
      })
      setSelectedFiles([])
      setShowUploadForm(false)
      await fetchDocuments()
    } catch (err: any) {
      console.error('Error uploading documents:', err)
      setError(err.message || 'Failed to upload documents')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      const { error } = await supabase
        .from('vehicle_documents')
        .update({ is_active: false })
        .eq('id', documentId)
        .eq('tenant_id', tenantId)

      if (error) {
        throw error
      }

      await fetchDocuments()
    } catch (err: any) {
      console.error('Error deleting document:', err)
      setError(err.message || 'Failed to delete document')
    }
  }

  const downloadDocument = async (document: VehicleDocument) => {
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

  const viewDocument = (document: VehicleDocument) => {
    setSelectedDocument(document)
    setShowDocumentViewer(true)
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
      year: 'numeric'
    })
  }

  const getDocumentTypeLabel = (type: VehicleDocument['document_type'] | VehicleDocument['source_table']) => {
    const labels = {
      brake_test_certificate: 'Brake Test Certificate',
      tacho_calibration_certificate: 'Tacho Calibration Certificate',
      safety_inspection_certificate: 'Safety Inspection Certificate',
      mot_certificate: 'MOT Certificate',
      insurance_certificate: 'Insurance Certificate',
      other: 'Other Document',
      brake_test_documents: 'Brake Test Certificate',
      tacho_calibration_documents: 'Tacho Calibration Certificate',
      vehicle_documents: 'Vehicle Document'
    }
    return labels[type as keyof typeof labels] || 'Unknown Document'
  }

  const getDocumentTypeColor = (type: VehicleDocument['document_type'] | VehicleDocument['source_table']) => {
    const colors = {
      brake_test_certificate: 'bg-red-100 text-red-800',
      tacho_calibration_certificate: 'bg-blue-100 text-blue-800',
      safety_inspection_certificate: 'bg-green-100 text-green-800',
      mot_certificate: 'bg-yellow-100 text-yellow-800',
      insurance_certificate: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800',
      brake_test_documents: 'bg-red-100 text-red-800',
      tacho_calibration_documents: 'bg-blue-100 text-blue-800',
      vehicle_documents: 'bg-gray-100 text-gray-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getFilteredDocuments = () => {
    switch (activeTab) {
      case 'inspections':
        return documents.filter(doc => 
          doc.source_table === 'vehicle_documents' && 
          doc.document_type === 'safety_inspection_certificate'
        )
      case 'brake_tests':
        return documents.filter(doc => doc.source_table === 'brake_test_documents')
      case 'tacho_calibrations':
        return documents.filter(doc => doc.source_table === 'tacho_calibration_documents')
      case 'tax_mot':
        return documents.filter(doc => 
          doc.source_table === 'vehicle_documents' && 
          (doc.document_type === 'mot_certificate' || doc.document_type === 'insurance_certificate')
        )
      case 'other':
        return documents.filter(doc => 
          doc.source_table === 'vehicle_documents' && 
          doc.document_type === 'other'
        )
      default:
        return documents
    }
  }

  const getTabCount = (tab: typeof activeTab) => {
    switch (tab) {
      case 'inspections':
        return documents.filter(doc => 
          doc.source_table === 'vehicle_documents' && 
          doc.document_type === 'safety_inspection_certificate'
        ).length
      case 'brake_tests':
        return documents.filter(doc => doc.source_table === 'brake_test_documents').length
      case 'tacho_calibrations':
        return documents.filter(doc => doc.source_table === 'tacho_calibration_documents').length
      case 'tax_mot':
        return documents.filter(doc => 
          doc.source_table === 'vehicle_documents' && 
          (doc.document_type === 'mot_certificate' || doc.document_type === 'insurance_certificate')
        ).length
      case 'other':
        return documents.filter(doc => 
          doc.source_table === 'vehicle_documents' && 
          doc.document_type === 'other'
        ).length
      default:
        return documents.length
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Vehicle Documents - {vehicle.registration}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {vehicle.make} {vehicle.model} ({vehicle.year})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowUploadForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Upload Document</span>
              </button>
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

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'all', label: 'All Documents', icon: '📄' },
              { key: 'inspections', label: 'Inspections', icon: '🔍' },
              { key: 'brake_tests', label: 'Brake Tests', icon: '🛑' },
              { key: 'tacho_calibrations', label: 'Tacho Calibrations', icon: '📊' },
              { key: 'tax_mot', label: 'Tax & MOT', icon: '📋' },
              { key: 'other', label: 'Other', icon: '📁' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  activeTab === tab.key 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {getTabCount(tab.key as typeof activeTab)}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
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

          {/* Upload Form */}
          {showUploadForm && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New Document</h3>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Type *
                    </label>
                    <select
                      value={uploadForm.document_type}
                      onChange={(e) => setUploadForm({ ...uploadForm, document_type: e.target.value as VehicleDocument['document_type'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="brake_test_certificate">Brake Test Certificate</option>
                      <option value="tacho_calibration_certificate">Tacho Calibration Certificate</option>
                      <option value="safety_inspection_certificate">Safety Inspection Certificate</option>
                      <option value="mot_certificate">MOT Certificate</option>
                      <option value="insurance_certificate">Insurance Certificate</option>
                      <option value="other">Other Document</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Name
                    </label>
                    <input
                      type="text"
                      value={uploadForm.document_name}
                      onChange={(e) => setUploadForm({ ...uploadForm, document_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter document name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={uploadForm.expiry_date}
                      onChange={(e) => setUploadForm({ ...uploadForm, expiry_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Files *
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter any notes about this document..."
                  />
                </div>

                {/* Selected Files */}
                {selectedFiles.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selected Files
                    </label>
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                          <div className="flex items-center space-x-3">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadForm(false)
                      setUploadForm({
                        document_type: 'other',
                        document_name: '',
                        expiry_date: '',
                        notes: ''
                      })
                      setSelectedFiles([])
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || selectedFiles.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {uploading && (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    <span>{uploading ? 'Uploading...' : 'Upload Documents'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Documents List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-gray-600">Loading documents...</p>
            </div>
          ) : getFilteredDocuments().length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">No documents in this category</p>
              <p className="text-sm text-gray-400 mt-1">
                {activeTab === 'all' ? 'Upload certificates and other documents for this vehicle' : 'Switch to another tab to view documents'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {getFilteredDocuments().map((document) => (
                <div key={document.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{document.document_name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDocumentTypeColor(document.source_table || document.document_type)}`}>
                            {getDocumentTypeLabel(document.source_table || document.document_type)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(document.file_size)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Uploaded {formatDate(document.uploaded_at)}
                          </span>
                        </div>
                        {document.expiry_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Expires: {formatDate(document.expiry_date)}
                          </p>
                        )}
                        {document.test_result && (
                          <p className="text-xs text-gray-500 mt-1">
                            Result: <span className={`font-medium ${document.test_result === 'passed' ? 'text-green-600' : 'text-red-600'}`}>
                              {document.test_result.charAt(0).toUpperCase() + document.test_result.slice(1)}
                            </span>
                            {document.test_condition && ` (${document.test_condition})`}
                          </p>
                        )}
                        {document.calibration_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Calibrated: {formatDate(document.calibration_date)}
                          </p>
                        )}
                        {document.notes && (
                          <p className="text-xs text-gray-500 mt-1">
                            {document.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => viewDocument(document)}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => downloadDocument(document)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(document.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer */}
      {showDocumentViewer && selectedDocument && (
        <DocumentViewer
          isOpen={showDocumentViewer}
          onClose={() => {
            setShowDocumentViewer(false)
            setSelectedDocument(null)
          }}
          document={selectedDocument}
          vehicle={vehicle}
        />
      )}
    </div>
  )
}

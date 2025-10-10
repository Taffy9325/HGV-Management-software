'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getOrCreateTenantId } from '@/lib/tenant'

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
}

interface VehicleDefect {
  id: string
  vehicle_id: string
  inspection_completion_id?: string
  defect_type: 'major' | 'minor' | 'advisory'
  defect_category: string
  description: string
  location_on_vehicle?: string
  severity_level: 'critical' | 'high' | 'medium' | 'low'
  reported_by: string
  reported_at: string
  status: 'open' | 'in_progress' | 'completed' | 'closed'
  due_date?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface DefectCompletion {
  id: string
  defect_id: string
  completed_by: string
  completion_date: string
  completion_notes?: string
  repair_method?: string
  parts_used?: string
  labor_hours?: number
  cost?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface DefectCompletionDocument {
  id: string
  defect_completion_id: string
  document_name: string
  supabase_path: string
  file_type?: string
  file_size?: number
  document_type: 'before_photo' | 'after_photo' | 'invoice' | 'receipt' | 'certificate' | 'other'
  uploaded_by: string
  uploaded_at: string
  notes?: string
  is_active: boolean
}

interface VehicleDefectsModalProps {
  isOpen: boolean
  onClose: () => void
  vehicle: Vehicle
}

export default function VehicleDefectsModal({
  isOpen,
  onClose,
  vehicle
}: VehicleDefectsModalProps) {
  const [defects, setDefects] = useState<VehicleDefect[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDefect, setSelectedDefect] = useState<VehicleDefect | null>(null)
  const [showCompletionForm, setShowCompletionForm] = useState(false)
  const [completionForm, setCompletionForm] = useState({
    completion_notes: '',
    repair_method: '',
    parts_used: '',
    labor_hours: '',
    cost: ''
  })
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && vehicle.id) {
      fetchDefects()
    }
  }, [isOpen, vehicle.id])

  const fetchDefects = async () => {
    try {
      setLoading(true)
      setError(null)

      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      const { data, error } = await supabase
        .from('vehicle_defects')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vehicle_id', vehicle.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setDefects(data || [])
    } catch (err: any) {
      console.error('Error fetching defects:', err)
      setError(err.message || 'Failed to load defects')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setCompletionFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setCompletionFiles(prev => prev.filter((_, i) => i !== index))
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

  const completeDefect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDefect) return

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

      // Upload files first
      const uploadedFiles: string[] = []
      for (let i = 0; i < completionFiles.length; i++) {
        const file = completionFiles[i]
        try {
          const filePath = await uploadFile(file, session.user.id)
          uploadedFiles.push(filePath)
        } catch (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError)
          throw new Error(`Failed to upload ${file.name}`)
        }
      }

      // Create defect completion record
      const completionData = {
        tenant_id: tenantId,
        defect_id: selectedDefect.id,
        completed_by: session.user.id,
        completion_notes: completionForm.completion_notes || null,
        repair_method: completionForm.repair_method || null,
        parts_used: completionForm.parts_used || null,
        labor_hours: completionForm.labor_hours ? parseFloat(completionForm.labor_hours) : null,
        cost: completionForm.cost ? parseFloat(completionForm.cost) : null,
        is_active: true
      }

      const { data: completion, error: completionError } = await supabase
        .from('defect_completions')
        .insert(completionData)
        .select()
        .single()

      if (completionError) {
        throw completionError
      }

      // Create document records for uploaded files
      if (uploadedFiles.length > 0) {
        const documentData = uploadedFiles.map((filePath, index) => ({
          tenant_id: tenantId,
          defect_completion_id: completion.id,
          document_name: completionFiles[index].name,
          supabase_path: filePath,
          file_type: completionFiles[index].type,
          file_size: completionFiles[index].size,
          document_type: 'other' as const, // Default type, could be enhanced
          uploaded_by: session.user.id,
          notes: `Uploaded during defect completion on ${new Date().toLocaleDateString()}`
        }))

        const { error: documentError } = await supabase
          .from('defect_completion_documents')
          .insert(documentData)

        if (documentError) {
          throw documentError
        }
      }

      // Update defect status to completed
      const { error: updateError } = await supabase
        .from('vehicle_defects')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDefect.id)

      if (updateError) {
        throw updateError
      }

      // Reset form and refresh defects
      setCompletionForm({
        completion_notes: '',
        repair_method: '',
        parts_used: '',
        labor_hours: '',
        cost: ''
      })
      setCompletionFiles([])
      setShowCompletionForm(false)
      setSelectedDefect(null)
      await fetchDefects()
    } catch (err: any) {
      console.error('Error completing defect:', err)
      setError(err.message || 'Failed to complete defect')
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getDefectTypeColor = (type: VehicleDefect['defect_type']) => {
    const colors = {
      major: 'bg-red-100 text-red-800',
      minor: 'bg-yellow-100 text-yellow-800',
      advisory: 'bg-blue-100 text-blue-800'
    }
    return colors[type]
  }

  const getSeverityColor = (severity: VehicleDefect['severity_level']) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    }
    return colors[severity]
  }

  const getStatusColor = (status: VehicleDefect['status']) => {
    const colors = {
      open: 'bg-red-100 text-red-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    }
    return colors[status]
  }

  const getStatusLabel = (status: VehicleDefect['status']) => {
    const labels = {
      open: 'Open',
      in_progress: 'In Progress',
      completed: 'Completed',
      closed: 'Closed'
    }
    return labels[status]
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Vehicle Defects - {vehicle.registration}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {vehicle.make} {vehicle.model} ({vehicle.year})
              </p>
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

          {/* Completion Form */}
          {showCompletionForm && selectedDefect && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Complete Defect: {selectedDefect.defect_category}
              </h3>
              <form onSubmit={completeDefect} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Repair Method
                    </label>
                    <input
                      type="text"
                      value={completionForm.repair_method}
                      onChange={(e) => setCompletionForm({ ...completionForm, repair_method: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Describe how the defect was repaired"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parts Used
                    </label>
                    <input
                      type="text"
                      value={completionForm.parts_used}
                      onChange={(e) => setCompletionForm({ ...completionForm, parts_used: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="List parts used in repair"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Labor Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={completionForm.labor_hours}
                      onChange={(e) => setCompletionForm({ ...completionForm, labor_hours: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cost (£)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={completionForm.cost}
                      onChange={(e) => setCompletionForm({ ...completionForm, cost: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Notes
                  </label>
                  <textarea
                    value={completionForm.completion_notes}
                    onChange={(e) => setCompletionForm({ ...completionForm, completion_notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe the completion of the repair..."
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Proof of Rectification
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Choose Files
                      </button>
                      <p className="mt-2 text-sm text-gray-500">
                        Upload photos, invoices, or certificates as proof
                      </p>
                    </div>
                  </div>

                  {/* Selected Files */}
                  {completionFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {completionFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
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
                  )}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompletionForm(false)
                      setSelectedDefect(null)
                      setCompletionForm({
                        completion_notes: '',
                        repair_method: '',
                        parts_used: '',
                        labor_hours: '',
                        cost: ''
                      })
                      setCompletionFiles([])
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {uploading && (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    <span>{uploading ? 'Completing...' : 'Complete Defect'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Defects List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-gray-600">Loading defects...</p>
            </div>
          ) : defects.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No defects found</p>
              <p className="text-sm text-gray-400 mt-1">All defects for this vehicle have been resolved</p>
            </div>
          ) : (
            <div className="space-y-4">
              {defects.map((defect) => (
                <div key={defect.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDefectTypeColor(defect.defect_type)}`}>
                          {defect.defect_type.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(defect.severity_level)}`}>
                          {defect.severity_level.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(defect.status)}`}>
                          {getStatusLabel(defect.status)}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900">{defect.defect_category}</h3>
                      <p className="text-sm text-gray-600 mt-1">{defect.description}</p>
                      {defect.location_on_vehicle && (
                        <p className="text-xs text-gray-500 mt-1">Location: {defect.location_on_vehicle}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Reported: {formatDate(defect.reported_at)}</span>
                        {defect.due_date && (
                          <span>Due: {formatDate(defect.due_date)}</span>
                        )}
                      </div>
                      {defect.notes && (
                        <p className="text-xs text-gray-500 mt-1">Notes: {defect.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {defect.status === 'open' && (
                        <button
                          onClick={() => {
                            setSelectedDefect(defect)
                            setShowCompletionForm(true)
                          }}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Complete
                        </button>
                      )}
                      {defect.status === 'completed' && (
                        <span className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg">
                          ✓ Completed
                        </span>
                      )}
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

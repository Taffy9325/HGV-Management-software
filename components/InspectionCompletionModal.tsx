'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getOrCreateTenantId } from '@/lib/tenant'

interface MaintenanceProvider {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  specializations?: string[]
  is_active: boolean
}

interface InspectionSchedule {
  id: string
  vehicle_id: string
  maintenance_provider_id?: string
  inspection_type: 'safety_inspection' | 'tacho_calibration'
  scheduled_date: string
  frequency_weeks: number
  notes?: string
  is_active: boolean
  created_at: string
  vehicle?: {
    id: string
    registration: string
    make: string
    model: string
    year: number
  }
  maintenance_provider?: MaintenanceProvider
}

interface Defect {
  id?: string
  defect_type: 'major' | 'minor' | 'advisory'
  defect_category: string
  description: string
  location_on_vehicle: string
  severity_level: 'critical' | 'high' | 'medium' | 'low'
  due_date: string
  notes: string
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

interface InspectionCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  inspection: InspectionSchedule
}

export default function InspectionCompletionModal({
  isOpen,
  onClose,
  onSuccess,
  inspection
}: InspectionCompletionModalProps) {
  const [formData, setFormData] = useState({
    inspection_passed: true,
    inspector_name: '',
    inspector_certificate_number: '',
    mileage: '',
    notes: '',
    next_inspection_due: ''
  })
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [defects, setDefects] = useState<Defect[]>([])
  const [existingDefects, setExistingDefects] = useState<VehicleDefect[]>([])
  const [showAddDefect, setShowAddDefect] = useState(false)
  const [newDefect, setNewDefect] = useState<Defect>({
    defect_type: 'minor',
    defect_category: '',
    description: '',
    location_on_vehicle: '',
    severity_level: 'medium',
    due_date: '',
    notes: ''
  })
  const [showPdfExport, setShowPdfExport] = useState(false)
  const [completingDefect, setCompletingDefect] = useState<VehicleDefect | null>(null)
  const [defectCompletionData, setDefectCompletionData] = useState({
    repair_method: '',
    parts_used: '',
    labor_hours: '',
    cost: '',
    notes: ''
  })
  const [defectCompletionFiles, setDefectCompletionFiles] = useState<File[]>([])
  const defectCompletionFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchExistingDefects()
      
      // Auto-populate inspector name with maintenance provider
      if (inspection?.maintenance_provider?.name) {
        setFormData(prev => ({
          ...prev,
          inspector_name: inspection.maintenance_provider.name
        }))
      }
    }
  }, [isOpen, inspection])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const addDefect = () => {
    if (newDefect.description.trim() && newDefect.defect_category.trim()) {
      setDefects(prev => [...prev, { ...newDefect, id: Date.now().toString() }])
      setNewDefect({
        defect_type: 'minor',
        defect_category: '',
        description: '',
        location_on_vehicle: '',
        severity_level: 'medium',
        due_date: '',
        notes: ''
      })
      setShowAddDefect(false)
    }
  }

  const removeDefect = (index: number) => {
    setDefects(prev => prev.filter((_, i) => i !== index))
  }

  const updateDefect = (index: number, updatedDefect: Defect) => {
    setDefects(prev => prev.map((defect, i) => i === index ? updatedDefect : defect))
  }

  const fetchExistingDefects = async () => {
    try {
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) return

      const { data, error } = await supabase
        .from('vehicle_defects')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vehicle_id', inspection.vehicle_id)
        .in('status', ['open', 'in_progress'])
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching existing defects:', error)
        return
      }

      setExistingDefects(data || [])
    } catch (err) {
      console.error('Error fetching existing defects:', err)
    }
  }

  const handleCompleteDefect = (defect: VehicleDefect) => {
    setCompletingDefect(defect)
    setDefectCompletionData({
      repair_method: '',
      parts_used: '',
      labor_hours: '',
      cost: '',
      notes: ''
    })
    setDefectCompletionFiles([])
  }

  const handleDefectCompletionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setDefectCompletionFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeDefectCompletionFile = (index: number) => {
    setDefectCompletionFiles(prev => prev.filter((_, i) => i !== index))
  }

  const submitDefectCompletion = async () => {
    if (!completingDefect) return

    setLoading(true)
    setError(null)

    try {
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
      for (let i = 0; i < defectCompletionFiles.length; i++) {
        const file = defectCompletionFiles[i]
        const filePath = await uploadFile(file, session.user.id)
        uploadedFiles.push(filePath)
      }

      // Create defect completion record
      const { data: completionData, error: completionError } = await supabase
        .from('defect_completions')
        .insert({
          tenant_id: tenantId,
          defect_id: completingDefect.id,
          completed_by: session.user.id,
          repair_method: defectCompletionData.repair_method || null,
          parts_used: defectCompletionData.parts_used || null,
          labor_hours: defectCompletionData.labor_hours ? parseFloat(defectCompletionData.labor_hours) : null,
          cost: defectCompletionData.cost ? parseFloat(defectCompletionData.cost) : null,
          notes: defectCompletionData.notes || null
        })
        .select()
        .single()

      if (completionError) {
        throw completionError
      }

      // Upload documents for this completion
      for (const filePath of uploadedFiles) {
        await supabase
          .from('defect_completion_documents')
          .insert({
            tenant_id: tenantId,
            defect_completion_id: completionData.id,
            document_name: filePath.split('/').pop() || 'document',
            supabase_path: filePath,
            file_type: filePath.split('.').pop() || 'unknown',
            file_size: 0 // We don't track size in this implementation
          })
      }

      // Update defect status to completed
      await supabase
        .from('vehicle_defects')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', completingDefect.id)

      // Refresh existing defects
      await fetchExistingDefects()
      
      setCompletingDefect(null)
      setDefectCompletionData({
        repair_method: '',
        parts_used: '',
        labor_hours: '',
        cost: '',
        notes: ''
      })
      setDefectCompletionFiles([])

    } catch (error) {
      console.error('Error completing defect:', error)
      setError(error instanceof Error ? error.message : 'Failed to complete defect')
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file: File, userId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('inspections')
      .upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    return filePath
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error('User not authenticated')
      }

      const tenantId = await getOrCreateTenantId()
      if (!tenantId) {
        throw new Error('Failed to get tenant ID')
      }

      // Check if inspection passed but has major defects
      if (formData.inspection_passed && defects.some(d => d.defect_type === 'major')) {
        throw new Error('Inspection cannot be marked as passed with major defects. Please mark as failed or remove major defects.')
      }

      // Check if there are any critical defects that would prevent completion
      if (defects.some(d => d.severity_level === 'critical')) {
        throw new Error('Inspection cannot be completed with critical defects. These must be addressed immediately.')
      }

      // Check if there are any existing defects that are not completed
      if (existingDefects.length > 0) {
        throw new Error('Inspection cannot be completed until all existing defects are completed. Please complete all defects first.')
      }

      // Upload files first
      const uploadedFiles: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
        
        try {
          const filePath = await uploadFile(file, session.user.id)
          uploadedFiles.push(filePath)
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
        } catch (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError)
          throw new Error(`Failed to upload ${file.name}`)
        }
      }

      // Create inspection completion record
      const completionData = {
        tenant_id: tenantId,
        inspection_schedule_id: inspection.id,
        vehicle_id: inspection.vehicle_id,
        completed_by: session.user.id,
        inspection_type: inspection.inspection_type,
        inspection_passed: formData.inspection_passed,
        inspector_name: formData.inspector_name || null,
        inspector_certificate_number: formData.inspector_certificate_number || null,
        mileage: formData.mileage ? parseInt(formData.mileage) : null,
        notes: formData.notes || null,
        next_inspection_due: formData.next_inspection_due || null
      }

      const { data: completion, error: completionError } = await supabase
        .from('inspection_completions')
        .insert(completionData)
        .select()
        .single()

      if (completionError) {
        throw completionError
      }

      // Create vehicle document records for uploaded files
      if (uploadedFiles.length > 0) {
        const documentData = uploadedFiles.map(filePath => ({
          tenant_id: tenantId,
          vehicle_id: inspection.vehicle_id,
          document_type: inspection.inspection_type === 'safety_inspection' 
            ? 'safety_inspection_certificate' 
            : 'tacho_calibration_certificate',
          document_name: files[uploadedFiles.indexOf(filePath)].name,
          supabase_path: filePath,
          file_type: files[uploadedFiles.indexOf(filePath)].type,
          file_size: files[uploadedFiles.indexOf(filePath)].size,
          uploaded_by: session.user.id,
          notes: `Uploaded during inspection completion on ${new Date().toLocaleDateString()}`
        }))

        const { error: documentError } = await supabase
          .from('vehicle_documents')
          .insert(documentData)

        if (documentError) {
          throw documentError
        }

        // Create inspection document attachments
        const attachmentData = documentData.map((doc, index) => ({
          tenant_id: tenantId,
          inspection_completion_id: completion.id,
          vehicle_document_id: doc.id || '', // This will be set by the database
          attachment_type: 'certificate'
        }))

        // Get the inserted document IDs
        const { data: insertedDocs } = await supabase
          .from('vehicle_documents')
          .select('id')
          .eq('vehicle_id', inspection.vehicle_id)
          .in('supabase_path', uploadedFiles)
          .order('created_at', { ascending: false })
          .limit(uploadedFiles.length)

        if (insertedDocs) {
          const finalAttachmentData = insertedDocs.map((doc, index) => ({
            tenant_id: tenantId,
            inspection_completion_id: completion.id,
            vehicle_document_id: doc.id,
            attachment_type: 'certificate'
          }))

          const { error: attachmentError } = await supabase
            .from('inspection_document_attachments')
            .insert(finalAttachmentData)

          if (attachmentError) {
            console.error('Error creating attachments:', attachmentError)
            // Don't throw here as the main completion was successful
          }
        }
      }

      // Create defect records if any defects were found
      if (defects.length > 0) {
        const defectData = defects.map(defect => ({
          tenant_id: tenantId,
          vehicle_id: inspection.vehicle_id,
          inspection_completion_id: completion.id,
          defect_type: defect.defect_type,
          defect_category: defect.defect_category,
          description: defect.description,
          location_on_vehicle: defect.location_on_vehicle || null,
          severity_level: defect.severity_level,
          reported_by: session.user.id,
          due_date: defect.due_date || null,
          notes: defect.notes || null,
          status: 'open',
          is_active: true
        }))

        const { error: defectError } = await supabase
          .from('vehicle_defects')
          .insert(defectData)

        if (defectError) {
          throw defectError
        }
      }

      // Update the inspection schedule to mark it as completed
      const nextDate = formData.next_inspection_due 
        ? new Date(formData.next_inspection_due)
        : new Date(Date.now() + (inspection.inspection_type === 'safety_inspection' ? 26 : 8) * 7 * 24 * 60 * 60 * 1000)

      const { error: scheduleError } = await supabase
        .from('inspection_schedules')
        .update({ 
          scheduled_date: nextDate.toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', inspection.id)

      if (scheduleError) {
        console.error('Error updating schedule:', scheduleError)
        // Don't throw here as the main completion was successful
      }

      onSuccess()
      resetForm()
    } catch (err: any) {
      console.error('Error completing inspection:', err)
      setError(err.message || 'Failed to complete inspection')
    } finally {
      setLoading(false)
    }
  }

  const generateInspectionReport = () => {
    const reportData = {
      vehicle: inspection.vehicle,
      inspection: {
        type: inspection.inspection_type,
        scheduledDate: inspection.scheduled_date,
        inspector: formData.inspector_name,
        certificate: formData.inspector_certificate_number,
        mileage: formData.mileage,
        passed: formData.inspection_passed,
        notes: formData.notes,
        nextDue: formData.next_inspection_due
      },
      existingDefects: existingDefects,
      newDefects: defects,
      documents: files.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
    }

    // Create a simple HTML report that can be printed
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Inspection Report - ${reportData.vehicle.registration}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .section { margin-bottom: 30px; }
          .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .defect { background: #f9f9f9; padding: 10px; margin: 10px 0; border-left: 4px solid #007bff; }
          .defect.major { border-left-color: #dc3545; }
          .defect.minor { border-left-color: #ffc107; }
          .defect.advisory { border-left-color: #17a2b8; }
          .critical { color: #dc3545; font-weight: bold; }
          .high { color: #fd7e14; font-weight: bold; }
          .medium { color: #ffc107; font-weight: bold; }
          .low { color: #28a745; font-weight: bold; }
          .document { background: #e9ecef; padding: 5px; margin: 5px 0; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Vehicle Inspection Report</h1>
          <h2>${reportData.vehicle.registration} - ${reportData.vehicle.make} ${reportData.vehicle.model} (${reportData.vehicle.year})</h2>
          <p>Inspection Date: ${new Date(reportData.inspection.scheduledDate).toLocaleDateString()}</p>
        </div>

        <div class="section">
          <h2>Inspection Details</h2>
          <p><strong>Type:</strong> ${reportData.inspection.type.replace('_', ' ').toUpperCase()}</p>
          <p><strong>Inspector:</strong> ${reportData.inspection.inspector || 'Not specified'}</p>
          <p><strong>Certificate:</strong> ${reportData.inspection.certificate || 'Not specified'}</p>
          <p><strong>Mileage:</strong> ${reportData.inspection.mileage || 'Not recorded'}</p>
          <p><strong>Result:</strong> ${reportData.inspection.passed ? 'PASSED' : 'FAILED'}</p>
          <p><strong>Next Due:</strong> ${reportData.inspection.nextDue ? new Date(reportData.inspection.nextDue).toLocaleDateString() : 'Not set'}</p>
          ${reportData.inspection.notes ? `<p><strong>Notes:</strong> ${reportData.inspection.notes}</p>` : ''}
        </div>

        ${reportData.existingDefects.length > 0 ? `
        <div class="section">
          <h2>Existing Defects (${reportData.existingDefects.length})</h2>
          ${reportData.existingDefects.map(defect => `
            <div class="defect ${defect.defect_type}">
              <h3>${defect.defect_category}</h3>
              <p><strong>Type:</strong> ${defect.defect_type.toUpperCase()}</p>
              <p><strong>Severity:</strong> <span class="${defect.severity_level}">${defect.severity_level.toUpperCase()}</span></p>
              <p><strong>Status:</strong> ${defect.status.toUpperCase()}</p>
              <p><strong>Description:</strong> ${defect.description}</p>
              ${defect.location_on_vehicle ? `<p><strong>Location:</strong> ${defect.location_on_vehicle}</p>` : ''}
              ${defect.due_date ? `<p><strong>Due Date:</strong> ${new Date(defect.due_date).toLocaleDateString()}</p>` : ''}
              ${defect.notes ? `<p><strong>Notes:</strong> ${defect.notes}</p>` : ''}
              <p><strong>Reported:</strong> ${new Date(defect.reported_at).toLocaleDateString()}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${reportData.newDefects.length > 0 ? `
        <div class="section">
          <h2>New Defects Found (${reportData.newDefects.length})</h2>
          ${reportData.newDefects.map(defect => `
            <div class="defect ${defect.defect_type}">
              <h3>${defect.defect_category}</h3>
              <p><strong>Type:</strong> ${defect.defect_type.toUpperCase()}</p>
              <p><strong>Severity:</strong> <span class="${defect.severity_level}">${defect.severity_level.toUpperCase()}</span></p>
              <p><strong>Description:</strong> ${defect.description}</p>
              ${defect.location_on_vehicle ? `<p><strong>Location:</strong> ${defect.location_on_vehicle}</p>` : ''}
              ${defect.due_date ? `<p><strong>Due Date:</strong> ${new Date(defect.due_date).toLocaleDateString()}</p>` : ''}
              ${defect.notes ? `<p><strong>Notes:</strong> ${defect.notes}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${reportData.documents.length > 0 ? `
        <div class="section">
          <h2>Inspection Documents (${reportData.documents.length})</h2>
          ${reportData.documents.map(doc => `
            <div class="document">
              <p><strong>${doc.name}</strong> (${(doc.size / 1024 / 1024).toFixed(2)} MB)</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="section">
          <h2>Instructions for Mechanic</h2>
          <p>Please address all defects listed above in order of severity (Critical → High → Medium → Low).</p>
          <p>For each defect completed:</p>
          <ul>
            <li>Record the repair method used</li>
            <li>List any parts replaced</li>
            <li>Note labor hours and cost</li>
            <li>Upload photos of before/after repairs</li>
            <li>Provide completion notes</li>
          </ul>
          <p><strong>Report generated on:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `

    // Open in new window for printing
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      printWindow.focus()
      // Auto-print after a short delay
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }
  }

  const resetForm = () => {
    setFormData({
      inspection_passed: true,
      inspector_name: '',
      inspector_certificate_number: '',
      mileage: '',
      notes: '',
      next_inspection_due: ''
    })
    setFiles([])
    setUploadProgress({})
    setError(null)
    setDefects([])
    setExistingDefects([])
    setShowAddDefect(false)
    setShowPdfExport(false)
    setNewDefect({
      defect_type: 'minor',
      defect_category: '',
      description: '',
      location_on_vehicle: '',
      severity_level: 'medium',
      due_date: '',
      notes: ''
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Complete Inspection - {inspection.vehicle?.registration}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {inspection.inspection_type.replace('_', ' ').toUpperCase()} - {inspection.vehicle?.make} {inspection.vehicle?.model} ({inspection.vehicle?.year})
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          {/* Inspection Result */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inspection Result</h3>
            <div className="flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="inspection_passed"
                  checked={formData.inspection_passed}
                  onChange={() => setFormData({ ...formData, inspection_passed: true })}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                />
                <span className="ml-2 text-sm font-medium text-green-800">Passed</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="inspection_passed"
                  checked={!formData.inspection_passed}
                  onChange={() => setFormData({ ...formData, inspection_passed: false })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <span className="ml-2 text-sm font-medium text-red-800">Failed</span>
              </label>
            </div>
          </div>

          {/* Inspector Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inspector Name
              </label>
              <input
                type="text"
                value={formData.inspector_name}
                onChange={(e) => setFormData({ ...formData, inspector_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter inspector name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Certificate Number
              </label>
              <input
                type="text"
                value={formData.inspector_certificate_number}
                onChange={(e) => setFormData({ ...formData, inspector_certificate_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter certificate number"
              />
            </div>
          </div>

          {/* Mileage and Next Inspection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Mileage
              </label>
              <input
                type="number"
                value={formData.mileage}
                onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter current mileage"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Next Inspection Due
              </label>
              <input
                type="date"
                value={formData.next_inspection_due}
                onChange={(e) => setFormData({ ...formData, next_inspection_due: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Inspection Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter any notes or observations from the inspection..."
            />
          </div>

          {/* Existing Defects */}
          {existingDefects.length > 0 && (
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Existing Defects ({existingDefects.length})</h3>
                <button
                  onClick={generateInspectionReport}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Print Report</span>
                </button>
              </div>
              <div className="space-y-3">
                {existingDefects.map((defect) => (
                  <div key={defect.id} className="bg-white rounded-lg p-4 border border-orange-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            defect.defect_type === 'major' ? 'bg-red-100 text-red-800' :
                            defect.defect_type === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {defect.defect_type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            defect.severity_level === 'critical' ? 'bg-red-100 text-red-800' :
                            defect.severity_level === 'high' ? 'bg-orange-100 text-orange-800' :
                            defect.severity_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {defect.severity_level.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            defect.status === 'open' ? 'bg-red-100 text-red-800' :
                            defect.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {defect.status.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900">{defect.defect_category}</h4>
                        <p className="text-sm text-gray-600 mt-1">{defect.description}</p>
                        {defect.location_on_vehicle && (
                          <p className="text-xs text-gray-500 mt-1">Location: {defect.location_on_vehicle}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>Reported: {new Date(defect.reported_at).toLocaleDateString()}</span>
                          {defect.due_date && (
                            <span>Due: {new Date(defect.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                        {defect.notes && (
                          <p className="text-xs text-gray-500 mt-1">Notes: {defect.notes}</p>
                        )}
                      </div>
                      <div className="ml-4">
                        <button
                          type="button"
                          onClick={() => handleCompleteDefect(defect)}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Defect Completion Modal */}
          {completingDefect && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Complete Defect: {completingDefect.defect_category}
                    </h3>
                    <button
                      onClick={() => setCompletingDefect(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); submitDefectCompletion(); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Repair Method</label>
                        <input
                          type="text"
                          value={defectCompletionData.repair_method}
                          onChange={(e) => setDefectCompletionData({ ...defectCompletionData, repair_method: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="Describe the repair method used"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Parts Used</label>
                        <input
                          type="text"
                          value={defectCompletionData.parts_used}
                          onChange={(e) => setDefectCompletionData({ ...defectCompletionData, parts_used: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="List parts used in repair"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Labor Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          value={defectCompletionData.labor_hours}
                          onChange={(e) => setDefectCompletionData({ ...defectCompletionData, labor_hours: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="0.0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Cost (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={defectCompletionData.cost}
                          onChange={(e) => setDefectCompletionData({ ...defectCompletionData, cost: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        value={defectCompletionData.notes}
                        onChange={(e) => setDefectCompletionData({ ...defectCompletionData, notes: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Additional notes about the repair"
                      />
                    </div>

                    {/* File Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Proof of Completion
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                        <input
                          ref={defectCompletionFileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={handleDefectCompletionFileChange}
                          className="hidden"
                        />
                        <div className="text-center">
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => defectCompletionFileInputRef.current?.click()}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Select Files
                            </button>
                            <p className="mt-2 text-sm text-gray-500">
                              Upload photos, receipts, or other proof of completion
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* File List */}
                      {defectCompletionFiles.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Files:</h4>
                          <div className="space-y-2">
                            {defectCompletionFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                <span className="text-sm text-gray-600">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeDefectCompletionFile(index)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setCompletingDefect(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      >
                        {loading && (
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        <span>{loading ? 'Completing...' : 'Complete Defect'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Defects Found */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Defects Found</h3>
              <div className="flex items-center space-x-2">
                {(existingDefects.length > 0 || defects.length > 0) && (
                  <button
                    type="button"
                    onClick={generateInspectionReport}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Print Report</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddDefect(true)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Defect</span>
                </button>
              </div>
            </div>

            {/* Add Defect Form */}
            {showAddDefect && (
              <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <h4 className="text-md font-medium text-gray-900 mb-3">Add New Defect</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Defect Type *
                    </label>
                    <select
                      value={newDefect.defect_type}
                      onChange={(e) => setNewDefect({ ...newDefect, defect_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="advisory">Advisory</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Severity Level *
                    </label>
                    <select
                      value={newDefect.severity_level}
                      onChange={(e) => setNewDefect({ ...newDefect, severity_level: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <input
                      type="text"
                      value={newDefect.defect_category}
                      onChange={(e) => setNewDefect({ ...newDefect, defect_category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Brakes, Engine, Bodywork"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location on Vehicle
                    </label>
                    <input
                      type="text"
                      value={newDefect.location_on_vehicle}
                      onChange={(e) => setNewDefect({ ...newDefect, location_on_vehicle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Front left wheel, Engine bay"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={newDefect.description}
                    onChange={(e) => setNewDefect({ ...newDefect, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Detailed description of the defect..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newDefect.due_date}
                      onChange={(e) => setNewDefect({ ...newDefect, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={newDefect.notes}
                      onChange={(e) => setNewDefect({ ...newDefect, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAddDefect(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addDefect}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Add Defect
                  </button>
                </div>
              </div>
            )}

            {/* Defects List */}
            {defects.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No defects found</p>
                <p className="text-sm">Click "Add Defect" to record any issues discovered during inspection</p>
              </div>
            ) : (
              <div className="space-y-3">
                {defects.map((defect, index) => (
                  <div key={defect.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            defect.defect_type === 'major' ? 'bg-red-100 text-red-800' :
                            defect.defect_type === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {defect.defect_type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            defect.severity_level === 'critical' ? 'bg-red-100 text-red-800' :
                            defect.severity_level === 'high' ? 'bg-orange-100 text-orange-800' :
                            defect.severity_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {defect.severity_level.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900">{defect.defect_category}</h4>
                        <p className="text-sm text-gray-600 mt-1">{defect.description}</p>
                        {defect.location_on_vehicle && (
                          <p className="text-xs text-gray-500 mt-1">Location: {defect.location_on_vehicle}</p>
                        )}
                        {defect.due_date && (
                          <p className="text-xs text-gray-500 mt-1">Due: {new Date(defect.due_date).toLocaleDateString()}</p>
                        )}
                        {defect.notes && (
                          <p className="text-xs text-gray-500 mt-1">Notes: {defect.notes}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDefect(index)}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warning for major defects */}
            {defects.some(d => d.defect_type === 'major') && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Major Defects Found</h3>
                    <p className="text-sm text-red-700 mt-1">
                      This inspection cannot be marked as passed with major defects. Please mark as failed or remove major defects.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning for critical defects */}
            {defects.some(d => d.severity_level === 'critical') && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Critical Defects Found</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Inspection cannot be completed with critical defects. These must be addressed immediately before the inspection can be finalized.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Inspection Documents
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="mt-4">
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
                    Upload certificates, reports, or photos (PDF, JPG, PNG, DOC, DOCX)
                  </p>
                </div>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Selected Files:</h4>
                {files.map((file, index) => (
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
                    <div className="flex items-center space-x-2">
                      {uploadProgress[file.name] !== undefined && (
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress[file.name]}%` }}
                          />
                        </div>
                      )}
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || defects.some(d => d.severity_level === 'critical') || existingDefects.length > 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>
                {loading ? 'Completing...' : 
                 defects.some(d => d.severity_level === 'critical') ? 'Cannot Complete - Critical Defects' :
                 existingDefects.length > 0 ? 'Cannot Complete - Existing Defects Not Completed' :
                 'Complete Inspection'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

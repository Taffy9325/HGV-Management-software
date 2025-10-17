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
  vehicle?: Vehicle
}

interface DefectCompletion {
  id: string
  defect_id: string
  completed_by: string
  completion_date: string
  repair_method?: string
  parts_used?: string
  labor_hours?: number
  cost?: number
  notes?: string
  created_at: string
}

interface TotalDefectsModalProps {
  isOpen: boolean
  onClose: () => void
  onDefectCompleted?: () => void
}

export default function TotalDefectsModal({
  isOpen,
  onClose,
  onDefectCompleted
}: TotalDefectsModalProps) {
  const [activeTab, setActiveTab] = useState<'open' | 'completed'>('open')
  const [defects, setDefects] = useState<VehicleDefect[]>([])
  const [completedDefects, setCompletedDefects] = useState<VehicleDefect[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completingDefect, setCompletingDefect] = useState<VehicleDefect | null>(null)
  const [defectCompletionData, setDefectCompletionData] = useState({
    repair_method: '',
    parts_used: '',
    labor_hours: '',
    cost: '',
    notes: '',
    completed_by_name: ''
  })
  const [defectCompletionFiles, setDefectCompletionFiles] = useState<File[]>([])
  const defectCompletionFileInputRef = useRef<HTMLInputElement>(null)
  const [viewingDefect, setViewingDefect] = useState<VehicleDefect | null>(null)
  const [defectCompletionDetails, setDefectCompletionDetails] = useState<any>(null)

  useEffect(() => {
    if (isOpen) {
      fetchDefects()
    }
  }, [isOpen, activeTab])

  const fetchDefects = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const tenantId = await getOrCreateTenantId()
      if (!tenantId) return

      if (activeTab === 'open') {
        // Fetch open/in-progress defects
        const { data, error } = await supabase
          .from('vehicle_defects')
          .select(`
            *,
            vehicles!inner (
              id,
              registration,
              make,
              model,
              year
            )
          `)
          .eq('tenant_id', tenantId)
          .in('status', ['open', 'in_progress'])
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        const formattedDefects = (data || []).map(defect => ({
          ...defect,
          vehicle: defect.vehicles
        }))
        console.log('Formatted defects:', formattedDefects)
        setDefects(formattedDefects)
      } else {
        // Fetch completed defects
        const { data, error } = await supabase
          .from('vehicle_defects')
          .select(`
            *,
            vehicles!inner (
              id,
              registration,
              make,
              model,
              year
            )
          `)
          .eq('tenant_id', tenantId)
          .eq('status', 'completed')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })

        if (error) {
          throw error
        }

        const formattedCompletedDefects = (data || []).map(defect => ({
          ...defect,
          vehicle: defect.vehicles
        }))
        console.log('Formatted completed defects:', formattedCompletedDefects)
        setCompletedDefects(formattedCompletedDefects)
      }
    } catch (err: any) {
      console.error('Error fetching defects:', err)
      setError(err.message || 'Failed to load defects')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteDefect = (defect: VehicleDefect) => {
    setCompletingDefect(defect)
    setDefectCompletionData({
      repair_method: '',
      parts_used: '',
      labor_hours: '',
      cost: '',
      notes: '',
      completed_by_name: ''
    })
    setDefectCompletionFiles([])
  }

  const fetchDefectCompletionDetails = async (defectId: string) => {
    try {
      const { data, error } = await supabase
        .from('defect_completions')
        .select(`
          *,
          users!inner (
            id,
            email,
            raw_user_meta_data
          )
        `)
        .eq('defect_id', defectId)
        .single()

      if (error) {
        console.error('Error fetching completion details:', error)
        return null
      }

      return data
    } catch (err) {
      console.error('Error fetching completion details:', err)
      return null
    }
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

  const uploadFile = async (file: File, userId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${userId}/defect-completion-documents/${fileName}`

    const { error } = await supabase.storage
      .from('vehicle-documents')
      .upload(filePath, file)

    if (error) {
      throw error
    }

    return filePath
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
          completed_by_name: defectCompletionData.completed_by_name || null,
          completion_date: new Date().toISOString(),
          repair_method: defectCompletionData.repair_method || null,
          parts_used: defectCompletionData.parts_used || null,
          labor_hours: defectCompletionData.labor_hours ? parseFloat(defectCompletionData.labor_hours) : null,
          cost: defectCompletionData.cost ? parseFloat(defectCompletionData.cost) : null,
          completion_notes: defectCompletionData.notes || null
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
            file_size: 0
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

      // Refresh defects
      await fetchDefects()
      
      setCompletingDefect(null)
      setDefectCompletionData({
        repair_method: '',
        parts_used: '',
        labor_hours: '',
        cost: '',
        notes: '',
        completed_by_name: ''
      })
      setDefectCompletionFiles([])

      // Notify parent component
      if (onDefectCompleted) {
        onDefectCompleted()
      }

    } catch (error) {
      console.error('Error completing defect:', error)
      setError(error instanceof Error ? error.message : 'Failed to complete defect')
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

  const downloadDefectReport = (defect: VehicleDefect) => {
    const reportContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Defect Report - ${defect.defect_category}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 25px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .section h3 {
            margin-top: 0;
            color: #333;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .field {
            margin-bottom: 10px;
        }
        .label {
            font-weight: bold;
            color: #666;
        }
        .value {
            margin-top: 5px;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .badge-major { background-color: #fee; color: #c00; }
        .badge-minor { background-color: #ffc; color: #cc0; }
        .badge-advisory { background-color: #eef; color: #00c; }
        .badge-critical { background-color: #fee; color: #c00; }
        .badge-high { background-color: #fec; color: #c60; }
        .badge-medium { background-color: #ffc; color: #cc0; }
        .badge-low { background-color: #efe; color: #060; }
        .badge-open { background-color: #fee; color: #c00; }
        .badge-in_progress { background-color: #ffc; color: #cc0; }
        .badge-completed { background-color: #efe; color: #060; }
        .badge-closed { background-color: #eee; color: #666; }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Vehicle Defect Report</h1>
        <p>Generated on ${new Date().toLocaleDateString('en-GB')}</p>
    </div>

    <div class="section">
        <h3>Vehicle Information</h3>
        <div class="grid">
            <div class="field">
                <div class="label">Registration:</div>
                <div class="value">${defect.vehicle?.registration || 'N/A'}</div>
            </div>
            <div class="field">
                <div class="label">Make & Model:</div>
                <div class="value">${defect.vehicle?.make || 'N/A'} ${defect.vehicle?.model || 'N/A'}</div>
            </div>
            <div class="field">
                <div class="label">Year:</div>
                <div class="value">${defect.vehicle?.year || 'N/A'}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h3>Defect Information</h3>
        <div class="grid">
            <div class="field">
                <div class="label">Category:</div>
                <div class="value">${defect.defect_category}</div>
            </div>
            <div class="field">
                <div class="label">Type:</div>
                <div class="value">
                    <span class="badge badge-${defect.defect_type}">${defect.defect_type.toUpperCase()}</span>
                </div>
            </div>
            <div class="field">
                <div class="label">Severity:</div>
                <div class="value">
                    <span class="badge badge-${defect.severity_level}">${defect.severity_level.toUpperCase()}</span>
                </div>
            </div>
            <div class="field">
                <div class="label">Status:</div>
                <div class="value">
                    <span class="badge badge-${defect.status}">${defect.status.toUpperCase()}</span>
                </div>
            </div>
        </div>
        <div class="field">
            <div class="label">Description:</div>
            <div class="value">${defect.description}</div>
        </div>
        ${defect.location_on_vehicle ? `
        <div class="field">
            <div class="label">Location:</div>
            <div class="value">${defect.location_on_vehicle}</div>
        </div>
        ` : ''}
        ${defect.notes ? `
        <div class="field">
            <div class="label">Notes:</div>
            <div class="value">${defect.notes}</div>
        </div>
        ` : ''}
    </div>

    <div class="section">
        <h3>Timeline</h3>
        <div class="grid">
            <div class="field">
                <div class="label">Reported Date:</div>
                <div class="value">${formatDate(defect.reported_at)}</div>
            </div>
            ${defect.due_date ? `
            <div class="field">
                <div class="label">Due Date:</div>
                <div class="value">${formatDate(defect.due_date)}</div>
            </div>
            ` : ''}
            <div class="field">
                <div class="label">Last Updated:</div>
                <div class="value">${formatDate(defect.updated_at)}</div>
            </div>
        </div>
    </div>

    ${defect.status === 'completed' ? `
    <div class="section">
        <h3>Completion Information</h3>
        <p>This defect has been completed. Completion details are available in the vehicle maintenance records.</p>
    </div>
    ` : ''}
</body>
</html>
    `

    const blob = new Blob([reportContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `defect-report-${defect.vehicle?.registration || 'unknown'}-${defect.defect_category.replace(/\s+/g, '-').toLowerCase()}-${formatDate(defect.reported_at).replace(/\//g, '-')}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getDefectTypeColor = (type: string) => {
    switch (type) {
      case 'major':
        return 'bg-red-100 text-red-800'
      case 'minor':
        return 'bg-yellow-100 text-yellow-800'
      case 'advisory':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Vehicle Defects</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage all vehicle defects across the fleet
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

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('open')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'open'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Open Defects ({defects.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'completed'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Completed Defects ({completedDefects.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-2 text-gray-600">Loading defects...</span>
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
          ) : (
            <div className="space-y-4">
              {(activeTab === 'open' ? defects : completedDefects).map((defect) => (
                <div key={defect.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {defect.vehicle?.registration} - {defect.vehicle?.make} {defect.vehicle?.model}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDefectTypeColor(defect.defect_type)}`}>
                            {defect.defect_type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(defect.severity_level)}`}>
                            {defect.severity_level.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(defect.status)}`}>
                            {defect.status.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 mt-1">{defect.defect_category}</h4>
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
                    </div>
                    <div className="text-right flex flex-col space-y-2">
                    <button
                      onClick={async () => {
                        setViewingDefect(defect)
                        if (defect.status === 'completed') {
                          const completionDetails = await fetchDefectCompletionDetails(defect.id)
                          setDefectCompletionDetails(completionDetails)
                        }
                      }}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View
                    </button>
                      {activeTab === 'open' && (
                        <button
                          onClick={() => handleCompleteDefect(defect)}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {(activeTab === 'open' ? defects : completedDefects).length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500">
                    {activeTab === 'open' ? 'No open defects found' : 'No completed defects found'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {activeTab === 'open' ? 'All defects have been completed' : 'Complete defects to see them here'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

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
                    <label className="block text-sm font-medium text-gray-700">Completed By</label>
                    <input
                      type="text"
                      value={defectCompletionData.completed_by_name}
                      onChange={(e) => setDefectCompletionData({ ...defectCompletionData, completed_by_name: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Name of person who completed the repair"
                      required
                    />
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

        {/* Defect Viewer Modal */}
        {viewingDefect && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Defect Details: {viewingDefect.defect_category}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      <span>Print</span>
                    </button>
                    <button
                      onClick={() => downloadDefectReport(viewingDefect)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Download</span>
                    </button>
                <button
                  onClick={() => {
                    setViewingDefect(null)
                    setDefectCompletionDetails(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Vehicle Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Registration:</span>
                        <p className="text-sm text-gray-900">{viewingDefect.vehicle?.registration}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Make & Model:</span>
                        <p className="text-sm text-gray-900">{viewingDefect.vehicle?.make} {viewingDefect.vehicle?.model}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Year:</span>
                        <p className="text-sm text-gray-900">{viewingDefect.vehicle?.year}</p>
                      </div>
                    </div>
                  </div>

                  {/* Defect Information */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Defect Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Category:</span>
                        <p className="text-sm text-gray-900">{viewingDefect.defect_category}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Type:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDefectTypeColor(viewingDefect.defect_type)}`}>
                          {viewingDefect.defect_type.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Severity:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(viewingDefect.severity_level)}`}>
                          {viewingDefect.severity_level.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Status:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(viewingDefect.status)}`}>
                          {viewingDefect.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-sm font-medium text-gray-600">Description:</span>
                      <p className="text-sm text-gray-900 mt-1">{viewingDefect.description}</p>
                    </div>
                    {viewingDefect.location_on_vehicle && (
                      <div className="mt-4">
                        <span className="text-sm font-medium text-gray-600">Location:</span>
                        <p className="text-sm text-gray-900 mt-1">{viewingDefect.location_on_vehicle}</p>
                      </div>
                    )}
                    {viewingDefect.notes && (
                      <div className="mt-4">
                        <span className="text-sm font-medium text-gray-600">Notes:</span>
                        <p className="text-sm text-gray-900 mt-1">{viewingDefect.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Dates and Timeline */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Reported Date:</span>
                        <p className="text-sm text-gray-900">{formatDate(viewingDefect.reported_at)}</p>
                      </div>
                      {viewingDefect.due_date && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">Due Date:</span>
                          <p className="text-sm text-gray-900">{formatDate(viewingDefect.due_date)}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-gray-600">Last Updated:</span>
                        <p className="text-sm text-gray-900">{formatDate(viewingDefect.updated_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Completion Information (if completed) */}
                  {viewingDefect.status === 'completed' && defectCompletionDetails && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-green-900 mb-3">Completion Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-green-700">Completed By:</span>
                          <p className="text-sm text-green-800">{defectCompletionDetails.completed_by_name || defectCompletionDetails.users?.raw_user_meta_data?.display_name || defectCompletionDetails.users?.email || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-green-700">Completion Date:</span>
                          <p className="text-sm text-green-800">{formatDate(defectCompletionDetails.completion_date)}</p>
                        </div>
                        {defectCompletionDetails.repair_method && (
                          <div>
                            <span className="text-sm font-medium text-green-700">Repair Method:</span>
                            <p className="text-sm text-green-800">{defectCompletionDetails.repair_method}</p>
                          </div>
                        )}
                        {defectCompletionDetails.parts_used && (
                          <div>
                            <span className="text-sm font-medium text-green-700">Parts Used:</span>
                            <p className="text-sm text-green-800">{defectCompletionDetails.parts_used}</p>
                          </div>
                        )}
                        {defectCompletionDetails.labor_hours && (
                          <div>
                            <span className="text-sm font-medium text-green-700">Labor Hours:</span>
                            <p className="text-sm text-green-800">{defectCompletionDetails.labor_hours}</p>
                          </div>
                        )}
                        {defectCompletionDetails.cost && (
                          <div>
                            <span className="text-sm font-medium text-green-700">Cost:</span>
                            <p className="text-sm text-green-800">£{defectCompletionDetails.cost}</p>
                          </div>
                        )}
                      </div>
                      {defectCompletionDetails.completion_notes && (
                        <div className="mt-3">
                          <span className="text-sm font-medium text-green-700">Notes:</span>
                          <p className="text-sm text-green-800">{defectCompletionDetails.completion_notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

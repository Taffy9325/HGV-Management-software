'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getOrCreateTenantId } from '@/lib/tenant'

interface Vehicle {
  id: string
  registration: string
  make: string
  model: string
  year: number
}

interface MaintenanceProvider {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string
  address: string
  is_active: boolean
}

interface TachoCalibrationUploadFormProps {
  vehicles: Vehicle[]
  maintenanceProviders: MaintenanceProvider[]
  onSuccess: () => void
}

export default function TachoCalibrationUploadForm({
  vehicles,
  maintenanceProviders,
  onSuccess
}: TachoCalibrationUploadFormProps) {
  const [formData, setFormData] = useState({
    vehicle_id: '',
    maintenance_provider_id: '',
    calibration_date: '',
    expiry_date: '',
    notes: ''
  })
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFile = async (file: File, userId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${userId}/tacho-calibrations/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('vehicle-documents')
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

      if (!formData.vehicle_id || !formData.maintenance_provider_id || !formData.calibration_date || !formData.expiry_date) {
        throw new Error('Please fill in all required fields')
      }

      if (files.length === 0) {
        throw new Error('Please upload at least one certificate')
      }

      // Upload files first
      const uploadedFiles: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const filePath = await uploadFile(file, session.user.id)
          uploadedFiles.push(filePath)
        } catch (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError)
          throw new Error(`Failed to upload ${file.name}`)
        }
      }

      // Create tacho calibration record
      const calibrationData = {
        tenant_id: tenantId,
        vehicle_id: formData.vehicle_id,
        maintenance_provider_id: formData.maintenance_provider_id,
        calibration_date: formData.calibration_date,
        expiry_date: formData.expiry_date,
        notes: formData.notes || null,
        uploaded_by: session.user.id,
        is_active: true
      }

      const { data: calibration, error: calibrationError } = await supabase
        .from('tacho_calibrations')
        .insert(calibrationData)
        .select()
        .single()

      if (calibrationError) {
        throw calibrationError
      }

      // Create document records for uploaded files
      const documentData = uploadedFiles.map((filePath, index) => ({
        tenant_id: tenantId,
        tacho_calibration_id: calibration.id,
        document_name: files[index].name,
        supabase_path: filePath,
        file_type: files[index].type,
        file_size: files[index].size,
        document_type: 'tacho_calibration_certificate',
        uploaded_by: session.user.id,
        notes: `Tacho calibration certificate uploaded on ${new Date().toLocaleDateString()}`
      }))

      const { error: documentError } = await supabase
        .from('tacho_calibration_documents')
        .insert(documentData)

      if (documentError) {
        throw documentError
      }

      // Update vehicle's tacho expiry date
      const { error: vehicleUpdateError } = await supabase
        .from('vehicles')
        .update({ 
          tacho_expiry_date: formData.expiry_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', formData.vehicle_id)

      if (vehicleUpdateError) {
        console.error('Error updating vehicle tacho expiry:', vehicleUpdateError)
        // Don't throw here as the main upload was successful
      }

      // Reset form
      setFormData({
        vehicle_id: '',
        maintenance_provider_id: '',
        calibration_date: '',
        expiry_date: '',
        notes: ''
      })
      setFiles([])
      onSuccess()
    } catch (err: any) {
      console.error('Error uploading tacho calibration:', err)
      setError(err.message || 'Failed to upload tacho calibration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vehicle Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vehicle *
          </label>
          <select
            value={formData.vehicle_id}
            onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select a vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration} - {vehicle.make} {vehicle.model} ({vehicle.year})
              </option>
            ))}
          </select>
        </div>

        {/* Maintenance Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maintenance Provider *
          </label>
          <select
            value={formData.maintenance_provider_id}
            onChange={(e) => setFormData({ ...formData, maintenance_provider_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select a provider</option>
            {maintenanceProviders.filter(provider => provider.is_active).map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calibration Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Calibration Date *
          </label>
          <input
            type="date"
            value={formData.calibration_date}
            onChange={(e) => setFormData({ ...formData, calibration_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiry Date *
          </label>
          <input
            type="date"
            value={formData.expiry_date}
            onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            This will automatically update the vehicle's tacho expiry date
          </p>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Additional notes about the tacho calibration..."
        />
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Tacho Calibration Certificates *
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
              Upload tacho calibration certificates (PDF, images, or documents)
            </p>
          </div>
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
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

      {/* Submit Button */}
      <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {loading && (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          <span>{loading ? 'Uploading...' : 'Upload Tacho Calibration'}</span>
        </button>
      </div>
    </form>
  )
}

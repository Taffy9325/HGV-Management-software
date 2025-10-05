import { supabase } from './supabase'
import { DVSAWalkaround, DefectReport, SafetyInspection } from './schemas'

// Supabase Storage Configuration
const INSPECTION_BUCKET = 'inspections'

export interface UploadResult {
  path: string
  signedUrl: string
  fileSize: number
}

/**
 * Upload inspection document to Supabase Storage
 */
export async function uploadInspectionFile(
  file: File,
  inspectionId: string,
  inspectionType: 'walkaround' | 'defect' | 'pmi',
  userId: string,
  vehicleId: string
): Promise<UploadResult> {
  const timestamp = new Date().toISOString()
  const fileExt = file.name.split('.').pop()
  const fileName = `${timestamp}.${fileExt}`
  
  const path = `${userId}/${vehicleId}/${inspectionId}/${fileName}`
  
  // Upload file to Supabase Storage
  const { data, error } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })
    
  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }
  
  // Store metadata in database
  const { error: dbError } = await supabase
    .from('inspection_documents')
    .insert({
      inspection_id: inspectionId,
      inspection_type: inspectionType,
      supabase_path: data.path,
      file_type: file.type,
      file_size: file.size
    })
    
  if (dbError) {
    // Clean up uploaded file if database insert fails
    await supabase.storage.from(INSPECTION_BUCKET).remove([data.path])
    throw new Error(`Database insert failed: ${dbError.message}`)
  }
  
  // Generate signed URL for immediate access
  const signedUrl = await getSignedUrl(data.path, 3600)
  
  return {
    path: data.path,
    signedUrl,
    fileSize: file.size
  }
}

/**
 * Generate signed URL for document access
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .createSignedUrl(path, expiresIn)
    
  if (error) {
    throw new Error(`Signed URL generation failed: ${error.message}`)
  }
  
  return data.signedUrl
}

/**
 * Delete inspection document
 */
export async function deleteInspectionFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .remove([path])
    
  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
  
  // Remove database record
  await supabase
    .from('inspection_documents')
    .delete()
    .eq('supabase_path', path)
}

/**
 * Get inspection documents for a specific inspection
 */
export async function getInspectionDocuments(inspectionId: string) {
  const { data, error } = await supabase
    .from('inspection_documents')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('uploaded_at', { ascending: false })
    
  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`)
  }
  
  return data
}

/**
 * Generate PDF from inspection data and upload to Supabase
 */
export async function generateAndUploadInspectionPDF(
  inspectionData: DVSAWalkaround | DefectReport | SafetyInspection,
  inspectionType: 'walkaround' | 'defect' | 'pmi',
  userId: string,
  vehicleId: string
): Promise<UploadResult> {
  // This would typically be done server-side
  // For now, we'll simulate PDF generation
  const pdfBlob = await generatePDFFromData(inspectionData, inspectionType)
  
  const timestamp = new Date().toISOString()
  const fileName = `${inspectionType}_${timestamp}.pdf`
  const path = `${userId}/${vehicleId}/${inspectionData.id || 'temp'}/${fileName}`
  
  const { data, error } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .upload(path, pdfBlob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'application/pdf'
    })
    
  if (error) {
    throw new Error(`PDF upload failed: ${error.message}`)
  }
  
  // Store metadata
  await supabase
    .from('inspection_documents')
    .insert({
      inspection_id: inspectionData.id || 'temp',
      inspection_type: inspectionType,
      supabase_path: data.path,
      file_type: 'application/pdf',
      file_size: pdfBlob.size
    })
  
  const signedUrl = await getSignedUrl(data.path, 3600)
  
  return {
    path: data.path,
    signedUrl,
    fileSize: pdfBlob.size
  }
}

/**
 * Simulate PDF generation (replace with actual PDF library)
 */
async function generatePDFFromData(
  data: DVSAWalkaround | DefectReport | SafetyInspection,
  type: string
): Promise<Blob> {
  // This is a placeholder - in production you'd use a PDF library like jsPDF
  const content = JSON.stringify(data, null, 2)
  return new Blob([content], { type: 'application/pdf' })
}

/**
 * Batch upload multiple files
 */
export async function batchUploadFiles(
  files: File[],
  inspectionId: string,
  inspectionType: 'walkaround' | 'defect' | 'pmi',
  userId: string,
  vehicleId: string
): Promise<UploadResult[]> {
  const uploadPromises = files.map(file => 
    uploadInspectionFile(file, inspectionId, inspectionType, userId, vehicleId)
  )
  
  return Promise.all(uploadPromises)
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(userId: string): Promise<{
  totalFiles: number
  totalSize: number
  filesByType: Record<string, number>
}> {
  const { data, error } = await supabase
    .from('inspection_documents')
    .select('file_type, file_size')
    .like('supabase_path', `${userId}/%`)
    
  if (error) {
    throw new Error(`Failed to fetch storage stats: ${error.message}`)
  }
  
  const stats = {
    totalFiles: data.length,
    totalSize: data.reduce((sum, file) => sum + (file.file_size || 0), 0),
    filesByType: data.reduce((acc, file) => {
      const type = file.file_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
  
  return stats
}


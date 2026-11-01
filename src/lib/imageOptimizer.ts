import { getSupabaseClient, isSupabaseConfigured } from './supabase'
import { db } from '../db'

export interface ImageOptimizationResult {
  url: string
  isRemote: boolean
  width: number
  height: number
  originalSize: number
  compressedSize: number
  format: 'image/webp' | 'image/jpeg' | 'image/png'
}

export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

const BUCKET_NAME = 'attachments'

/**
 * Convierte un Blob en una DataURL (Base64)
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Convierte una DataURL (Base64) a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
  const binary = atob(parts[1])
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

/**
 * Calcula un hash rápido SHA-256 del archivo para deduplicación
 */
export async function computeImageHash(blob: Blob): Promise<string> {
  try {
    const buffer = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Fallback simple si subtle crypto no está disponible
    return 'img_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
  }
}

/**
 * Carga un archivo o blob en un objeto de imagen HTML
 */
function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl)
      reject(e)
    }
    img.src = objectUrl
  })
}

/**
 * Comprime y redimensiona una imagen en el navegador usando Canvas nativo.
 * Convierte automáticamente a formato WebP optimizado con calidad 0.75-0.80.
 * Ahorro de espacio típico: 85% a 95% respecto a fotos originales de smartphone o capturas.
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  options: CompressOptions = {}
): Promise<{
  blob: Blob
  dataUrl: string
  width: number
  height: number
  originalSize: number
  compressedSize: number
  format: 'image/webp' | 'image/jpeg' | 'image/png'
}> {
  const maxWidth = options.maxWidth || 1600
  const maxHeight = options.maxHeight || 1600
  const quality = options.quality ?? 0.78
  const originalSize = fileOrBlob.size

  // Si es un SVG, no se debe rasterizar ni redimensionar
  if (fileOrBlob.type === 'image/svg+xml') {
    const dataUrl = await blobToDataUrl(fileOrBlob)
    return {
      blob: fileOrBlob,
      dataUrl,
      width: 0,
      height: 0,
      originalSize,
      compressedSize: originalSize,
      format: 'image/png'
    }
  }

  const img = await loadImageElement(fileOrBlob)
  let { naturalWidth: width, naturalHeight: height } = img

  // Calcular nuevas dimensiones conservando la relación de aspecto
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del Canvas')
  }

  // Máxima nitidez en el remuestreo
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  // Intentar exportar en WebP
  let outputFormat: 'image/webp' | 'image/jpeg' | 'image/png' = 'image/webp'
  let compressedBlob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', quality)
  })

  // Si el navegador no soporta WebP en toBlob, fallback a JPEG
  if (!compressedBlob || compressedBlob.type !== 'image/webp') {
    outputFormat = 'image/jpeg'
    compressedBlob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
  }

  if (!compressedBlob) {
    throw new Error('Fallo al comprimir la imagen')
  }

  // Si la imagen original ya era diminuta y el resultado comprimido fuera mayor, conservar original
  let finalBlob = compressedBlob
  if (originalSize > 0 && compressedBlob.size > originalSize) {
    finalBlob = fileOrBlob
  }

  const dataUrl = await blobToDataUrl(finalBlob)

  return {
    blob: finalBlob,
    dataUrl,
    width,
    height,
    originalSize,
    compressedSize: finalBlob.size,
    format: outputFormat
  }
}

/**
 * Sube un blob al bucket de Supabase Storage ('attachments').
 * Retorna la URL pública si tiene éxito, o null si falla.
 */
export async function uploadToSupabaseStorage(blob: Blob, path: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, blob, {
        contentType: blob.type || 'image/webp',
        upsert: true
      })

    if (error) {
      // Si el bucket aún no existía, intentar crearlo automáticamente
      if (
        error.message?.toLowerCase().includes('not found') ||
        error.message?.toLowerCase().includes('bucket')
      ) {
        try {
          await supabase.storage.createBucket(BUCKET_NAME, { public: true })
          const retry = await supabase.storage.from(BUCKET_NAME).upload(path, blob, {
            contentType: blob.type || 'image/webp',
            upsert: true
          })
          if (!retry.error && retry.data) {
            const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(retry.data.path)
            return pubData?.publicUrl || null
          }
        } catch (e) {
          console.warn('No se pudo crear automáticamente el bucket attachments:', e)
        }
      }
      console.warn('Error subiendo imagen a Supabase Storage:', error.message)
      return null
    }

    if (data?.path) {
      const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path)
      return pubData?.publicUrl || null
    }

    return null
  } catch (err) {
    console.warn('Excepción al subir imagen a Supabase Storage:', err)
    return null
  }
}

/**
 * Procesa completamente una imagen:
 * 1. La comprime en WebP (~100 KB en lugar de ~4-5 MB).
 * 2. Si Supabase está conectado, la sube al bucket 'attachments' con deduplicación por hash.
 * 3. Si no hay internet o falla, retorna la DataURL comprimida en WebP (que ocupa mínimo espacio).
 */
export async function processAndUploadImage(
  fileOrBlob: File | Blob,
  options: CompressOptions = {}
): Promise<ImageOptimizationResult> {
  const { blob, dataUrl, width, height, originalSize, compressedSize, format } = await compressImage(
    fileOrBlob,
    options
  )

  // Si Supabase está configurado, intentar subir al Storage
  if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const hash = await computeImageHash(blob)
      const ext = format === 'image/webp' ? 'webp' : 'jpg'
      const filePath = `images/${hash.slice(0, 20)}.${ext}`

      const remoteUrl = await uploadToSupabaseStorage(blob, filePath)
      if (remoteUrl) {
        return {
          url: remoteUrl,
          isRemote: true,
          width,
          height,
          originalSize,
          compressedSize,
          format
        }
      }
    } catch (e) {
      console.warn('Fallback a almacenamiento local comprimido', e)
    }
  }

  // Fallback local: DataURL de WebP comprimido
  return {
    url: dataUrl,
    isRemote: false,
    width,
    height,
    originalSize,
    compressedSize,
    format
  }
}

/**
 * Elimina una imagen de Supabase Storage si la URL pertenece a nuestro bucket
 */
export async function deleteImageFromStorage(imageUrl: string | null | undefined): Promise<boolean> {
  if (!imageUrl || typeof imageUrl !== 'string') return false
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) return false

  const supabase = getSupabaseClient()
  if (!supabase) return false

  try {
    const bucketToken = `/storage/v1/object/public/${BUCKET_NAME}/`
    if (!imageUrl.includes(bucketToken)) {
      return false
    }

    const pathWithQuery = imageUrl.split(bucketToken)[1]
    if (!pathWithQuery) return false

    const cleanPath = decodeURIComponent(pathWithQuery.split('?')[0])
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([cleanPath])

    if (error) {
      console.warn('Error eliminando archivo de Supabase Storage:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('Excepción al eliminar imagen de Supabase Storage:', err)
    return false
  }
}

/**
 * Extrae URLs de Supabase Storage contenidas en el HTML de un documento
 */
export function extractStorageUrlsFromHtml(html: string): string[] {
  if (!html) return []
  const urls: string[] = []
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
  let match: RegExpExecArray | null

  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1]
    if (url && url.includes(`/storage/v1/object/public/${BUCKET_NAME}/`)) {
      urls.push(url)
    }
  }

  return urls
}

/**
 * Formatea bytes a una cadena legible (ej. "145 KB", "3.2 MB")
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Analiza todas las fotos existentes en IndexedDB y comprime
 * las que aún estén en Base64 pesado, subiéndolas a Supabase Storage si está activo.
 */
export async function optimizeExistingLocalImages(): Promise<{
  processedCount: number
  totalOriginalBytes: number
  totalCompressedBytes: number
}> {
  const nodes = await db.canvasNodes.where('type').equals('image').toArray()
  let processedCount = 0
  let totalOriginalBytes = 0
  let totalCompressedBytes = 0

  for (const node of nodes) {
    const rawUrl = node.data?.imageUrl
    // Optimizamos si es un DataURL en base64 pesado (mayor a 40 KB)
    if (typeof rawUrl === 'string' && rawUrl.startsWith('data:image/') && rawUrl.length > 40000) {
      try {
        const blob = dataUrlToBlob(rawUrl)
        const originalBytes = blob.size
        const result = await processAndUploadImage(blob)

        await db.canvasNodes.update(node.id, {
          data: {
            ...node.data,
            imageUrl: result.url
          },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })

        processedCount++
        totalOriginalBytes += originalBytes
        totalCompressedBytes += result.compressedSize
      } catch (err) {
        console.warn('Error optimizando nodo existente:', node.id, err)
      }
    }
  }

  return {
    processedCount,
    totalOriginalBytes,
    totalCompressedBytes
  }
}

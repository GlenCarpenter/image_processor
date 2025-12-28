/**
 * Image metadata utilities
 */

export interface ExifData {
  camera?: Record<string, any>
  settings?: Record<string, any>
  datetime?: Record<string, any>
  image?: Record<string, any>
  location?: Record<string, any>
  other?: Record<string, any>
}

export interface ImageMetadata {
  width: number
  height: number
  size: number
  type: string
  exif?: ExifData
  prompt?: string
  generationParams?: Record<string, any>
  imageInfo?: Record<string, any>
}

/**
 * Extract metadata from an image file
 * @param file - The image file to extract metadata from
 * @param url - The object URL of the image (optional, will be created if not provided)
 * @returns Promise that resolves with the image metadata
 */
export const extractImageMetadata = (file: File, url?: string): Promise<ImageMetadata> => {
  return new Promise((resolve, reject) => {
    const imageUrl = url || URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      // Clean up if we created the URL
      if (!url) {
        URL.revokeObjectURL(imageUrl)
      }

      resolve({
        width: img.width,
        height: img.height,
        size: file.size,
        type: file.type,
      })
    }

    img.onerror = () => {
      // Clean up if we created the URL
      if (!url) {
        URL.revokeObjectURL(imageUrl)
      }
      reject(new Error('Failed to load image'))
    }

    img.src = imageUrl
  })
}

/**
 * Format file size to human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.23 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format image type to readable string
 * @param mimeType - MIME type (e.g., "image/jpeg")
 * @returns Formatted type (e.g., "JPEG")
 */
export const formatImageType = (mimeType: string): string => {
  return mimeType.replace('image/', '').toUpperCase()
}

/**
 * Format EXIF value for display
 * @param key - EXIF tag name
 * @param value - EXIF value
 * @returns Formatted string
 */
export const formatExifValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return 'N/A'

  // Handle specific tags with special formatting
  if (key === 'ExposureTime' && typeof value === 'number') {
    return value >= 1 ? `${value}s` : `1/${Math.round(1 / value)}s`
  }

  if (key === 'FNumber' && typeof value === 'number') {
    return `f/${value.toFixed(1)}`
  }

  if (key === 'FocalLength' && typeof value === 'number') {
    return `${value.toFixed(1)}mm`
  }

  if ((key === 'ISOSpeedRatings' || key === 'ISO') && typeof value === 'number') {
    return `ISO ${value}`
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  // Handle objects (like GPS data)
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

/**
 * Format EXIF tag name for display
 * @param key - EXIF tag name
 * @returns Human-readable label
 */
export const formatExifLabel = (key: string): string => {
  // Common tag name mappings
  const labelMap: Record<string, string> = {
    Make: 'Camera Make',
    Model: 'Camera Model',
    LensMake: 'Lens Make',
    LensModel: 'Lens Model',
    ExposureTime: 'Shutter Speed',
    FNumber: 'Aperture',
    ISOSpeedRatings: 'ISO',
    ISO: 'ISO',
    FocalLength: 'Focal Length',
    DateTime: 'Date/Time',
    DateTimeOriginal: 'Date Taken',
    DateTimeDigitized: 'Date Digitized',
    ExposureProgram: 'Exposure Program',
    MeteringMode: 'Metering Mode',
    Flash: 'Flash',
    WhiteBalance: 'White Balance',
    ExposureMode: 'Exposure Mode',
    Software: 'Software',
    Artist: 'Artist',
    Copyright: 'Copyright',
    AIPrompt: 'AI Generation Prompt',
  }

  return labelMap[key] || key
}

/**
 * Fetch EXIF data from backend for an output image
 * @param filename - Output filename
 * @param apiBaseUrl - API base URL
 * @returns Promise with EXIF data or null
 */
export const fetchExifData = async (
  filename: string,
  apiBaseUrl: string
): Promise<ExifData | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/images/output/${filename}/exif`)
    if (!response.ok) return null

    const data = await response.json()
    return data.has_exif ? data.exif : null
  } catch (error) {
    console.error('Failed to fetch EXIF data:', error)
    return null
  }
}

/**
 * Fetch AI prompt from backend for an output image
 * @param filename - Output filename
 * @param apiBaseUrl - API base URL
 * @returns Promise with prompt string or null
 */
export const fetchPrompt = async (filename: string, apiBaseUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/images/output/${filename}/exif`)
    if (!response.ok) return null

    const data = await response.json()
    return data.has_prompt ? data.prompt : null
  } catch (error) {
    console.error('Failed to fetch prompt:', error)
    return null
  }
}

/**
 * Fetch generation parameters from backend for an output image
 * @param filename - Output filename
 * @param apiBaseUrl - API base URL
 * @returns Promise with generation parameters object or null
 */
export const fetchGenerationParams = async (
  filename: string,
  apiBaseUrl: string
): Promise<Record<string, any> | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/images/output/${filename}/exif`)
    if (!response.ok) return null

    const data = await response.json()
    return data.has_generation_params ? data.generation_params : null
  } catch (error) {
    console.error('Failed to fetch generation params:', error)
    return null
  }
}

/**
 * Fetch image info metadata from backend for an output image
 * @param filename - Output filename
 * @param apiBaseUrl - API base URL
 * @returns Promise with image info object or null
 */
export const fetchImageInfo = async (
  filename: string,
  apiBaseUrl: string
): Promise<Record<string, any> | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/images/output/${filename}/exif`)
    if (!response.ok) return null

    const data = await response.json()
    return data.has_image_info ? data.image_info : null
  } catch (error) {
    console.error('Failed to fetch image info:', error)
    return null
  }
}


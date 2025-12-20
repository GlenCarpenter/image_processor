/**
 * Image metadata utilities
 */

export interface ImageMetadata {
  width: number
  height: number
  size: number
  type: string
}

/**
 * Extract metadata from an image file
 * @param file - The image file to extract metadata from
 * @param url - The object URL of the image (optional, will be created if not provided)
 * @returns Promise that resolves with the image metadata
 */
export const extractImageMetadata = (
  file: File,
  url?: string
): Promise<ImageMetadata> => {
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

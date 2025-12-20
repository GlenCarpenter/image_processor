import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useImageStore } from '@/store/imageStore'
import { extractImageMetadata, type ImageMetadata } from '@/lib/imageUtils'
import { ImageMetadataDisplay } from '@/components/ImageMetadataDisplay'

export const Route = createFileRoute('/upscale')({
  component: RouteComponent,
})

const API_BASE_URL = 'http://localhost:8000/api'

function RouteComponent() {
  const navigate = useNavigate()

  // Get state from Zustand store
  const upscaleImage = useImageStore((state) => state.upscaleImage)
  const setUpscaleOriginal = useImageStore((state) => state.setUpscaleOriginal)
  const setUpscaleResult = useImageStore((state) => state.setUpscaleResult)
  const sendUpscaleToEdit = useImageStore((state) => state.sendUpscaleToEdit)

  // Local state for UI only
  const [isUpscaling, setIsUpscaling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalMetadata, setOriginalMetadata] = useState<ImageMetadata | null>(null)
  const [resultMetadata, setResultMetadata] = useState<ImageMetadata | null>(null)

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      const url = URL.createObjectURL(file)
      setUpscaleOriginal(file, url)
      setUpscaleResult(null, null, null)
      setError(null)
      setResultMetadata(null)

      // Extract image metadata
      extractImageMetadata(file, url)
        .then(setOriginalMetadata)
        .catch((err) => {
          console.error('Failed to extract image metadata:', err)
          setOriginalMetadata(null)
        })
    }
  }

  const handleUpscale = async () => {
    if (!upscaleImage.originalFile) {
      setError('Please select an image first')
      return
    }

    setIsUpscaling(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', upscaleImage.originalFile)
      formData.append('upscale_mode', 'factor')
      formData.append('upscale_factor', '2.0')
      formData.append('output_format', 'jpg')

      const response = await fetch(`${API_BASE_URL}/upscale/upscale`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || 'Failed to upscale image')
      }

      // Parse JSON response
      const data = await response.json()

      if (!data.success) {
        throw new Error('Failed to upscale image')
      }

      // Set upscale result in store with job ID and filename
      const info = {
        outputWidth: data.info.output_width,
        outputHeight: data.info.output_height,
        outputPixels: data.info.output_pixels,
        fileSize: data.info.file_size,
        upscaleMode: data.info.upscale_mode,
        upscaleFactor: data.info.upscale_factor,
      }

      setUpscaleResult(data.job_id, data.output_filename, info)

      // Extract metadata from upscaled image
      const imageUrl = `${API_BASE_URL}/images/output/${data.output_filename}`
      const response2 = await fetch(imageUrl)
      const blob = await response2.blob()
      const file = new File([blob], data.output_filename, { type: blob.type })

      extractImageMetadata(file, imageUrl)
        .then(setResultMetadata)
        .catch((err) => {
          console.error('Failed to extract result metadata:', err)
          setResultMetadata(null)
        })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsUpscaling(false)
    }
  }

  const handleDownload = () => {
    if (!upscaleImage.outputFilename) return

    const link = document.createElement('a')
    link.href = `${API_BASE_URL}/images/output/${upscaleImage.outputFilename}/download`
    link.download = upscaleImage.outputFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleEditClick = () => {
    sendUpscaleToEdit()
    navigate({ to: '/edit' })
  }

  const formatNumber = (num: string | number | null | undefined) => {
    if (!num) return 'N/A'
    const numValue = typeof num === 'string' ? parseInt(num) : num
    return numValue.toLocaleString()
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-4xl font-bold mb-8">Image Upscaler</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Image</CardTitle>
            <CardDescription>Select an image to upscale using AI (2x upscaling)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Image File</Label>
              <Dropzone
                accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff'] }}
                src={upscaleImage.originalFile ? [upscaleImage.originalFile] : undefined}
                onDrop={handleFileDrop}
                className="mt-2"
              >
                <DropzoneEmptyState />
                <DropzoneContent />
              </Dropzone>
            </div>

            {upscaleImage.originalUrl && (
              <>
                <div>
                  <Label>Original Image Preview</Label>
                  <img
                    src={upscaleImage.originalUrl}
                    alt="Original"
                    className="mt-2 max-h-64 w-full object-contain rounded-md border"
                  />
                </div>

                {originalMetadata && <ImageMetadataDisplay metadata={originalMetadata} />}
              </>
            )}

            <Button
              onClick={handleUpscale}
              disabled={!upscaleImage.originalFile || isUpscaling}
              className="w-full"
              size="lg"
            >
              {isUpscaling ? 'Upscaling...' : 'Upscale Image (2x)'}
            </Button>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upscaled Image</CardTitle>
            <CardDescription>Your upscaled image will appear here</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upscaleImage.outputFilename ? (
              <>
                <div>
                  <img
                    src={`${API_BASE_URL}/images/output/${upscaleImage.outputFilename}`}
                    alt="Upscaled"
                    className="w-full rounded-md border"
                  />
                </div>

                {resultMetadata && <ImageMetadataDisplay metadata={resultMetadata} />}

                {upscaleImage.upscaleInfo && (
                  <div className="space-y-2 text-sm">
                    <h3 className="font-semibold">Upscale Information</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Dimensions:</span>
                        <p className="font-medium">
                          {upscaleImage.upscaleInfo.outputWidth} ×{' '}
                          {upscaleImage.upscaleInfo.outputHeight}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(upscaleImage.upscaleInfo.outputPixels)} pixels
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Upscale Factor:</span>
                        <p className="font-medium">{upscaleImage.upscaleInfo.upscaleFactor}x</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleDownload} variant="outline" className="flex-1">
                    Download Upscaled Image
                  </Button>
                  <Button className="flex-1" onClick={handleEditClick}>
                    Edit Image
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>No upscaled image yet. Upload an image to see results.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

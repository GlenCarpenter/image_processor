import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useImageStore } from '@/store/imageStore'
import { extractImageMetadata, fetchExifData, fetchPrompt, fetchImageInfo } from '@/lib/imageUtils'
import { ImageMetadataDisplay } from '@/components/image-metadata-display'
import { OutputCard } from '@/components/output-card'
import { API_BASE_URL } from '@/lib/constants'

type UpscaleSearch = {
  filename?: string
}

export const Route = createFileRoute('/upscale')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): UpscaleSearch => {
    return {
      filename: search.filename as string | undefined,
    }
  },
})

function RouteComponent() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  // Get state from Zustand store
  const upscaleImage = useImageStore((state) => state.upscaleImage)
  const setUpscaleOriginal = useImageStore((state) => state.setUpscaleOriginal)
  const setUpscaleResult = useImageStore((state) => state.setUpscaleResult)
  const setUpscaleUpscaling = useImageStore((state) => state.setUpscaleUpscaling)
  const setUpscaleError = useImageStore((state) => state.setUpscaleError)
  const setUpscaleOriginalMetadata = useImageStore((state) => state.setUpscaleOriginalMetadata)
  const setUpscaleResultMetadata = useImageStore((state) => state.setUpscaleResultMetadata)
  const sendToUpscale = useImageStore((state) => state.sendToUpscale)
  const sendToResize = useImageStore((state) => state.sendToResize)
  const sendToSegment = useImageStore((state) => state.sendToSegment)
  const sendToEdit = useImageStore((state) => state.sendToEdit)

  // Load image from URL query param on mount
  useEffect(() => {
    if (search.filename && !upscaleImage.originalFile) {
      const imageUrl = `${API_BASE_URL}/images/output/${search.filename}`

      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], search.filename!, { type: blob.type })
          setUpscaleOriginal(file)

          extractImageMetadata(file, imageUrl)
            .then(async (metadata) => {
              // Fetch EXIF data, prompt, and image info for the output image
              const exifData = await fetchExifData(search.filename!, API_BASE_URL)
              const prompt = await fetchPrompt(search.filename!, API_BASE_URL)
              const imageInfo = await fetchImageInfo(search.filename!, API_BASE_URL)
              setUpscaleOriginalMetadata({
                ...metadata,
                exif: exifData || undefined,
                prompt: prompt || undefined,
                imageInfo: imageInfo || undefined,
              })
            })
            .catch((err) => console.error('Failed to extract metadata:', err))
        })
        .catch((err) => {
          console.error('Failed to load image:', err)
          setUpscaleError('Failed to load image from URL')
        })
    }
  }, [search.filename, upscaleImage.originalFile])

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setUpscaleOriginal(file)
      setUpscaleResult(null, null, null)
      setUpscaleError(null)
      setUpscaleResultMetadata(null)

      // Extract image metadata
      const url = URL.createObjectURL(file)
      extractImageMetadata(file, url)
        .then(async (metadata) => {
          // Upload file temporarily to extract EXIF data and prompt
          const formData = new FormData()
          formData.append('file', file)

          try {
            const response = await fetch(`${API_BASE_URL}/images/upload-temp`, {
              method: 'POST',
              body: formData,
            })

            if (response.ok) {
              const data = await response.json()
              setUpscaleOriginalMetadata({
                ...metadata,
                exif: data.has_exif ? data.exif : undefined,
                prompt: data.has_prompt ? data.prompt : undefined,
                imageInfo: data.has_image_info ? data.image_info : undefined,
              })
              return
            }
          } catch (err) {
            console.error('Failed to fetch EXIF/prompt data:', err)
          }

          // If EXIF/prompt fetch fails, set metadata without them
          setUpscaleOriginalMetadata(metadata)
        })
        .catch((err) => {
          console.error('Failed to extract image metadata:', err)
          setUpscaleOriginalMetadata(null)
        })
    }
  }

  const handleUpscale = async () => {
    if (!upscaleImage.originalFile) {
      setUpscaleError('Please select an image first')
      return
    }

    setUpscaleUpscaling(true)
    setUpscaleError(null)

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
        .then(setUpscaleResultMetadata)
        .catch((err) => {
          console.error('Failed to extract result metadata:', err)
          setUpscaleResultMetadata(null)
        })
    } catch (err) {
      setUpscaleError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setUpscaleUpscaling(false)
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

  const handleUpscaleAgain = () => {
    if (!upscaleImage.outputFilename) return
    sendToUpscale()
    navigate({ to: '/upscale', search: { filename: upscaleImage.outputFilename } })
  }

  const handleResizeClick = () => {
    if (!upscaleImage.outputFilename) return
    sendToResize()
    navigate({ to: '/resize-image', search: { filename: upscaleImage.outputFilename } })
  }

  const handleSegmentClick = () => {
    if (!upscaleImage.outputFilename) return
    sendToSegment()
    navigate({ to: '/segment', search: { filename: upscaleImage.outputFilename } })
  }

  const handleEditClick = () => {
    if (!upscaleImage.outputFilename) return
    sendToEdit()
    navigate({ to: '/edit', search: { filename: upscaleImage.outputFilename } })
  }

  const formatNumber = (num: string | number | null | undefined) => {
    if (!num) return 'N/A'
    const numValue = typeof num === 'string' ? parseInt(num) : num
    return numValue.toLocaleString()
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
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

            {upscaleImage.originalFile && (
              <div>
                <Label>Original Image Preview</Label>
                <img
                  src={URL.createObjectURL(upscaleImage.originalFile)}
                  alt="Original"
                  className="mt-2 max-h-64 w-full object-contain rounded-md border"
                />
              </div>
            )}

            <Button
              onClick={handleUpscale}
              disabled={!upscaleImage.originalFile || upscaleImage.isUpscaling}
              className="w-full"
              size="lg"
            >
              {upscaleImage.isUpscaling ? 'Upscaling...' : 'Upscale Image (2x)'}
            </Button>

            {upscaleImage.originalMetadata && (
              <ImageMetadataDisplay metadata={upscaleImage.originalMetadata} />
            )}

            {upscaleImage.error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {upscaleImage.error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Output Section */}
        <OutputCard
          title="Upscaled Image"
          description="Your upscaled image will appear here"
          outputFilename={upscaleImage.outputFilename}
          downloadButtonText="Download Upscaled Image"
          emptyStateText="No upscaled image yet. Upload an image to see results."
          onUpscale={handleUpscaleAgain}
          onResize={handleResizeClick}
          onSegment={handleSegmentClick}
          onEdit={handleEditClick}
          onDownload={handleDownload}
          additionalInfo={
            <>
              {upscaleImage.resultMetadata && (
                <ImageMetadataDisplay metadata={upscaleImage.resultMetadata} />
              )}

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
            </>
          }
        />
      </div>
    </div>
  )
}

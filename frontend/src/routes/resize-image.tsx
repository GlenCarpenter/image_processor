import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useImageStore } from '@/store/imageStore'
import { extractImageMetadata, type ImageMetadata } from '@/lib/imageUtils'
import { ImageMetadataDisplay } from '@/components/ImageMetadataDisplay'
import { OutputCard } from '@/components/OutputCard'
import { API_BASE_URL } from '@/lib/constants'

type ResizeSearch = {
  filename?: string
}

export const Route = createFileRoute('/resize-image')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): ResizeSearch => {
    return {
      filename: search.filename as string | undefined,
    }
  },
})

function RouteComponent() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  // Get state from Zustand store
  const resizeImage = useImageStore((state) => state.resizeImage)
  const setResizeOriginal = useImageStore((state) => state.setResizeOriginal)
  const setResizeResult = useImageStore((state) => state.setResizeResult)
  const sendResizeToUpscale = useImageStore((state) => state.sendResizeToUpscale)
  const sendResizeToSegment = useImageStore((state) => state.sendResizeToSegment)

  // Local state for UI only
  const [targetSize, setTargetSize] = useState<number>(1024)
  const [isResizing, setIsResizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalMetadata, setOriginalMetadata] = useState<ImageMetadata | null>(null)

  // Load image from URL query param on mount
  useEffect(() => {
    if (search.filename && !resizeImage.originalFile) {
      const imageUrl = `${API_BASE_URL}/images/output/${search.filename}`

      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], search.filename!, { type: blob.type })
          setResizeOriginal(file, imageUrl)

          extractImageMetadata(file, imageUrl)
            .then(setOriginalMetadata)
            .catch((err) => console.error('Failed to extract metadata:', err))
        })
        .catch((err) => {
          console.error('Failed to load image:', err)
          setError('Failed to load image from URL')
        })
    }
  }, [search.filename, resizeImage.originalFile])

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      const url = URL.createObjectURL(file)
      setResizeOriginal(file, url)
      setResizeResult(null, null, null)
      setError(null)

      // Extract image metadata
      extractImageMetadata(file, url)
        .then(setOriginalMetadata)
        .catch((err) => {
          console.error('Failed to extract image metadata:', err)
          setOriginalMetadata(null)
        })
    }
  }

  const handleResize = async () => {
    if (!resizeImage.originalFile) {
      setError('Please select an image first')
      return
    }

    if (targetSize <= 0) {
      setError('Target size must be greater than 0')
      return
    }

    setIsResizing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', resizeImage.originalFile)
      formData.append('size', targetSize.toString())

      const response = await fetch(`${API_BASE_URL}/images/resize`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || 'Failed to resize image')
      }

      // Parse JSON response
      const data = await response.json()

      if (!data.success) {
        throw new Error('Failed to resize image')
      }

      // Set resize result in store with job ID and filename
      const info = {
        originalWidth: data.info.original_size.width,
        originalHeight: data.info.original_size.height,
        targetWidth: data.info.target_size.width,
        targetHeight: data.info.target_size.height,
        aspectRatio: data.info.ratio_name,
        originalPixels: data.info.original_pixels,
        actualPixels: data.info.actual_pixels,
      }

      setResizeResult(data.job_id, data.output_filename, info)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsResizing(false)
    }
  }

  const handleDownload = () => {
    if (!resizeImage.outputFilename) return

    const link = document.createElement('a')
    link.href = `${API_BASE_URL}/images/output/${resizeImage.outputFilename}/download`
    link.download = resizeImage.outputFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleUpscaleClick = () => {
    if (!resizeImage.outputFilename) return
    sendResizeToUpscale()
    navigate({ to: '/upscale', search: { filename: resizeImage.outputFilename } })
  }

  const handleResizeAgain = () => {
    if (!resizeImage.outputFilename) return
    // Set the resized image as the new original
    const imageUrl = `${API_BASE_URL}/images/output/${resizeImage.outputFilename}`
    fetch(imageUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], resizeImage.outputFilename!, { type: blob.type })
        setResizeOriginal(file, imageUrl)
        setResizeResult(null, null, null)
        extractImageMetadata(file, imageUrl)
          .then(setOriginalMetadata)
          .catch((err) => console.error('Failed to extract metadata:', err))
      })
      .catch((err) => console.error('Failed to load image:', err))
  }

  const handleSegmentClick = () => {
    if (!resizeImage.outputFilename) return
    sendResizeToSegment()
    navigate({ to: '/segment', search: { filename: resizeImage.outputFilename } })
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
            <CardTitle>Upload & Configure</CardTitle>
            <CardDescription>
              Select an image and set the target size in pixels (size²)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Image File</Label>
              <Dropzone
                accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff'] }}
                src={resizeImage.originalFile ? [resizeImage.originalFile] : undefined}
                onDrop={handleFileDrop}
                className="mt-2"
              >
                <DropzoneEmptyState />
                <DropzoneContent />
              </Dropzone>
            </div>

            <div>
              <Label htmlFor="targetSize">Target Size (pixels = size²)</Label>
              <Input
                id="targetSize"
                type="number"
                value={targetSize}
                onChange={(e) => setTargetSize(parseInt(e.target.value) || 0)}
                placeholder="1024"
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {targetSize > 0
                  ? `${targetSize}² = ${(targetSize * targetSize).toLocaleString()} pixels`
                  : ''}
              </p>
            </div>

            {resizeImage.originalUrl && (
              <>
                <div>
                  <Label>Original Image Preview</Label>
                  <img
                    src={resizeImage.originalUrl}
                    alt="Original"
                    className="mt-2 max-h-64 w-full object-contain rounded-md border"
                  />
                </div>

                {originalMetadata && <ImageMetadataDisplay metadata={originalMetadata} />}
              </>
            )}

            <Button
              onClick={handleResize}
              disabled={!resizeImage.originalFile || isResizing}
              className="w-full"
              size="lg"
            >
              {isResizing ? 'Resizing...' : 'Resize Image'}
            </Button>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Output Section */}
        <OutputCard
          title="Resized Image"
          description="Your resized image will appear here"
          outputFilename={resizeImage.outputFilename}
          downloadButtonText="Download Resized Image"
          emptyStateText="No resized image yet. Upload and resize an image to see results."
          onUpscale={handleUpscaleClick}
          onResize={handleResizeAgain}
          onSegment={handleSegmentClick}
          onDownload={handleDownload}
          additionalInfo={
            resizeImage.resizeInfo && (
              <div className="space-y-2 text-sm">
                <h3 className="font-semibold">Resize Information</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Original:</span>
                    <p className="font-medium">
                      {resizeImage.resizeInfo.originalWidth} ×{' '}
                      {resizeImage.resizeInfo.originalHeight}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(resizeImage.resizeInfo.originalPixels)} pixels
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Resized:</span>
                    <p className="font-medium">
                      {resizeImage.resizeInfo.targetWidth} ×{' '}
                      {resizeImage.resizeInfo.targetHeight}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(resizeImage.resizeInfo.actualPixels)} pixels
                    </p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Aspect Ratio:</span>
                  <p className="font-medium">{resizeImage.resizeInfo.aspectRatio}</p>
                </div>
              </div>
            )
          }
        />
      </div>
    </div>
  )
}

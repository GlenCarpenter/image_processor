import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useImageStore } from '@/store/imageStore'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/resize-image')({
  component: RouteComponent,
})

const API_BASE_URL = 'http://localhost:8000/api'

function RouteComponent() {
  // Get state from Zustand store
  const selectedFile = useImageStore((state) => state.selectedFile)
  const originalImageUrl = useImageStore((state) => state.originalImageUrl)
  const resizedImageUrl = useImageStore((state) => state.resizedImageUrl)
  const resizeInfo = useImageStore((state) => state.resizeInfo)

  // Get actions from store
  const setSelectedFile = useImageStore((state) => state.setSelectedFile)
  const setOriginalImageUrl = useImageStore((state) => state.setOriginalImageUrl)
  const setResizedImageUrl = useImageStore((state) => state.setResizedImageUrl)
  const setResizeInfo = useImageStore((state) => state.setResizeInfo)

  // Local state for UI only
  const [targetSize, setTargetSize] = useState<number>(1024)
  const [isResizing, setIsResizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setSelectedFile(file)
      setError(null)
      setResizedImageUrl(null)
      setResizeInfo(null)

      // Create preview URL for original image
      const url = URL.createObjectURL(file)
      setOriginalImageUrl(url)
    }
  }

  const handleResize = async () => {
    if (!selectedFile) {
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
      formData.append('file', selectedFile)
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
      console.log(data)

      // Set resize info from response
      setResizeInfo({
        originalWidth: data.info.original_size.width,
        originalHeight: data.info.original_size.height,
        targetWidth: data.info.target_size.width,
        targetHeight: data.info.target_size.height,
        aspectRatio: data.info.ratio_name,
        originalPixels: data.info.original_pixels,
        actualPixels: data.info.actual_pixels,
      })

      // Clean up old URL if exists
      if (resizedImageUrl) {
        URL.revokeObjectURL(resizedImageUrl)
      }

      // Set the base64 image directly
      setResizedImageUrl(data.image)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsResizing(false)
    }
  }

  const handleDownload = () => {
    if (!resizedImageUrl) return

    const link = document.createElement('a')
    link.href = resizedImageUrl
    link.download = `resized_${selectedFile?.name || 'image.jpg'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatNumber = (num: string | number | null | undefined) => {
    if (!num) return 'N/A'
    const numValue = typeof num === 'string' ? parseInt(num) : num
    return numValue.toLocaleString()
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-4xl font-bold mb-8">Image Resizer</h1>

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
                src={selectedFile ? [selectedFile] : undefined}
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

            {originalImageUrl && (
              <div>
                <Label>Original Image Preview</Label>
                <img
                  src={originalImageUrl}
                  alt="Original"
                  className="mt-2 max-h-64 w-full object-contain rounded-md border"
                />
              </div>
            )}

            <Button
              onClick={handleResize}
              disabled={!selectedFile || isResizing}
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
        <Card>
          <CardHeader>
            <CardTitle>Resized Image</CardTitle>
            <CardDescription>Your resized image will appear here</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resizedImageUrl ? (
              <>
                <div>
                  <img src={resizedImageUrl} alt="Resized" className="w-full rounded-md border" />
                </div>
                {resizeInfo && console.log(resizeInfo)}

                {resizeInfo && (
                  <div className="space-y-2 text-sm">
                    <h3 className="font-semibold">Resize Information</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Original:</span>
                        <p className="font-medium">
                          {resizeInfo.originalWidth} × {resizeInfo.originalHeight}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(resizeInfo.originalPixels)} pixels
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resized:</span>
                        <p className="font-medium">
                          {resizeInfo.targetWidth} × {resizeInfo.targetHeight}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(resizeInfo.actualPixels)} pixels
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Aspect Ratio:</span>
                      <p className="font-medium">{resizeInfo.aspectRatio}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleDownload} variant="outline" className="flex-1">
                    Download Resized Image
                  </Button>
                  <Link to="/edit" className="flex-1">
                    <Button className="w-full">Edit Image</Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>No resized image yet. Upload and resize an image to see results.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

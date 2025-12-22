import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useImageStore } from '@/store/imageStore'
import { Edit, ArrowUpCircle, Expand, Scissors } from 'lucide-react'
import { extractImageMetadata, type ImageMetadata } from '@/lib/imageUtils'
import { ImageMetadataDisplay } from '@/components/image-metadata-display'
import { API_BASE_URL } from '@/lib/constants'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const homeImage = useImageStore((state) => state.homeImage)
  const setHomeImage = useImageStore((state) => state.setHomeImage)
  const sendToResize = useImageStore((state) => state.sendToResize)
  const sendToEdit = useImageStore((state) => state.sendToEdit)
  const sendToUpscale = useImageStore((state) => state.sendToUpscale)
  const sendToSegment = useImageStore((state) => state.sendToSegment)

  const [metadata, setMetadata] = useState<ImageMetadata | null>(null)

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      const url = URL.createObjectURL(file)
      setHomeImage(file, url)

      // Extract image metadata
      extractImageMetadata(file, url)
        .then(async (metadata) => {
          // Upload file temporarily to extract EXIF data, prompt, and image info
          const formData = new FormData()
          formData.append('file', file)

          try {
            const response = await fetch(`${API_BASE_URL}/images/upload-temp`, {
              method: 'POST',
              body: formData,
            })

            if (response.ok) {
              const data = await response.json()
              setMetadata({
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
          setMetadata(metadata)
        })
        .catch((err) => {
          console.error('Failed to extract image metadata:', err)
          setMetadata(null)
        })
    }
  }

  const handleResizeClick = () => {
    sendToResize()
    navigate({ to: '/resize-image' })
  }

  const handleEditClick = () => {
    sendToEdit()
    navigate({ to: '/edit' })
  }

  const handleUpscaleClick = () => {
    sendToUpscale()
    navigate({ to: '/upscale' })
  }

  const handleSegmentClick = () => {
    sendToSegment()
    navigate({ to: '/segment' })
  }

  console.log('Home Image:', homeImage)

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Upload an Image to Start</CardTitle>
          <CardDescription>
            Select or drag and drop an image file to begin working with it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dropzone
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff'] }}
            src={homeImage.file ? [homeImage.file] : undefined}
            onDrop={handleFileDrop}
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>

          {homeImage.url && (
            <>
              <div>
                <img
                  src={homeImage.url}
                  alt="Uploaded"
                  className="w-full max-h-96 object-contain rounded-md border"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">What would you like to do?</p>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={handleResizeClick}
                  >
                    <Expand className="mr-2 h-4 w-4" />
                    Resize
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={handleUpscaleClick}
                  >
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    Upscale
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={handleSegmentClick}
                  >
                    <Scissors className="mr-2 h-4 w-4" />
                    Segment
                  </Button>
                  <Button variant="outline" className="w-full" size="lg" onClick={handleEditClick}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Image
                  </Button>
                </div>
              </div>

              {metadata && <ImageMetadataDisplay metadata={metadata} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

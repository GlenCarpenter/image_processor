import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useImageStore } from '@/store/imageStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'

const API_BASE_URL = 'http://localhost:8000/api'

type EditSearch = {
  filename?: string
}

export const Route = createFileRoute('/edit')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): EditSearch => {
    return {
      filename: search.filename as string | undefined,
    }
  },
})

function RouteComponent() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const editImage = useImageStore((state) => state.editImage)
  const setEditImage = useImageStore((state) => state.setEditImage)
  const clearEditImage = useImageStore((state) => state.clearEditImage)
  const sendEditToUpscale = useImageStore((state) => state.sendEditToUpscale)
  const setUpscaleOriginal = useImageStore((state) => state.setUpscaleOriginal)
  const [isLoading, setIsLoading] = useState(false)

  // Load image from URL query param on mount
  useEffect(() => {
    if (search.filename && search.filename !== editImage.outputFilename) {
      setEditImage(null, search.filename, null)
    }
  }, [search.filename])

  const handleUpscaleClick = async () => {
    if (!editImage.outputFilename) return

    setIsLoading(true)
    try {
      // Fetch the image from the server
      const imageUrl = `${API_BASE_URL}/images/output/${editImage.outputFilename}`
      const response = await fetch(imageUrl)
      const blob = await response.blob()

      // Create a File object from the blob
      const file = new File([blob], editImage.outputFilename, { type: blob.type })
      const url = URL.createObjectURL(blob)

      // Set it as the upscale original
      setUpscaleOriginal(file, url)

      // Navigate to upscale page
      navigate({ to: '/upscale', search: { filename: editImage.outputFilename } })
    } catch (error) {
      console.error('Failed to load image for upscaling:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!editImage.outputFilename) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>No Image to Edit</CardTitle>
            <CardDescription>
              Please upload an image from the home page or resize page first
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link to="/">
              <Button>Go to Home</Button>
            </Link>
            <Link to="/resize-image">
              <Button variant="outline">Go to Resize</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Your Image</CardTitle>
          <CardDescription>
            Image persisted from previous page - edit functionality coming soon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <img
              src={`${API_BASE_URL}/images/output/${editImage.outputFilename}`}
              alt="Edit"
              className="w-full rounded-md border"
            />
          </div>

          {editImage.info && (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Image Information</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Dimensions:</span>
                  <p className="font-medium">
                    {editImage.info.targetWidth} × {editImage.info.targetHeight}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Aspect Ratio:</span>
                  <p className="font-medium">{editImage.info.aspectRatio}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
            <Link to="/resize-image">
              <Button variant="outline">Back to Resize</Button>
            </Link>
            <Button onClick={handleUpscaleClick} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Upscale Image'}
            </Button>
            <Button variant="destructive" onClick={clearEditImage}>
              Clear Image
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

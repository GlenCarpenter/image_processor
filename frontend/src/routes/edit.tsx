import { createFileRoute, Link } from '@tanstack/react-router'
import { useImageStore } from '@/store/imageStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/edit')({
  component: RouteComponent,
})

function RouteComponent() {
  const resizedImageUrl = useImageStore((state) => state.resizedImageUrl)
  const resizeInfo = useImageStore((state) => state.resizeInfo)
  const clearImages = useImageStore((state) => state.clearImages)

  if (!resizedImageUrl) {
    return (
      <div className="container mx-auto p-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>No Image to Edit</CardTitle>
            <CardDescription>Please resize an image first</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/resize-image">
              <Button>Go to Resize Page</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Edit Image</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your Resized Image</CardTitle>
          <CardDescription>
            Image persisted from resize page - edit functionality coming soon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <img src={resizedImageUrl} alt="Resized" className="w-full rounded-md border" />
          </div>

          {resizeInfo && (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Image Information</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Dimensions:</span>
                  <p className="font-medium">
                    {resizeInfo.targetWidth} × {resizeInfo.targetHeight}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Aspect Ratio:</span>
                  <p className="font-medium">{resizeInfo.aspectRatio}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Link to="/resize-image">
              <Button variant="outline">Back to Resize</Button>
            </Link>
            <Button variant="destructive" onClick={clearImages}>
              Clear Image
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

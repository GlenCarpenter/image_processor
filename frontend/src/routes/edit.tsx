import { createFileRoute, Link } from '@tanstack/react-router'
import { useImageStore } from '@/store/imageStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/edit')({
  component: RouteComponent,
})

function RouteComponent() {
  const editImage = useImageStore((state) => state.editImage)
  const clearEditImage = useImageStore((state) => state.clearEditImage)

  if (!editImage.url) {
    return (
      <div className="container mx-auto p-8 max-w-4xl">
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
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Edit Image</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your Image</CardTitle>
          <CardDescription>
            Image persisted from previous page - edit functionality coming soon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <img src={editImage.url} alt="Edit" className="w-full rounded-md border" />
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
            <Button variant="destructive" onClick={clearEditImage}>
              Clear Image
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

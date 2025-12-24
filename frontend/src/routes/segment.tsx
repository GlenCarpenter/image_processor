import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useEffect } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Scissors, Trash2, Undo, Sparkles } from 'lucide-react'
import { useImageStore } from '@/store/imageStore'
import { InputCard } from '@/components/input-card'
import { OutputCard } from '@/components/output-card'
import { API_BASE_URL, ASPECT_RATIOS } from '@/lib/constants'

type SegmentSearch = {
  filename?: string
}

export const Route = createFileRoute('/segment')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): SegmentSearch => {
    return {
      filename: search.filename as string | undefined,
    }
  },
})

interface Point {
  x: number
  y: number
  label: number // 1 = foreground, 0 = background
}

interface BoundingBox {
  x1: number
  y1: number
  x2: number
  y2: number
}

function RouteComponent() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  // Get state from Zustand store
  const segmentImage = useImageStore((state) => state.segmentImage)
  const setSegmentOriginal = useImageStore((state) => state.setSegmentOriginal)
  const setSegmentResult = useImageStore((state) => state.setSegmentResult)
  const setSegmentPoints = useImageStore((state) => state.setSegmentPoints)
  const setSegmentBoxes = useImageStore((state) => state.setSegmentBoxes)
  const setSegmentMask = useImageStore((state) => state.setSegmentMask)
  const setSegmentCropPadding = useImageStore((state) => state.setSegmentCropPadding)
  const setSegmentMaskPadding = useImageStore((state) => state.setSegmentMaskPadding)
  const setSegmentAspectRatio = useImageStore((state) => state.setSegmentAspectRatio)
  const setSegmentSessionEnded = useImageStore((state) => state.setSegmentSessionEnded)
  const setSegmentUploading = useImageStore((state) => state.setSegmentUploading)
  const setSegmentPredicting = useImageStore((state) => state.setSegmentPredicting)
  const setSegmentCropping = useImageStore((state) => state.setSegmentCropping)
  const setSegmentError = useImageStore((state) => state.setSegmentError)
  const sendToUpscale = useImageStore((state) => state.sendToUpscale)
  const sendToResize = useImageStore((state) => state.sendToResize)
  const sendToSegment = useImageStore((state) => state.sendToSegment)
  const sendToEdit = useImageStore((state) => state.sendToEdit)
  const sendToFill = useImageStore((state) => state.sendToFill)

  // Local refs only (not persisted)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const lastLoadedFilename = useRef<string | null>(null)
  const isDragging = useRef(false)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const currentBox = useRef<BoundingBox | null>(null)

  // Load image from URL query param on mount
  useEffect(() => {
    if (search.filename && search.filename !== lastLoadedFilename.current) {
      // Clear store state FIRST (synchronously)
      setSegmentResult(null)

      const imageUrl = `${API_BASE_URL}/images/output/${search.filename}`

      // Reset UI state for new image
      setSegmentPoints([])
      setSegmentBoxes([])
      setSegmentMask(null)
      setSegmentSessionEnded(false)
      setSegmentError(null)
      setSegmentUploading(true)
      setSegmentResult(null)

      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], search.filename!, { type: blob.type })
          setSegmentOriginal(file)
          lastLoadedFilename.current = search.filename!
        })
        .catch((err) => {
          console.error('Failed to load image:', err)
          setSegmentError('Failed to load image from URL')
        })
        .finally(() => {
          setSegmentUploading(false)
        })
    }
  }, [search.filename])

  // No upload step needed - file is used directly with predict/crop
  useEffect(() => {
    // This effect is no longer needed
  }, [search.filename, segmentImage.originalFile])

  // No cleanup needed - no temp files
  useEffect(() => {
    return () => {
      // No session cleanup needed
    }
  }, [])

  useEffect(() => {
    const imageUrl = segmentImage.originalFile
      ? URL.createObjectURL(segmentImage.originalFile)
      : search.filename
        ? `${API_BASE_URL}/images/output/${search.filename}`
        : null

    if (imageUrl && canvasRef.current && imageRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const img = imageRef.current

      const redrawCanvas = () => {
        if (!ctx) return

        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw mask if available
        if (segmentImage.maskDataUrl) {
          const maskImg = new Image()
          maskImg.onload = () => {
            ctx.globalAlpha = 0.5
            ctx.drawImage(maskImg, 0, 0)
            ctx.globalAlpha = 1.0
            drawPoints(ctx, img)
          }
          maskImg.src = segmentImage.maskDataUrl
        } else {
          drawPoints(ctx, img)
        }
      }

      if (img.complete) {
        redrawCanvas()
      } else {
        img.onload = redrawCanvas
      }
    }
  }, [
    segmentImage.originalFile,
    segmentImage.points,
    segmentImage.maskDataUrl,
    search.filename,
    currentBox.current,
  ])

  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', preventContextMenu)

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [])

  const drawPoints = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Calculate scale to keep dots consistent size in screen pixels
    const displayScale = img.naturalWidth / canvas.clientWidth
    const dotRadius = 8 * displayScale // 8 pixels on screen
    const strokeWidth = 2 * displayScale // 2 pixels on screen

    segmentImage.points.forEach((point) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, dotRadius, 0, 2 * Math.PI)
      ctx.fillStyle = point.label === 1 ? '#00ff00' : '#ff0000'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = strokeWidth
      ctx.stroke()
    })

    // Draw current bounding box if dragging
    if (currentBox.current) {
      const box = currentBox.current
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 3 * displayScale
      ctx.setLineDash([10 * displayScale, 5 * displayScale])
      ctx.strokeRect(
        Math.min(box.x1, box.x2),
        Math.min(box.y1, box.y2),
        Math.abs(box.x2 - box.x1),
        Math.abs(box.y2 - box.y1)
      )
      ctx.setLineDash([])
    }
  }

  const handleFileDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setSegmentOriginal(file)
      setSegmentPoints([])
      setSegmentBoxes([])
      setSegmentMask(null)
      setSegmentResult(null)
      setSegmentSessionEnded(false)
      setSegmentError(null)
    }
  }

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return null

    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth
    const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight
    return { x, y }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageRef.current || !segmentImage.originalFile) return

    const coords = getCanvasCoordinates(e)
    if (!coords) return

    // Start dragging for bounding box
    isDragging.current = true
    dragStartPos.current = coords
    currentBox.current = { x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !dragStartPos.current) return

    const coords = getCanvasCoordinates(e)
    if (!coords) return

    // Update bounding box
    currentBox.current = {
      x1: dragStartPos.current.x,
      y1: dragStartPos.current.y,
      x2: coords.x,
      y2: coords.y,
    }

    // Force redraw
    const canvas = canvasRef.current
    const img = imageRef.current
    if (canvas && img) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (segmentImage.maskDataUrl) {
          const maskImg = new Image()
          maskImg.onload = () => {
            ctx.globalAlpha = 0.5
            ctx.drawImage(maskImg, 0, 0)
            ctx.globalAlpha = 1.0
            drawPoints(ctx, img)
          }
          maskImg.src = segmentImage.maskDataUrl
        } else {
          drawPoints(ctx, img)
        }
      }
    }
  }

  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !dragStartPos.current || !currentBox.current) return

    const coords = getCanvasCoordinates(e)
    if (!coords) return

    isDragging.current = false

    // Check if this was a drag or just a click
    const dx = Math.abs(coords.x - dragStartPos.current.x)
    const dy = Math.abs(coords.y - dragStartPos.current.y)
    const minDragDistance = 5 // pixels in natural coordinates

    if (dx < minDragDistance && dy < minDragDistance) {
      // This was a click, not a drag - add point
      const label = e.button === 2 ? 0 : 1
      const newPoint: Point = { x: coords.x, y: coords.y, label }
      const newPoints = [...segmentImage.points, newPoint]
      setSegmentPoints(newPoints)
      await predictMask(newPoints)
    } else {
      // This was a drag - use bounding box
      const box = currentBox.current
      await predictMaskFromBox(box)
    }

    // Clear drag state
    dragStartPos.current = null
    currentBox.current = null

    // Force redraw to clear the box
    const canvas = canvasRef.current
    const img = imageRef.current
    if (canvas && img) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (segmentImage.maskDataUrl) {
          const maskImg = new Image()
          maskImg.onload = () => {
            ctx.globalAlpha = 0.5
            ctx.drawImage(maskImg, 0, 0)
            ctx.globalAlpha = 1.0
            drawPoints(ctx, img)
          }
          maskImg.src = segmentImage.maskDataUrl
        } else {
          drawPoints(ctx, img)
        }
      }
    }
  }

  const predictMask = async (pointsList: Point[]) => {
    if (!segmentImage.originalFile || pointsList.length === 0) return

    console.log('Predicting mask with points:', pointsList)

    setSegmentPredicting(true)
    setSegmentError(null)

    try {
      const formData = new FormData()
      formData.append('file', segmentImage.originalFile)
      formData.append('points', JSON.stringify(pointsList.map((p) => [p.x, p.y])))
      formData.append('labels', JSON.stringify(pointsList.map((p) => p.label)))
      formData.append('padding', segmentImage.maskPadding.toString())

      const response = await fetch(`${API_BASE_URL}/segment/predict`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Prediction error:', errorText)
        throw new Error('Failed to predict mask')
      }

      const data = await response.json()
      console.log('Received mask data:', data)
      setSegmentMask(`data:image/png;base64,${data.mask}`)
    } catch (err) {
      console.error('Error predicting mask:', err)
      setSegmentError(err instanceof Error ? err.message : 'Failed to predict mask')
    } finally {
      setSegmentPredicting(false)
    }
  }

  const predictMaskFromBox = async (box: BoundingBox) => {
    if (!segmentImage.originalFile) return

    console.log('Predicting mask with bounding box:', box)

    setSegmentPredicting(true)
    setSegmentError(null)

    try {
      const formData = new FormData()
      formData.append('file', segmentImage.originalFile)
      // SAM expects bboxes as [x1, y1, x2, y2]
      formData.append(
        'bboxes',
        JSON.stringify([
          Math.min(box.x1, box.x2),
          Math.min(box.y1, box.y2),
          Math.max(box.x1, box.x2),
          Math.max(box.y1, box.y2),
        ])
      )
      formData.append('padding', segmentImage.maskPadding.toString())

      const response = await fetch(`${API_BASE_URL}/segment/predict`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Prediction error:', errorText)
        throw new Error('Failed to predict mask')
      }

      const data = await response.json()
      console.log('Received mask data from box:', data)
      setSegmentMask(`data:image/png;base64,${data.mask}`)

      // Store the box in history
      setSegmentBoxes([...segmentImage.boxes, box])
    } catch (err) {
      console.error('Error predicting mask:', err)
      setSegmentError(err instanceof Error ? err.message : 'Failed to predict mask')
    } finally {
      setSegmentPredicting(false)
    }
  }

  const handleCrop = async () => {
    if (!segmentImage.originalFile || !segmentImage.maskDataUrl) return

    setSegmentCropping(true)
    setSegmentError(null)

    try {
      const formData = new FormData()
      formData.append('file', segmentImage.originalFile)
      formData.append('mask', segmentImage.maskDataUrl.split(',')[1]) // Remove data:image/png;base64,
      formData.append('padding', segmentImage.cropPadding.toString())
      if (segmentImage.aspectRatio !== 'None') {
        formData.append('aspect_ratio', segmentImage.aspectRatio)
      }

      const response = await fetch(`${API_BASE_URL}/segment/crop`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to crop image')
      }

      const data = await response.json()
      setSegmentResult(data.output_filename)

      // Don't end session - allow multiple crops with same mask
    } catch (err) {
      setSegmentError(err instanceof Error ? err.message : 'Failed to crop image')
    } finally {
      setSegmentCropping(false)
    }
  }

  const handleRemoveBackground = async () => {
    if (!segmentImage.originalFile || !segmentImage.maskDataUrl) return

    setSegmentCropping(true)
    setSegmentError(null)

    try {
      // Extract base64 data from data URL
      const base64Data = segmentImage.maskDataUrl.split(',')[1]

      const formData = new FormData()
      formData.append('file', segmentImage.originalFile)
      formData.append('mask', base64Data)

      const response = await fetch(`${API_BASE_URL}/segment/remove-background`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to remove background')
      }

      const data = await response.json()
      setSegmentResult(data.output_filename)

      // Don't end session - allow multiple operations with same mask
    } catch (err) {
      setSegmentError(err instanceof Error ? err.message : 'Failed to remove background')
    } finally {
      setSegmentCropping(false)
    }
  }

  const handleClearPoints = () => {
    setSegmentPoints([])
    setSegmentBoxes([])
    setSegmentMask(null)
  }

  const handleUndoLastPoint = async () => {
    const hasPoints = segmentImage.points.length > 0
    const hasBoxes = segmentImage.boxes.length > 0

    if (!hasPoints && !hasBoxes) return

    // Remove the last prompt (box or point)
    // Boxes are always used alone, so if we have a box, remove it
    if (hasBoxes) {
      const newBoxes = segmentImage.boxes.slice(0, -1)
      setSegmentBoxes(newBoxes)

      if (newBoxes.length > 0) {
        // Re-predict with remaining box
        await predictMaskFromBox(newBoxes[newBoxes.length - 1])
      } else if (hasPoints) {
        // Fall back to points if we have any
        await predictMask(segmentImage.points)
      } else {
        setSegmentMask(null)
      }
    } else if (hasPoints) {
      // Only points exist, remove last point
      const newPoints = segmentImage.points.slice(0, -1)
      setSegmentPoints(newPoints)

      if (newPoints.length > 0) {
        await predictMask(newPoints)
      } else {
        setSegmentMask(null)
      }
    }
  }

  const handleDownload = () => {
    if (!segmentImage.croppedFilename) return

    const link = document.createElement('a')
    link.href = `${API_BASE_URL}/images/output/${segmentImage.croppedFilename}/download`
    link.download = segmentImage.croppedFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleUpscale = () => {
    if (!segmentImage.croppedFilename) return
    sendToUpscale()
    navigate({ to: '/upscale', search: { filename: segmentImage.croppedFilename } })
  }

  const handleResize = () => {
    if (!segmentImage.croppedFilename) return
    sendToResize()
    navigate({ to: '/resize-image', search: { filename: segmentImage.croppedFilename } })
  }

  const handleSegment = () => {
    if (!segmentImage.croppedFilename) return
    sendToSegment()
    navigate({ to: '/segment', search: { filename: segmentImage.croppedFilename } })
  }

  const handleEdit = () => {
    if (!segmentImage.croppedFilename) return
    sendToEdit()
    navigate({ to: '/edit', search: { filename: segmentImage.croppedFilename } })
  }

  const handleFill = () => {
    if (!segmentImage.croppedFilename) return
    sendToFill()
    navigate({ to: '/generative-fill', search: { filename: segmentImage.croppedFilename } })
  }

  const handleSendToFill = async () => {
    if (!segmentImage.originalFile || !segmentImage.maskDataUrl) return

    try {
      // Convert mask data URL to File
      const base64Data = segmentImage.maskDataUrl.split(',')[1]
      const byteString = atob(base64Data)
      const arrayBuffer = new ArrayBuffer(byteString.length)
      const uint8Array = new Uint8Array(arrayBuffer)

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i)
      }

      const blob = new Blob([uint8Array], { type: 'image/png' })
      const maskFile = new File([blob], 'mask.png', { type: 'image/png' })

      // Clear fill state first, then set new values
      sendToFill()

      // Get the fill state setters
      const setFillOriginal = useImageStore.getState().setFillOriginal
      const setFillMask = useImageStore.getState().setFillMask

      // Set the original image and mask in fill state
      setFillOriginal(segmentImage.originalFile)
      setFillMask(maskFile)

      // Navigate to generative fill
      navigate({ to: '/generative-fill' })
    } catch (err) {
      console.error('Error sending to fill:', err)
      setSegmentError('Failed to send mask to generative fill')
    }
  }

  const handleNewSegmentation = () => {
    if (!segmentImage.originalFile) return

    // Reset the segmentation state while keeping the original image
    setSegmentPoints([])
    setSegmentBoxes([])
    setSegmentMask(null)
    setSegmentSessionEnded(false)
    setSegmentError(null)
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <InputCard
          title="Upload & Segment"
          description="Upload an image and click to select objects. Left click = select, Right click = deselect"
        >
          <div>
            <Label>Image File</Label>
            <Dropzone
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp'] }}
              src={segmentImage.originalFile ? [segmentImage.originalFile] : undefined}
              onDrop={handleFileDrop}
              className="mt-2"
              disabled={segmentImage.isUploading}
            >
              <DropzoneEmptyState />
              <DropzoneContent />
            </Dropzone>
          </div>

          {segmentImage.originalFile && (
            <>
              <div className="relative">
                <Label>Click on image to segment</Label>
                <div className="mt-2 relative border rounded-md overflow-hidden">
                  <img
                    ref={imageRef}
                    src={
                      segmentImage.originalFile
                        ? URL.createObjectURL(segmentImage.originalFile)
                        : search.filename
                          ? `${API_BASE_URL}/images/output/${search.filename}`
                          : ''
                    }
                    alt="Original"
                    className="w-full"
                    style={{ display: 'block' }}
                  />
                  <canvas
                    ref={canvasRef}
                    className={`absolute top-0 left-0 w-full h-full ${
                      segmentImage.sessionEnded
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-crosshair'
                    }`}
                    onMouseDown={segmentImage.sessionEnded ? undefined : handleMouseDown}
                    onMouseMove={segmentImage.sessionEnded ? undefined : handleMouseMove}
                    onMouseUp={segmentImage.sessionEnded ? undefined : handleMouseUp}
                    onMouseLeave={
                      segmentImage.sessionEnded
                        ? undefined
                        : (e) => {
                            if (isDragging.current) {
                              handleMouseUp(e)
                            }
                          }
                    }
                  />
                </div>
                {segmentImage.isPredicting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
                    <div className="text-white">Predicting mask...</div>
                  </div>
                )}
                {segmentImage.sessionEnded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
                    <div className="text-white text-center p-4">
                      <p className="font-semibold mb-2">Session Complete</p>
                      <p className="text-sm">
                        Cropping complete. Start a new segmentation or process the result.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {segmentImage.sessionEnded ? (
                  <Button
                    onClick={handleNewSegmentation}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    Start New Segmentation
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleUndoLastPoint}
                      disabled={
                        (segmentImage.points.length === 0 && segmentImage.boxes.length === 0) ||
                        segmentImage.isPredicting
                      }
                      variant="outline"
                      size="sm"
                    >
                      <Undo className="w-4 h-4 mr-2" />
                      Undo
                    </Button>
                    <Button
                      onClick={handleClearPoints}
                      disabled={segmentImage.points.length === 0 && segmentImage.boxes.length === 0}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All
                    </Button>
                    <div className="ml-auto text-sm text-muted-foreground">
                      {segmentImage.points.length} point
                      {segmentImage.points.length !== 1 ? 's' : ''}
                      {segmentImage.boxes.length > 0 &&
                        `, ${segmentImage.boxes.length} box${segmentImage.boxes.length !== 1 ? 'es' : ''}`}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="maskPadding">Mask Padding (px)</Label>
                <Input
                  id="maskPadding"
                  type="number"
                  value={segmentImage.maskPadding}
                  onChange={(e) => setSegmentMaskPadding(parseInt(e.target.value) || 0)}
                  min="0"
                  max="50"
                  disabled={segmentImage.sessionEnded}
                />
                <p className="text-xs text-muted-foreground">
                  Expands mask boundary for better inpainting blending
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cropPadding">Crop Padding (px)</Label>
                <Input
                  id="cropPadding"
                  type="number"
                  value={segmentImage.cropPadding}
                  onChange={(e) => setSegmentCropPadding(parseInt(e.target.value) || 0)}
                  min="0"
                  max="500"
                  disabled={segmentImage.sessionEnded}
                />
                <p className="text-xs text-muted-foreground">Padding around mask when cropping</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                <Select
                  value={segmentImage.aspectRatio}
                  onValueChange={setSegmentAspectRatio}
                  disabled={segmentImage.sessionEnded}
                >
                  <SelectTrigger id="aspectRatio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ratio) => (
                      <SelectItem key={ratio} value={ratio}>
                        {ratio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleCrop}
                  disabled={
                    !segmentImage.maskDataUrl ||
                    segmentImage.isCropping ||
                    segmentImage.sessionEnded
                  }
                  className="w-full"
                  size="lg"
                >
                  <Scissors className="w-4 h-4 mr-2" />
                  {segmentImage.isCropping ? 'Cropping...' : 'Crop to Selection'}
                </Button>

                <Button
                  onClick={handleRemoveBackground}
                  disabled={
                    !segmentImage.maskDataUrl ||
                    segmentImage.isCropping ||
                    segmentImage.sessionEnded
                  }
                  variant="secondary"
                  className="w-full"
                  size="lg"
                >
                  {segmentImage.isCropping ? 'Processing...' : 'Remove Background'}
                </Button>
              </div>

              <Button
                onClick={handleSendToFill}
                disabled={!segmentImage.maskDataUrl || !segmentImage.originalFile}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Send to Generative Fill
              </Button>

              {segmentImage.error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {segmentImage.error}
                </div>
              )}
            </>
          )}
        </InputCard>

        <OutputCard
          title="Segmentation Output"
          description="Your processed image will appear here"
          outputFilename={segmentImage.croppedFilename}
          downloadButtonText="Download Processed Image"
          emptyStateText="Click on the image to segment, then process to see results."
          onUpscale={handleUpscale}
          onResize={handleResize}
          onSegment={handleSegment}
          onEdit={handleEdit}
          onFill={handleFill}
          onDownload={handleDownload}
        />
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Eraser, Paintbrush, Undo, Download, MousePointer } from 'lucide-react'
import { API_BASE_URL } from '@/lib/constants'
import { toast } from 'sonner'

interface AdvancedMaskCanvasProps {
  imageFile: File
  onMaskCreated: (maskFile: File) => void
}

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

export function AdvancedMaskCanvas({ imageFile, onMaskCreated }: AdvancedMaskCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(50)
  const [mode, setMode] = useState<'draw' | 'erase' | 'select'>('draw')
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const [predicting, setPredicting] = useState(false)

  // Segmentation state
  const [points, setPoints] = useState<Point[]>([])
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null)
  const isDragging = useRef(false)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)

  // Mask overlay state (from SAM)
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null)

  // Load image and initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width
      canvas.height = img.height

      // Draw the image as background
      ctx.drawImage(img, 0, 0)

      imageRef.current = img
      setImageLoaded(true)

      // Save initial state
      saveHistory()
    }

    img.src = URL.createObjectURL(imageFile)

    return () => {
      URL.revokeObjectURL(img.src)
    }
  }, [imageFile])

  // Redraw canvas with mask overlay and points
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const redrawCanvas = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      // Draw SAM mask if available
      if (maskDataUrl) {
        const maskImg = new Image()
        maskImg.onload = () => {
          ctx.globalAlpha = 0.3
          ctx.drawImage(maskImg, 0, 0)
          ctx.globalAlpha = 1.0
          drawPoints(ctx, img)
        }
        maskImg.src = maskDataUrl
      } else {
        drawPoints(ctx, img)
      }
    }

    redrawCanvas()
  }, [maskDataUrl, points, currentBox])

  const drawPoints = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Calculate scale to keep dots consistent size in screen pixels
    const displayScale = img.naturalWidth / canvas.clientWidth
    const dotRadius = 8 * displayScale
    const strokeWidth = 2 * displayScale

    points.forEach((point) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, dotRadius, 0, 2 * Math.PI)
      ctx.fillStyle = point.label === 1 ? '#00ff00' : '#ff0000'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = strokeWidth
      ctx.stroke()
    })

    // Draw current bounding box if dragging
    if (currentBox) {
      const box = currentBox
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

  const saveHistory = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    historyRef.current.push(imageData)

    // Limit history to last 20 states
    if (historyRef.current.length > 20) {
      historyRef.current.shift()
    }
  }

  const undo = () => {
    if (mode === 'select') {
      // Undo SAM points/boxes
      if (points.length > 0) {
        const newPoints = points.slice(0, -1)
        setPoints(newPoints)
        if (newPoints.length > 0) {
          predictMask(newPoints)
        } else {
          setMaskDataUrl(null)
        }
      }
    } else {
      // Undo drawing/erasing
      if (historyRef.current.length <= 1) return

      historyRef.current.pop()
      const previousState = historyRef.current[historyRef.current.length - 1]

      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.putImageData(previousState, 0, 0)
    }
  }

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'select') {
      // Start bounding box drag
      const coords = getCanvasCoordinates(e)
      if (!coords) return

      isDragging.current = true
      dragStartPos.current = coords
      setCurrentBox({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y })
    } else {
      // Start drawing/erasing
      setIsDrawing(true)
      draw(e)
    }
  }

  const stopDrawing = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'select' && isDragging.current) {
      // Handle bounding box completion
      if (!dragStartPos.current || !currentBox) return

      const coords = getCanvasCoordinates(e)
      if (!coords) return

      isDragging.current = false

      // Check if this was a drag or just a click
      const dx = Math.abs(coords.x - dragStartPos.current.x)
      const dy = Math.abs(coords.y - dragStartPos.current.y)
      const minDragDistance = 5

      if (dx < minDragDistance && dy < minDragDistance) {
        // This was a click - add point
        const label = e.button === 2 ? 0 : 1
        const newPoint: Point = { x: coords.x, y: coords.y, label }
        const newPoints = [...points, newPoint]
        setPoints(newPoints)
        await predictMask(newPoints)
      } else {
        // This was a drag - use bounding box
        await predictMaskFromBox(currentBox)
      }

      // Clear drag state
      dragStartPos.current = null
      setCurrentBox(null)
    } else {
      // Handle drawing/erasing completion
      if (isDrawing) {
        setIsDrawing(false)
        saveHistory()
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'select' && isDragging.current && dragStartPos.current) {
      // Update bounding box
      const coords = getCanvasCoordinates(e)
      if (!coords) return

      setCurrentBox({
        x1: dragStartPos.current.x,
        y1: dragStartPos.current.y,
        x2: coords.x,
        y2: coords.y,
      })
    } else if (mode !== 'select') {
      // Handle drawing/erasing
      draw(e)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && e.type !== 'mousedown') return
    if (mode === 'select') return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getCanvasCoordinates(e)
    if (!coords) return

    ctx.beginPath()
    ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2)

    if (mode === 'draw') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.fill()
    } else if (mode === 'erase') {
      // Erase mode: redraw the original image area
      ctx.save()
      ctx.clip()
      if (imageRef.current) {
        ctx.drawImage(imageRef.current, 0, 0)
      }
      ctx.restore()
    }
  }

  const clearMask = () => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Redraw image without any overlay
    ctx.drawImage(imageRef.current, 0, 0)

    // Clear SAM state
    setPoints([])
    setMaskDataUrl(null)
    setCurrentBox(null)

    historyRef.current = []
    saveHistory()
  }

  const predictMask = async (pointsList: Point[]) => {
    if (!imageFile || pointsList.length === 0) return

    setPredicting(true)

    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('points', JSON.stringify(pointsList.map((p) => [p.x, p.y])))
      formData.append('labels', JSON.stringify(pointsList.map((p) => p.label)))
      formData.append('padding', '0')

      const response = await fetch(`${API_BASE_URL}/segment/predict`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to predict mask')
      }

      const data = await response.json()
      setMaskDataUrl(`data:image/png;base64,${data.mask}`)
    } catch (error) {
      console.error('Error predicting mask:', error)
      toast.error('Failed to generate segmentation mask')
    } finally {
      setPredicting(false)
    }
  }

  const predictMaskFromBox = async (box: BoundingBox) => {
    if (!imageFile) return

    setPredicting(true)

    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append(
        'bboxes',
        JSON.stringify([
          Math.min(box.x1, box.x2),
          Math.min(box.y1, box.y2),
          Math.max(box.x1, box.x2),
          Math.max(box.y1, box.y2),
        ])
      )
      formData.append('padding', '0')

      const response = await fetch(`${API_BASE_URL}/segment/predict`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to predict mask')
      }

      const data = await response.json()
      setMaskDataUrl(`data:image/png;base64,${data.mask}`)
    } catch (error) {
      console.error('Error predicting mask:', error)
      toast.error('Failed to generate segmentation mask')
    } finally {
      setPredicting(false)
    }
  }

  const generateMask = async () => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return

    // Create a new canvas for the pure black/white mask
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = canvas.width
    maskCanvas.height = canvas.height
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return

    // Fill with black (keep areas)
    maskCtx.fillStyle = 'black'
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)

    if (maskDataUrl) {
      // Use SAM mask
      const maskImg = new Image()
      await new Promise<void>((resolve) => {
        maskImg.onload = () => {
          maskCtx.drawImage(maskImg, 0, 0)
          resolve()
        }
        maskImg.src = maskDataUrl
      })
    } else {
      // Use drawn mask
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Get original image data for comparison
      const originalCanvas = document.createElement('canvas')
      originalCanvas.width = canvas.width
      originalCanvas.height = canvas.height
      const originalCtx = originalCanvas.getContext('2d')
      if (!originalCtx) return
      originalCtx.drawImage(imageRef.current, 0, 0)
      const originalData = originalCtx.getImageData(0, 0, canvas.width, canvas.height).data

      // Create white mask where overlay exists
      maskCtx.fillStyle = 'white'
      for (let i = 0; i < data.length; i += 4) {
        const rDiff = Math.abs(data[i] - originalData[i])
        const gDiff = Math.abs(data[i + 1] - originalData[i + 1])
        const bDiff = Math.abs(data[i + 2] - originalData[i + 2])

        if (rDiff > 30 || gDiff > 30 || bDiff > 30) {
          const pixelIndex = i / 4
          const x = pixelIndex % canvas.width
          const y = Math.floor(pixelIndex / canvas.width)
          maskCtx.fillRect(x, y, 1, 1)
        }
      }
    }

    // Convert to blob and create file
    maskCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'mask.png', { type: 'image/png' })
        onMaskCreated(file)
      }
    })
  }

  const downloadMask = async () => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return

    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = canvas.width
    maskCanvas.height = canvas.height
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return

    maskCtx.fillStyle = 'black'
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)

    if (maskDataUrl) {
      // Use SAM mask
      const maskImg = new Image()
      await new Promise<void>((resolve) => {
        maskImg.onload = () => {
          maskCtx.drawImage(maskImg, 0, 0)
          resolve()
        }
        maskImg.src = maskDataUrl
      })
    } else {
      // Use drawn mask
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      const originalCanvas = document.createElement('canvas')
      originalCanvas.width = canvas.width
      originalCanvas.height = canvas.height
      const originalCtx = originalCanvas.getContext('2d')
      if (!originalCtx) return
      originalCtx.drawImage(imageRef.current, 0, 0)
      const originalData = originalCtx.getImageData(0, 0, canvas.width, canvas.height).data

      maskCtx.fillStyle = 'white'
      for (let i = 0; i < data.length; i += 4) {
        const rDiff = Math.abs(data[i] - originalData[i])
        const gDiff = Math.abs(data[i + 1] - originalData[i + 1])
        const bDiff = Math.abs(data[i + 2] - originalData[i + 2])

        if (rDiff > 30 || gDiff > 30 || bDiff > 30) {
          const pixelIndex = i / 4
          const x = pixelIndex % canvas.width
          const y = Math.floor(pixelIndex / canvas.width)
          maskCtx.fillRect(x, y, 1, 1)
        }
      }
    }

    const url = maskCanvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'mask.png'
    a.click()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-muted rounded-lg">
        {/* Mode Selection */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'draw' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('draw')}
            title="Draw mask areas"
          >
            <Paintbrush className="w-4 h-4 mr-1" />
            Draw
          </Button>
          <Button
            variant={mode === 'erase' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('erase')}
            title="Erase mask areas"
          >
            <Eraser className="w-4 h-4 mr-1" />
            Erase
          </Button>
          <Button
            variant={mode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('select')}
            title="Use AI segmentation - click for points, drag for box"
          >
            <MousePointer className="w-4 h-4 mr-1" />
            Select
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={mode === 'select' ? points.length === 0 : historyRef.current.length <= 1}
            title="Undo last action"
          >
            <Undo className="w-4 h-4 mr-1" />
            Undo
          </Button>

          <Button variant="outline" size="sm" onClick={clearMask} title="Clear all mask data">
            Clear
          </Button>

          <Button variant="outline" size="sm" onClick={downloadMask} title="Download mask as PNG">
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>

        {/* Brush Size (for draw/erase modes) */}
        {mode !== 'select' && (
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Brush Size: {brushSize}px</Label>
            <input
              type="range"
              min="5"
              max="200"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 relative">
        {predicting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="text-white text-sm">Generating mask...</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onContextMenu={(e) => e.preventDefault()}
          className="max-w-full h-auto cursor-crosshair"
          style={{ display: imageLoaded ? 'block' : 'none' }}
        />
        {!imageLoaded && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading image...
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Draw:</strong> Paint white areas over regions to fill
        </p>
        <p>
          <strong>Erase:</strong> Remove painted areas
        </p>
        <p>
          <strong>Select:</strong> Left-click for foreground points (green), right-click for
          background points (red), or drag to create a bounding box
        </p>
      </div>

      {/* Use Mask Button */}
      <Button onClick={generateMask} className="w-full" disabled={predicting}>
        Use This Mask
      </Button>
    </div>
  )
}

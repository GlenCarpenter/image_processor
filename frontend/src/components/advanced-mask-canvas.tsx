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
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskLayerRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(50)
  const [mode, setMode] = useState<'draw' | 'erase' | 'select'>('draw')
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const [predicting, setPredicting] = useState(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [maskVersion, setMaskVersion] = useState(0)

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
    const cursorCanvas = cursorCanvasRef.current
    if (!canvas || !cursorCanvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width
      canvas.height = img.height
      cursorCanvas.width = img.width
      cursorCanvas.height = img.height

      // Create mask layer canvas
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = img.width
      maskCanvas.height = img.height
      maskLayerRef.current = maskCanvas

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
    const maskLayer = maskLayerRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const redrawCanvas = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      // Draw drawn mask layer with transparency
      if (maskLayer) {
        ctx.globalAlpha = 0.5
        ctx.drawImage(maskLayer, 0, 0)
        ctx.globalAlpha = 1.0
      }

      // Draw SAM mask if available (preview only in select mode)
      if (maskDataUrl && mode === 'select') {
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
  }, [maskDataUrl, points, currentBox, maskVersion, mode])

  // Draw cursor on separate canvas layer
  useEffect(() => {
    const cursorCanvas = cursorCanvasRef.current
    if (!cursorCanvas) return

    const ctx = cursorCanvas.getContext('2d')
    if (!ctx) return

    // Clear cursor canvas
    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height)

    // Draw cursor based on mode
    if (cursorPos) {
      if (mode === 'draw' || mode === 'erase') {
        // Circle cursor for draw/erase
        ctx.beginPath()
        ctx.arc(cursorPos.x, cursorPos.y, brushSize, 0, 2 * Math.PI)
        ctx.strokeStyle = mode === 'draw' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 100, 100, 0.8)'
        ctx.lineWidth = 2
        ctx.stroke()
      } else if (mode === 'select') {
        // Crosshair/target cursor for select mode
        const size = 20
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
        ctx.lineWidth = 2

        // Draw crosshair
        ctx.beginPath()
        ctx.moveTo(cursorPos.x - size, cursorPos.y)
        ctx.lineTo(cursorPos.x + size, cursorPos.y)
        ctx.moveTo(cursorPos.x, cursorPos.y - size)
        ctx.lineTo(cursorPos.x, cursorPos.y + size)
        ctx.stroke()

        // Draw center circle
        ctx.beginPath()
        ctx.arc(cursorPos.x, cursorPos.y, 3, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'
        ctx.fill()
      }
    }
  }, [cursorPos, brushSize, mode])

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
    const maskLayer = maskLayerRef.current
    if (!maskLayer) return

    const ctx = maskLayer.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, maskLayer.width, maskLayer.height)
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
      // Undo drawing/erasing on mask layer
      if (historyRef.current.length <= 1) return

      historyRef.current.pop()
      const previousState = historyRef.current[historyRef.current.length - 1]

      const maskLayer = maskLayerRef.current
      if (!maskLayer) return

      const ctx = maskLayer.getContext('2d')
      if (!ctx) return

      ctx.putImageData(previousState, 0, 0)
      setMaskVersion((v) => v + 1)
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
      const coords = getCanvasCoordinates(e)
      if (!coords) return

      lastPosRef.current = coords
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
        lastPosRef.current = null
        saveHistory()
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e)
    if (!coords) return

    // Update cursor position for visual feedback
    setCursorPos(coords)

    if (mode === 'select' && isDragging.current && dragStartPos.current) {
      // Update bounding box
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

    if (mode === 'draw') {
      // Draw to mask layer at full opacity to prevent accumulation
      const maskLayer = maskLayerRef.current
      if (!maskLayer) return

      const maskCtx = maskLayer.getContext('2d')
      if (!maskCtx) return

      // Draw pure white at full opacity
      maskCtx.fillStyle = 'rgba(255, 255, 255, 1.0)'
      maskCtx.strokeStyle = 'rgba(255, 255, 255, 1.0)'
      maskCtx.lineWidth = brushSize * 2
      maskCtx.lineCap = 'round'
      maskCtx.lineJoin = 'round'

      // If we have a last position, draw a line to create continuous stroke
      if (lastPosRef.current) {
        maskCtx.beginPath()
        maskCtx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
        maskCtx.lineTo(coords.x, coords.y)
        maskCtx.stroke()
      }

      // Draw a circle at the current position
      maskCtx.beginPath()
      maskCtx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2)
      maskCtx.fill()

      lastPosRef.current = coords

      // Trigger redraw of display canvas
      setMaskVersion((v) => v + 1)
    } else if (mode === 'erase') {
      // Erase from mask layer
      const maskLayer = maskLayerRef.current
      if (!maskLayer) return

      const maskCtx = maskLayer.getContext('2d')
      if (!maskCtx) return

      maskCtx.globalCompositeOperation = 'destination-out'
      maskCtx.fillStyle = 'rgba(0, 0, 0, 1.0)'
      maskCtx.strokeStyle = 'rgba(0, 0, 0, 1.0)'
      maskCtx.lineWidth = brushSize * 2
      maskCtx.lineCap = 'round'
      maskCtx.lineJoin = 'round'

      // If we have a last position, erase along the path
      if (lastPosRef.current) {
        maskCtx.beginPath()
        maskCtx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
        maskCtx.lineTo(coords.x, coords.y)
        maskCtx.stroke()
      }

      // Erase at current position
      maskCtx.beginPath()
      maskCtx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2)
      maskCtx.fill()

      maskCtx.globalCompositeOperation = 'source-over'

      lastPosRef.current = coords

      // Trigger redraw of display canvas
      setMaskVersion((v) => v + 1)

      lastPosRef.current = coords
    }
  }

  const clearMask = () => {
    const maskLayer = maskLayerRef.current
    if (!maskLayer) return

    const ctx = maskLayer.getContext('2d')
    if (!ctx) return

    // Clear the mask layer
    ctx.clearRect(0, 0, maskLayer.width, maskLayer.height)

    // Clear SAM state
    setPoints([])
    setMaskDataUrl(null)
    setCurrentBox(null)

    historyRef.current = []
    saveHistory()
    setMaskVersion((v) => v + 1)
  }

  const applySamMaskToLayer = async () => {
    if (!maskDataUrl) return

    const maskLayer = maskLayerRef.current
    if (!maskLayer) return

    const maskCtx = maskLayer.getContext('2d')
    if (!maskCtx) return

    // Load the SAM mask image
    const maskImg = new Image()
    await new Promise<void>((resolve) => {
      maskImg.onload = async () => {
        // Create a temporary canvas to read SAM mask data
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = maskImg.width
        tempCanvas.height = maskImg.height
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) return

        // Draw SAM mask to temp canvas
        tempCtx.drawImage(maskImg, 0, 0)

        // Get the image data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
        const data = imageData.data

        // Only draw white pixels (mask areas), ignore black pixels (background)
        // Use lighten mode or manually filter pixels
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // If pixel is mostly black (background), make it transparent
          if (r < 128 && g < 128 && b < 128) {
            data[i + 3] = 0 // Set alpha to 0 (transparent)
          } else {
            // Keep white pixels as white
            data[i] = 255
            data[i + 1] = 255
            data[i + 2] = 255
            data[i + 3] = 255
          }
        }

        // Draw the filtered mask to mask layer
        tempCtx.putImageData(imageData, 0, 0)
        maskCtx.drawImage(tempCanvas, 0, 0)

        resolve()
      }
      maskImg.src = maskDataUrl
    })

    // Clear SAM state since it's now in the mask layer
    setPoints([])
    setMaskDataUrl(null)
    setCurrentBox(null)

    // Save to history and trigger redraw
    saveHistory()
    setMaskVersion((v) => v + 1)

    toast.success('SAM mask applied to drawing layer')
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
    const maskLayer = maskLayerRef.current
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
    } else if (maskLayer) {
      // Use drawn mask layer directly
      maskCtx.drawImage(maskLayer, 0, 0)
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
    const maskLayer = maskLayerRef.current
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
    } else if (maskLayer) {
      // Use drawn mask layer directly
      maskCtx.drawImage(maskLayer, 0, 0)
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

          {maskDataUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={applySamMaskToLayer}
              title="Apply SAM mask to drawing layer for editing"
            >
              Apply to Layer
            </Button>
          )}

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
        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrawing}
            onMouseLeave={() => {
              stopDrawing({ clientX: 0, clientY: 0 } as React.MouseEvent<HTMLCanvasElement>)
              setCursorPos(null)
            }}
            onContextMenu={(e) => e.preventDefault()}
            className="max-w-full h-auto cursor-none"
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
          <canvas
            ref={cursorCanvasRef}
            className="absolute top-0 left-0 max-w-full h-auto pointer-events-none"
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        </div>
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

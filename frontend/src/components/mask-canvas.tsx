import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Eraser, Paintbrush, Undo, Download } from 'lucide-react'

interface MaskCanvasProps {
  imageFile: File
  onMaskCreated: (maskFile: File) => void
}

export function MaskCanvas({ imageFile, onMaskCreated }: MaskCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(50)
  const [brushMode, setBrushMode] = useState<'draw' | 'erase'>('draw')
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const historyRef = useRef<ImageData[]>([])

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

      // Start with no mask overlay (transparent = nothing selected to fill)
      // User will paint white areas to mark what to fill

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
    if (historyRef.current.length <= 1) return

    historyRef.current.pop() // Remove current state
    const previousState = historyRef.current[historyRef.current.length - 1]

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.putImageData(previousState, 0, 0)
  }

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    draw(e)
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      saveHistory()
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && e.type !== 'mousedown') return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getCanvasCoordinates(e)
    if (!coords) return

    // Draw circle with white 30% opacity (fill areas) or erase back to image
    ctx.beginPath()
    ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2)
    
    if (brushMode === 'draw') {
      // Draw white with 30% opacity to mark fill areas
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.fill()
    } else {
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

    historyRef.current = []
    saveHistory()
  }

  const generateMask = () => {
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

    // Get the current canvas data
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

    // Create white mask where overlay exists (painted areas)
    maskCtx.fillStyle = 'white'
    for (let i = 0; i < data.length; i += 4) {
      // Check if this pixel is different from the original (has overlay)
      const rDiff = Math.abs(data[i] - originalData[i])
      const gDiff = Math.abs(data[i + 1] - originalData[i + 1])
      const bDiff = Math.abs(data[i + 2] - originalData[i + 2])
      
      // If pixel is brighter than original (white overlay applied), mark it white in mask
      if (rDiff > 30 || gDiff > 30 || bDiff > 30) {
        const pixelIndex = i / 4
        const x = pixelIndex % canvas.width
        const y = Math.floor(pixelIndex / canvas.width)
        maskCtx.fillRect(x, y, 1, 1)
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

  const downloadMask = () => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return

    // Create pure black/white mask for download
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = canvas.width
    maskCanvas.height = canvas.height
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return

    maskCtx.fillStyle = 'black'
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)

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

    const url = maskCanvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'mask.png'
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <Button
            variant={brushMode === 'draw' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBrushMode('draw')}
          >
            <Paintbrush className="w-4 h-4 mr-1" />
            Draw
          </Button>
          <Button
            variant={brushMode === 'erase' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBrushMode('erase')}
          >
            <Eraser className="w-4 h-4 mr-1" />
            Erase
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={historyRef.current.length <= 1}
        >
          <Undo className="w-4 h-4 mr-1" />
          Undo
        </Button>

        <Button variant="outline" size="sm" onClick={clearMask}>
          Clear
        </Button>

        <Button variant="outline" size="sm" onClick={downloadMask}>
          <Download className="w-4 h-4 mr-1" />
          Download Mask
        </Button>
      </div>

      <div>
        <Label>Brush Size: {brushSize}px</Label>
        <input
          type="range"
          min="5"
          max="200"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-full mt-2"
        />
      </div>

      <div className="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="max-w-full h-auto cursor-crosshair"
          style={{ display: imageLoaded ? 'block' : 'none' }}
        />
        {!imageLoaded && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading image...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={generateMask} className="flex-1">
          Use This Mask
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Paint white areas over the regions you want to fill. White areas in the mask = fill, Black
        areas = keep original.
      </p>
    </div>
  )
}

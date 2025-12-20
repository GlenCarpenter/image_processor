import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Scissors, Trash2, Download, Undo, ArrowUpCircle, Expand } from 'lucide-react'
import { useImageStore } from '@/store/imageStore'

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

const API_BASE_URL = 'http://localhost:8000/api'

interface Point {
    x: number
    y: number
    label: number // 1 = foreground, 0 = background
}

const ASPECT_RATIOS = [
    'None',
    'Portrait (2:3)',
    'Standard (3:4)',
    'Large Format (4:5)',
    'Selfie, Social Media Videos (9:16)',
    'Tall Portrait (1:2)',
    'Square (1:1)',
    'Wide Landscape (2:1)',
    'SD TV (4:3)',
    'IMAX (1.43:1)',
    'European Widescreen (1.66:1)',
    'Widescreen / HD TV (16:9)',
    'Standard Widescreen (1.85:1)',
    'Cinemascope / Panavision (2.35:1)',
    'Anamorphic Widescreen (2.39:1)',
    'Golden Ratio (1.618:1)',
]

function RouteComponent() {
    const navigate = useNavigate()
    const search = Route.useSearch()

    // Get state from Zustand store
    const segmentImage = useImageStore((state) => state.segmentImage)
    const setSegmentSession = useImageStore((state) => state.setSegmentSession)
    const setSegmentOriginal = useImageStore((state) => state.setSegmentOriginal)
    const setSegmentResult = useImageStore((state) => state.setSegmentResult)
    const setSegmentPoints = useImageStore((state) => state.setSegmentPoints)
    const setSegmentMask = useImageStore((state) => state.setSegmentMask)
    const setSegmentPadding = useImageStore((state) => state.setSegmentPadding)
    const setSegmentAspectRatio = useImageStore((state) => state.setSegmentAspectRatio)
    const setSegmentSessionEnded = useImageStore((state) => state.setSegmentSessionEnded)
    const setSegmentUploading = useImageStore((state) => state.setSegmentUploading)
    const setSegmentPredicting = useImageStore((state) => state.setSegmentPredicting)
    const setSegmentCropping = useImageStore((state) => state.setSegmentCropping)
    const setSegmentError = useImageStore((state) => state.setSegmentError)
    const clearSegmentImages = useImageStore((state) => state.clearSegmentImages)
    const sendSegmentToUpscale = useImageStore((state) => state.sendSegmentToUpscale)
    const sendSegmentToResize = useImageStore((state) => state.sendSegmentToResize)
    const sendSegmentToSegment = useImageStore((state) => state.sendSegmentToSegment)

    // Local refs only (not persisted)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)
    const lastLoadedFilename = useRef<string | null>(null)

    // Helper function to cleanup session on server
    const cleanupSession = async (sessionId: string) => {
        try {
            await fetch(`${API_BASE_URL}/segment/session/${sessionId}`, {
                method: 'DELETE',
            })
            console.log('Cleaned up session:', sessionId)
        } catch (err) {
            console.error('Failed to cleanup session:', err)
        }
    }

    // Load image from URL query param on mount
    useEffect(() => {
        if (search.filename && search.filename !== lastLoadedFilename.current) {
            // Clear store state FIRST (synchronously) to prevent sessionEnded from triggering
            setSegmentResult(null)
            setSegmentSession(null)

            const imageUrl = `${API_BASE_URL}/images/output/${search.filename}`

            // Reset UI state for new image
            setSegmentPoints([])
            setSegmentMask(null)
            setSegmentSessionEnded(false)
            setSegmentError(null)
            setSegmentUploading(true)
            setSegmentResult(null)

            fetch(imageUrl)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], search.filename!, { type: blob.type })
                    setSegmentOriginal(file, imageUrl)
                    // Upload to get a new session
                    const formData = new FormData()
                    formData.append('file', file)
                    return fetch(`${API_BASE_URL}/segment/upload`, {
                        method: 'POST',
                        body: formData,
                    })
                })
                .then(response => response.json())
                .then(data => {
                    console.log(data)
                    setSegmentSession(data.session_id)
                    lastLoadedFilename.current = search.filename!
                })
                .catch(err => {
                    console.error('Failed to load image:', err)
                    setSegmentError('Failed to load image from URL')
                })
                .finally(() => {
                    setSegmentUploading(false)
                })
        }
    }, [search.filename])

    // Handle image from store (uploaded from home page) when no URL param
    useEffect(() => {
        if (!search.filename && segmentImage.originalFile && !segmentImage.sessionId) {
            // Upload the file from store to create a session
            setSegmentUploading(true)
            setSegmentError(null)

            const formData = new FormData()
            formData.append('file', segmentImage.originalFile)

            fetch(`${API_BASE_URL}/segment/upload`, {
                method: 'POST',
                body: formData,
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Session created from store:', data)
                    setSegmentSession(data.session_id)
                })
                .catch(err => {
                    console.error('Failed to upload image:', err)
                    setSegmentError('Failed to upload image')
                })
                .finally(() => {
                    setSegmentUploading(false)
                })
        }
    }, [search.filename, segmentImage.originalFile, segmentImage.sessionId])

    // Cleanup session on unmount if it hasn't been cropped
    useEffect(() => {
        return () => {
            // Cleanup active session when navigating away (if not already cropped)
            if (segmentImage.sessionId && !segmentImage.sessionEnded) {
                cleanupSession(segmentImage.sessionId)
            }
        }
    }, []) // Empty deps to only run on unmount

    // Check if session has ended (when there's a cropped result but no session)
    useEffect(() => {
        if (segmentImage.croppedFilename && !segmentImage.sessionId) {
            setSegmentSessionEnded(true)
        } else if (!segmentImage.croppedFilename) {
            setSegmentSessionEnded(false)
        }
    }, [segmentImage.croppedFilename, segmentImage.sessionId, setSegmentSessionEnded])

    useEffect(() => {
        if (segmentImage.originalUrl && canvasRef.current && imageRef.current) {
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
    }, [segmentImage.originalUrl, segmentImage.points, segmentImage.maskDataUrl])

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
    }

    const handleFileDrop = async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0]
            const url = URL.createObjectURL(file)
            setSegmentOriginal(file, url)
            setSegmentPoints([])
            setSegmentMask(null)
            setSegmentResult(null)
            setSegmentSessionEnded(false)
            setSegmentError(null)

            // Cleanup old session first if it exists
            const oldSessionId = segmentImage.sessionId
            if (oldSessionId) {
                cleanupSession(oldSessionId)
            }

            // Upload to server
            setSegmentUploading(true)
            try {
                const formData = new FormData()
                formData.append('file', file)

                const response = await fetch(`${API_BASE_URL}/segment/upload`, {
                    method: 'POST',
                    body: formData,
                })

                if (!response.ok) {
                    throw new Error('Failed to upload image')
                }

                const data = await response.json()
                setSegmentSession(data.session_id)
            } catch (err) {
                setSegmentError(err instanceof Error ? err.message : 'Failed to upload image')
            } finally {
                setSegmentUploading(false)
            }
        }
    }

    const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
        console.log(imageRef.current, segmentImage.sessionId)
        if (!imageRef.current || !segmentImage.sessionId) return

        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const img = imageRef.current

        // Get click coordinates relative to canvas
        const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth
        const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight

        // Determine label: left click = foreground (1), right click = background (0)
        const label = e.button === 2 ? 0 : 1

        const newPoint: Point = { x, y, label }
        const newPoints = [...segmentImage.points, newPoint]
        setSegmentPoints(newPoints)

        // Trigger prediction
        await predictMask(newPoints)
    }

    const predictMask = async (pointsList: Point[]) => {
        if (!segmentImage.sessionId || pointsList.length === 0) return

        console.log('Predicting mask with points:', pointsList)

        setSegmentPredicting(true)
        setSegmentError(null)

        try {
            const formData = new FormData()
            formData.append('session_id', segmentImage.sessionId)
            formData.append('points', JSON.stringify(pointsList.map((p) => [p.x, p.y])))
            formData.append('labels', JSON.stringify(pointsList.map((p) => p.label)))

            const response = await fetch(`${API_BASE_URL}/segment/predict`, {
                method: 'POST',
                body: formData
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

    const handleCrop = async () => {
        if (!segmentImage.sessionId || !segmentImage.maskDataUrl) return

        setSegmentCropping(true)
        setSegmentError(null)

        try {
            const formData = new FormData()
            formData.append('session_id', segmentImage.sessionId)
            formData.append('mask', segmentImage.maskDataUrl.split(',')[1]) // Remove data:image/png;base64,
            formData.append('padding', segmentImage.padding.toString())
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

            // Mark session as ended since cropping deletes the temp file
            setSegmentSessionEnded(true)
        } catch (err) {
            setSegmentError(err instanceof Error ? err.message : 'Failed to crop image')
        } finally {
            setSegmentCropping(false)
        }
    }

    const handleClearPoints = () => {
        setSegmentPoints([])
        setSegmentMask(null)
    }

    const handleUndoLastPoint = async () => {
        if (segmentImage.points.length === 0) return
        const newPoints = segmentImage.points.slice(0, -1)
        setSegmentPoints(newPoints)
        if (newPoints.length > 0) {
            await predictMask(newPoints)
        } else {
            setSegmentMask(null)
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
        sendSegmentToUpscale()
        navigate({ to: '/upscale', search: { filename: segmentImage.croppedFilename } })
    }

    const handleResize = () => {
        if (!segmentImage.croppedFilename) return
        sendSegmentToResize()
        navigate({ to: '/resize-image', search: { filename: segmentImage.croppedFilename } })
    }

    const handleSegment = () => {
        if (!segmentImage.croppedFilename) return
        sendSegmentToSegment()
        navigate({ to: '/segment', search: { filename: segmentImage.croppedFilename } })
    }

    const handleNewSegmentation = () => {
        if (!segmentImage.originalFile) return

        // Keep the current image and cropped result, just reset the session state
        setSegmentPoints([])
        setSegmentMask(null)
        setSegmentSessionEnded(false)
        setSegmentError(null)
        setSegmentUploading(true)

        // Cleanup old session first if it exists
        const oldSessionId = segmentImage.sessionId
        if (oldSessionId) {
            cleanupSession(oldSessionId)
        }

        // Re-upload the original image to get a new session
        const formData = new FormData()
        formData.append('file', segmentImage.originalFile)

        fetch(`${API_BASE_URL}/segment/upload`, {
            method: 'POST',
            body: formData,
        })
            .then(response => response.json())
            .then(data => {
                setSegmentSession(data.session_id)
            })
            .catch(err => {
                console.error('Failed to create new session:', err)
                setSegmentError('Failed to create new session')
            })
            .finally(() => {
                setSegmentUploading(false)
            })
    }

    return (
        <div className="container mx-auto p-4 max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upload & Segment</CardTitle>
                        <CardDescription>
                            Upload an image and click to select objects. Left click = select, Right click =
                            deselect
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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

                        {segmentImage.originalUrl && (
                            <>
                                <div className="relative">
                                    <Label>Click on image to segment</Label>
                                    <div className="mt-2 relative border rounded-md overflow-hidden">
                                        <img
                                            ref={imageRef}
                                            src={segmentImage.originalUrl}
                                            alt="Original"
                                            className="w-full"
                                            style={{ display: 'block' }}
                                        />
                                        <canvas
                                            ref={canvasRef}
                                            className={`absolute top-0 left-0 w-full h-full ${segmentImage.sessionEnded ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'
                                                }`}
                                            onClick={segmentImage.sessionEnded ? undefined : handleCanvasClick}
                                            onContextMenu={segmentImage.sessionEnded ? undefined : (e) => {
                                                e.preventDefault()
                                                handleCanvasClick(e as any)
                                            }}
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
                                                <p className="text-sm">Cropping complete. Start a new segmentation or process the result.</p>
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
                                                disabled={segmentImage.points.length === 0 || segmentImage.isPredicting}
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Undo className="w-4 h-4 mr-2" />
                                                Undo
                                            </Button>
                                            <Button
                                                onClick={handleClearPoints}
                                                disabled={segmentImage.points.length === 0}
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Clear Points
                                            </Button>
                                            <div className="ml-auto text-sm text-muted-foreground">
                                                {segmentImage.points.length} point{segmentImage.points.length !== 1 ? 's' : ''}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="padding">Padding (%)</Label>
                                    <Input
                                        id="padding"
                                        type="number"
                                        value={segmentImage.padding}
                                        onChange={(e) => setSegmentPadding(parseFloat(e.target.value) || 0)}
                                        min="0"
                                        max="100"
                                        disabled={segmentImage.sessionEnded}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                                    <Select value={segmentImage.aspectRatio} onValueChange={setSegmentAspectRatio} disabled={segmentImage.sessionEnded}>
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

                                <Button
                                    onClick={handleCrop}
                                    disabled={!segmentImage.maskDataUrl || segmentImage.isCropping || segmentImage.sessionEnded}
                                    className="w-full"
                                    size="lg"
                                >
                                    <Scissors className="w-4 h-4 mr-2" />
                                    {segmentImage.isCropping ? 'Cropping...' : 'Crop to Selection'}
                                </Button>

                                {segmentImage.error && (
                                    <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                                        {segmentImage.error}
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Output Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Cropped Result</CardTitle>
                        <CardDescription>Your cropped image will appear here</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {segmentImage.croppedFilename ? (
                            <>
                                <div>
                                    <img
                                        src={`${API_BASE_URL}/images/output/${segmentImage.croppedFilename}`}
                                        alt="Cropped"
                                        className="w-full rounded-md border"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button onClick={handleUpscale} variant="outline" size="sm">
                                            <ArrowUpCircle className="w-4 h-4 mr-1" />
                                            Upscale
                                        </Button>
                                        <Button onClick={handleResize} variant="outline" size="sm">
                                            <Expand className="w-4 h-4 mr-1" />
                                            Resize
                                        </Button>
                                        <Button onClick={handleSegment} variant="outline" size="sm">
                                            <Scissors className="w-4 h-4 mr-1" />
                                            Segment
                                        </Button>
                                    </div>
                                    <Button onClick={handleDownload} className="w-full">
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Cropped Image
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                <p>Click on the image to segment, then crop to see results.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
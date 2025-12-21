import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useImageStore } from '@/store/imageStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { useEffect } from 'react'
import { extractImageMetadata, fetchExifData, fetchPrompt, fetchImageInfo } from '@/lib/imageUtils'
import { ImageMetadataDisplay } from '@/components/ImageMetadataDisplay'

import { API_BASE_URL } from '@/lib/constants'
import { OutputCard } from '@/components/OutputCard'

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

  // Get state from Zustand store
  const editImage = useImageStore((state) => state.editImage)
  const setEditOriginal = useImageStore((state) => state.setEditOriginal)
  const setEditResult = useImageStore((state) => state.setEditResult)
  const setEditPrompt = useImageStore((state) => state.setEditPrompt)
  const setEditEditing = useImageStore((state) => state.setEditEditing)
  const setEditError = useImageStore((state) => state.setEditError)
  const setEditOriginalMetadata = useImageStore((state) => state.setEditOriginalMetadata)
  const setEditResultMetadata = useImageStore((state) => state.setEditResultMetadata)
  const sendToEdit = useImageStore((state) => state.sendToEdit)
  const sendToUpscale = useImageStore((state) => state.sendToUpscale)
  const sendToResize = useImageStore((state) => state.sendToResize)
  const sendToSegment = useImageStore((state) => state.sendToSegment)

  // Load image from URL query param on mount
  useEffect(() => {
    if (search.filename && !editImage.originalFile) {
      const imageUrl = `${API_BASE_URL}/images/output/${search.filename}`

      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], search.filename!, { type: blob.type })
          setEditOriginal(file)

          extractImageMetadata(file, imageUrl)
            .then(async (metadata) => {
              // Fetch EXIF data, prompt, and image info for the output image
              const exifData = await fetchExifData(search.filename!, API_BASE_URL)
              const promptData = await fetchPrompt(search.filename!, API_BASE_URL)
              const imageInfo = await fetchImageInfo(search.filename!, API_BASE_URL)
              setEditOriginalMetadata({
                ...metadata,
                exif: exifData || undefined,
                prompt: promptData || undefined,
                imageInfo: imageInfo || undefined,
              })
            })
            .catch((err) => console.error('Failed to extract metadata:', err))
        })
        .catch((err) => {
          console.error('Failed to load image:', err)
          setEditError('Failed to load image from URL')
        })
    }
  }, [search.filename, editImage.originalFile])

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setEditOriginal(file)
      setEditResult(null, null, null)
      setEditError(null)
      setEditResultMetadata(null)

      // Extract image metadata
      const url = URL.createObjectURL(file)
      extractImageMetadata(file, url)
        .then(async (metadata) => {
          // Upload file temporarily to extract EXIF data and prompt
          const formData = new FormData()
          formData.append('file', file)

          try {
            const response = await fetch(`${API_BASE_URL}/images/upload-temp`, {
              method: 'POST',
              body: formData,
            })

            if (response.ok) {
              const data = await response.json()
              setEditOriginalMetadata({
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
          setEditOriginalMetadata(metadata)
        })
        .catch((err) => {
          console.error('Failed to extract image metadata:', err)
          setEditOriginalMetadata(null)
        })
    }
  }

  const handleEdit = async () => {
    if (!editImage.originalFile) {
      setEditError('Please select an image first')
      return
    }

    if (!editImage.prompt.trim()) {
      setEditError('Please enter an editing prompt')
      return
    }

    setEditEditing(true)
    setEditError(null)

    try {
      const formData = new FormData()
      formData.append('file', editImage.originalFile)
      formData.append('prompt', editImage.prompt)
      formData.append('guidance_scale', '1.0')
      formData.append('num_inference_steps', '6')
      formData.append('acceleration', 'regular')
      formData.append('output_format', 'png')

      const response = await fetch(`${API_BASE_URL}/edit/edit`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || 'Failed to edit image')
      }

      // Parse JSON response
      const data = await response.json()

      if (!data.success) {
        throw new Error('Failed to edit image')
      }

      // Set edit result in store with job ID and filename
      const info = {
        outputWidth: data.output_width,
        outputHeight: data.output_height,
      }

      setEditResult(data.job_id, data.output_filename, info)

      // Extract metadata from edited image
      const imageUrl = `${API_BASE_URL}/images/output/${data.output_filename}`
      const response2 = await fetch(imageUrl)
      const blob = await response2.blob()
      const file = new File([blob], data.output_filename, { type: blob.type })

      extractImageMetadata(file, imageUrl)
        .then(setEditResultMetadata)
        .catch((err) => {
          console.error('Failed to extract result metadata:', err)
          setEditResultMetadata(null)
        })
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setEditEditing(false)
    }
  }

  const handleDownload = () => {
    if (!editImage.outputFilename) return

    const link = document.createElement('a')
    link.href = `${API_BASE_URL}/images/output/${editImage.outputFilename}/download`
    link.download = editImage.outputFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleEditAgain = () => {
    if (!editImage.outputFilename) return
    sendToEdit()
    navigate({ to: '/edit', search: { filename: editImage.outputFilename } })
  }

  const handleUpscaleClick = () => {
    if (!editImage.outputFilename) return
    sendToUpscale()
    navigate({ to: '/upscale', search: { filename: editImage.outputFilename } })
  }

  const handleResizeClick = () => {
    if (!editImage.outputFilename) return
    sendToResize()
    navigate({ to: '/resize-image', search: { filename: editImage.outputFilename } })
  }

  const handleSegmentClick = () => {
    if (!editImage.outputFilename) return
    sendToSegment()
    navigate({ to: '/segment', search: { filename: editImage.outputFilename } })
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Image</CardTitle>
            <CardDescription>Select an image to edit using AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Image File</Label>
              <Dropzone
                accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff'] }}
                src={editImage.originalFile ? [editImage.originalFile] : undefined}
                onDrop={handleFileDrop}
                className="mt-2"
              >
                <DropzoneEmptyState />
                <DropzoneContent />
              </Dropzone>
            </div>

            {(editImage.originalFile || search.filename) && (
              <>
                <div>
                  <Label>Original Image Preview</Label>
                  <img
                    src={
                      editImage.originalFile
                        ? URL.createObjectURL(editImage.originalFile)
                        : `${API_BASE_URL}/images/output/${search.filename}`
                    }
                    alt="Original"
                    className="mt-2 max-h-64 w-full object-contain rounded-md border"
                  />
                </div>

                <div>
                  <Label htmlFor="prompt">Editing Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={editImage.prompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="e.g., Remove all text from the image, Replace the sky with sunset, Remove the person in red"
                    className="mt-2 min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Describe what you want to edit or remove from the image
                  </p>
                </div>

                <Button
                  onClick={handleEdit}
                  disabled={editImage.isEditing || !editImage.prompt.trim()}
                  className="w-full"
                  size="lg"
                >
                  {editImage.isEditing ? 'Editing...' : 'Edit Image'}
                </Button>

                {editImage.originalMetadata && (
                  <ImageMetadataDisplay metadata={editImage.originalMetadata} />
                )}

                {editImage.error && (
                  <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    {editImage.error}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Output Section */}
        {editImage.outputFilename && (
          <OutputCard
            title="Edited Image"
            description="AI-edited result"
            outputFilename={editImage.outputFilename}
            downloadButtonText="Download Edited Image"
            emptyStateText="No edited image yet"
            onUpscale={handleUpscaleClick}
            onResize={handleResizeClick}
            onSegment={handleSegmentClick}
            onEdit={handleEditAgain}
            onDownload={handleDownload}
            additionalInfo={
              editImage.resultMetadata ? (
                <ImageMetadataDisplay metadata={editImage.resultMetadata} />
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  )
}

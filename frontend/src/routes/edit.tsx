import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useImageStore } from '@/store/imageStore'
import { extractImageMetadata, fetchExifData, fetchPrompt, fetchImageInfo } from '@/lib/imageUtils'
import { ImageMetadataDisplay } from '@/components/image-metadata-display'
import { InputCard } from '@/components/input-card'
import { OriginalImagePreview } from '@/components/original-image-preview'
import { API_BASE_URL } from '@/lib/constants'
import { OutputCard } from '@/components/output-card'

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

      // Job will be tracked globally, no local polling needed
      console.log(`Edit job submitted: ${data.job_id}`)
      toast.success('Job Submitted', {
        description: 'Your edit job is being processed. You will be notified when complete.',
      })
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An error occurred')
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
        <InputCard title="Upload And Configure" description="Select an image to edit using AI">
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
              <OriginalImagePreview
                file={editImage.originalFile}
                filename={search.filename}
                apiBaseUrl={API_BASE_URL}
              />

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
                {editImage.isEditing ? 'Editing Image...' : 'Edit Image'}
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
        </InputCard>

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
      </div>
    </div>
  )
}

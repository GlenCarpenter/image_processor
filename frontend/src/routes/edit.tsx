import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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

  // Store actions
  const editImage = useImageStore((state) => state.editImage)
  const setEditOriginal = useImageStore((state) => state.setEditOriginal)
  const setEditOriginalFiles = useImageStore((state) => state.setEditOriginalFiles)
  const setEditResult = useImageStore((state) => state.setEditResult)
  const setEditPrompt = useImageStore((state) => state.setEditPrompt)
  const setEditEditing = useImageStore((state) => state.setEditEditing)
  const setEditError = useImageStore((state) => state.setEditError)
  const setEditOriginalMetadata = useImageStore((state) => state.setEditOriginalMetadata)
  const setEditResultMetadata = useImageStore((state) => state.setEditResultMetadata)
  const setEditNumInferenceSteps = useImageStore((state) => state.setEditNumInferenceSteps)
  const setEditNegativePrompt = useImageStore((state) => state.setEditNegativePrompt)
  const setEditEnableSafetyChecker = useImageStore((state) => state.setEditEnableSafetyChecker)
  const setEditOutputFormat = useImageStore((state) => state.setEditOutputFormat)
  const setEditSeed = useImageStore((state) => state.setEditSeed)
  const setEditTargetResolution = useImageStore((state) => state.setEditTargetResolution)
  const sendToEdit = useImageStore((state) => state.sendToEdit)
  const sendToUpscale = useImageStore((state) => state.sendToUpscale)
  const sendToResize = useImageStore((state) => state.sendToResize)
  const sendToSegment = useImageStore((state) => state.sendToSegment)
  const sendToFill = useImageStore((state) => state.sendToFill)
  const presets = useImageStore((state) => state.presets)
  const loadPresets = useImageStore((state) => state.loadPresets)
  const savePreset = useImageStore((state) => state.savePreset)
  const deletePreset = useImageStore((state) => state.deletePreset)
  const applyPreset = useImageStore((state) => state.applyPreset)

  // Local state for UI-only values (not parameters)
  const [presetName, setPresetName] = useState('')
  const [showSavePreset, setShowSavePreset] = useState(false)
  const existingPresetWithName = presets.find((p) => p.name === presetName)

  // Load presets on mount
  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // Load image from URL query param on mount
  useEffect(() => {
    if (search.filename && editImage.originalFiles.length === 0) {
      const imageUrl = `${API_BASE_URL}/images/output/${search.filename}`

      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], search.filename!, { type: blob.type })
          setEditOriginalFiles([file])
          setEditEditing(false)

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
  }, [search.filename])

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // Get current files and append new ones, up to 4 total
      const currentFiles = editImage.originalFiles
      const availableSlots = 4 - currentFiles.length

      if (availableSlots <= 0) {
        setEditError('Maximum 4 images allowed. Clear existing images first.')
        return
      }

      const filesToAdd = acceptedFiles.slice(0, availableSlots)
      const updatedFiles = [...currentFiles, ...filesToAdd]

      // Update state with accumulated files
      setEditOriginalFiles(updatedFiles)
      setEditResult(null, null, null)
      setEditError(null)
      setEditResultMetadata(null)
      setEditEditing(false)

      // Extract image metadata from first file
      const url = URL.createObjectURL(updatedFiles[0])
      extractImageMetadata(updatedFiles[0], url)
        .then(async (metadata) => {
          // Upload file temporarily to extract EXIF data and prompt
          const formData = new FormData()
          formData.append('file', updatedFiles[0])

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
    const files = editImage.originalFiles

    if (files.length === 0) {
      setEditError('Please select at least one image first')
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

      // Append all files
      files.forEach((file) => {
        formData.append('files', file)
      })

      formData.append('prompt', editImage.prompt)
      formData.append('guidance_scale', '4.5')
      formData.append('num_inference_steps', String(editImage.numInferenceSteps ?? 28))
      formData.append('acceleration', 'regular')
      formData.append('output_format', editImage.outputFormat ?? 'png')
      if (editImage.negativePrompt) {
        formData.append('negative_prompt', editImage.negativePrompt)
      }
      formData.append('enable_safety_checker', String(editImage.enableSafetyChecker ?? true))
      if (editImage.seed) {
        formData.append('seed', editImage.seed)
      }
      formData.append('target_resolution', String(editImage.targetResolution ?? 1328))

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

  const handleFillClick = () => {
    if (!editImage.outputFilename) return
    sendToFill()
    navigate({ to: '/generative-fill', search: { filename: editImage.outputFilename } })
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name')
      return
    }

    try {
      await savePreset({
        name: presetName,
        prompt: editImage.prompt,
        numInferenceSteps: editImage.numInferenceSteps || 28,
        negativePrompt: editImage.negativePrompt,
        enableSafetyChecker: editImage.enableSafetyChecker !== false,
        outputFormat: editImage.outputFormat || 'png',
        seed: editImage.seed ? parseInt(editImage.seed) : undefined,
        targetResolution: editImage.targetResolution || 1328,
      })
      toast.success(`Preset "${presetName}" saved successfully`)
      setPresetName('')
      setShowSavePreset(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preset')
    }
  }

  const handleDeletePreset = async (presetId: number) => {
    try {
      await deletePreset(presetId)
      toast.success('Preset deleted successfully')
    } catch (err) {
      toast.error('Failed to delete preset')
    }
  }

  const handleApplyPreset = (presetId: number) => {
    const preset = presets.find((p) => p.id === presetId)
    if (preset) {
      applyPreset(preset)
      toast.success(`Applied preset "${preset.name}"`)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <InputCard title="Upload And Configure" description="Select an image to edit using AI">
          <div>
            <Label>Image Files ({editImage.originalFiles.length}/4 images)</Label>
            <Dropzone
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff'] }}
              src={editImage.originalFiles.length > 0 ? editImage.originalFiles : undefined}
              onDrop={handleFileDrop}
              className="mt-2"
              multiple
              maxFiles={4}
            >
              <DropzoneEmptyState />
              <DropzoneContent />
            </Dropzone>
            {editImage.originalFiles.length > 0 && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {editImage.originalFiles.length} image
                  {editImage.originalFiles.length > 1 ? 's' : ''} selected
                  {editImage.originalFiles.length < 4 &&
                    ` • Drop more to add (${4 - editImage.originalFiles.length} slot${
                      4 - editImage.originalFiles.length > 1 ? 's' : ''
                    } available)`}
                </p>
                <Button
                  onClick={() => {
                    setEditOriginalFiles([])
                    setEditOriginalMetadata(null)
                    setEditError(null)
                    // Clear the filename query parameter if it exists
                    if (search.filename) {
                      navigate({ to: '/edit', search: {} })
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Clear Images
                </Button>
              </div>
            )}
          </div>

          {(editImage.originalFiles.length > 0 || search.filename) && (
            <>
              <OriginalImagePreview
                file={editImage.originalFiles[0]}
                filename={search.filename}
                apiBaseUrl={API_BASE_URL}
              />

              {/* Show thumbnails of all uploaded files if multiple */}
              {editImage.originalFiles.length > 1 && (
                <div className="space-y-2">
                  <Label>Uploaded Images</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {editImage.originalFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden border"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Image ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                          Image {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Presets Section */}
              {presets.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="preset-select">Load Preset</Label>
                  <select
                    id="preset-select"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleApplyPreset(Number(e.target.value))
                        e.target.value = ''
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                    defaultValue=""
                  >
                    <option value="">Select a preset...</option>
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 flex-wrap">
                    {presets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-xs"
                      >
                        <span>{preset.name}</span>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="ml-1 hover:text-red-500 cursor-pointer"
                          title="Delete preset"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Parameters */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">Advanced Options</h3>

                {/* Negative Prompt */}
                <div>
                  <Label htmlFor="negative-prompt">Negative Prompt (optional)</Label>
                  <Textarea
                    id="negative-prompt"
                    value={editImage.negativePrompt || ''}
                    onChange={(e) => setEditNegativePrompt(e.target.value)}
                    placeholder="e.g., blurry, low quality"
                    className="mt-2 min-h-[60px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Describe what to avoid in the output
                  </p>
                </div>

                {/* Inference Steps */}
                <div>
                  <Label htmlFor="inference-steps">
                    Inference Steps: {editImage.numInferenceSteps}
                  </Label>
                  <input
                    id="inference-steps"
                    type="range"
                    min="1"
                    max="50"
                    value={editImage.numInferenceSteps || 28}
                    onChange={(e) => setEditNumInferenceSteps(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher values improve quality but take longer (1-50, default: 28)
                  </p>
                </div>

                {/* Target Resolution */}
                <div>
                  <Label htmlFor="target-resolution">
                    Target Resolution: {editImage.targetResolution || 1328}px
                  </Label>
                  <input
                    id="target-resolution"
                    type="range"
                    min="512"
                    max="1536"
                    step="64"
                    value={editImage.targetResolution || 1328}
                    onChange={(e) => setEditTargetResolution(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Image will be resized to this resolution before editing (512-1536, default:
                    1328)
                  </p>
                </div>

                {/* Output Format */}
                <div>
                  <Label htmlFor="output-format">Output Format</Label>
                  <select
                    id="output-format"
                    value={editImage.outputFormat || 'png'}
                    onChange={(e) => setEditOutputFormat(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border rounded-md bg-background text-foreground"
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                  </select>
                </div>

                {/* Enable Safety Checker */}
                <div className="flex items-center gap-2">
                  <input
                    id="safety-checker"
                    type="checkbox"
                    checked={editImage.enableSafetyChecker !== false}
                    onChange={(e) => setEditEnableSafetyChecker(e.target.checked)}
                    className="mt-2"
                  />
                  <Label htmlFor="safety-checker" className="mt-2">
                    Enable Safety Checker (filter NSFW content)
                  </Label>
                </div>

                {/* Seed */}
                <div>
                  <Label htmlFor="seed">Seed (optional)</Label>
                  <input
                    id="seed"
                    type="number"
                    value={editImage.seed || ''}
                    onChange={(e) => setEditSeed(e.target.value)}
                    placeholder="Leave empty for random seed"
                    className="w-full mt-2 px-3 py-2 border rounded-md"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the same seed to get reproducible results
                  </p>
                </div>
              </div>

              <Button
                onClick={handleEdit}
                disabled={!editImage.prompt.trim() || editImage.isEditing}
                className="w-full"
                size="lg"
              >
                Edit Image
              </Button>

              {/* Save Preset Section */}
              <div className="space-y-2 border-t pt-4">
                {!showSavePreset ? (
                  <Button
                    onClick={() => setShowSavePreset(true)}
                    variant="outline"
                    className="w-full"
                  >
                    Save Current Settings as Preset
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Enter preset name (e.g., 'Remove Text')"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    {existingPresetWithName && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        A preset with this name already exists. Saving will overwrite it.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={handleSavePreset} className="flex-1" size="sm">
                        {existingPresetWithName ? 'Update Preset' : 'Save Preset'}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowSavePreset(false)
                          setPresetName('')
                        }}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

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
          onFill={handleFillClick}
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

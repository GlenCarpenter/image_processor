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
  const presets = useImageStore((state) => state.presets)
  const loadPresets = useImageStore((state) => state.loadPresets)
  const savePreset = useImageStore((state) => state.savePreset)
  const deletePreset = useImageStore((state) => state.deletePreset)
  const applyPreset = useImageStore((state) => state.applyPreset)

  // Local state for parameters
  const [numInferenceSteps, setNumInferenceSteps] = useState(editImage.numInferenceSteps || 6)
  const [negativePrompt, setNegativePrompt] = useState(editImage.negativePrompt || '')
  const [enableSafetyChecker, setEnableSafetyChecker] = useState(
    editImage.enableSafetyChecker !== false
  )
  const [outputFormat, setOutputFormat] = useState(editImage.outputFormat || 'png')
  const [seed, setSeed] = useState(editImage.seed || '')
  const [presetName, setPresetName] = useState('')
  const [showSavePreset, setShowSavePreset] = useState(false)

  // Load presets on mount
  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // Update store when parameters change
  useEffect(() => {
    useImageStore.setState((s) => ({
      editImage: {
        ...s.editImage,
        numInferenceSteps,
        negativePrompt,
        enableSafetyChecker,
        outputFormat,
        seed,
      },
    }))
  }, [numInferenceSteps, negativePrompt, enableSafetyChecker, outputFormat, seed])

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
      formData.append('num_inference_steps', String(numInferenceSteps ?? 6))
      formData.append('acceleration', 'regular')
      formData.append('output_format', outputFormat ?? 'png')
      if (negativePrompt) {
        formData.append('negative_prompt', negativePrompt)
      }
      formData.append('enable_safety_checker', String(enableSafetyChecker ?? true))
      if (seed) {
        formData.append('seed', seed)
      }

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

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name')
      return
    }

    try {
      await savePreset({
        name: presetName,
        prompt: editImage.prompt,
        numInferenceSteps,
        negativePrompt,
        enableSafetyChecker,
        outputFormat,
        seed: seed ? parseInt(seed) : undefined,
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
      setNumInferenceSteps(preset.numInferenceSteps)
      setNegativePrompt(preset.negativePrompt || '')
      setEnableSafetyChecker(preset.enableSafetyChecker)
      setOutputFormat(preset.outputFormat)
      setSeed(preset.seed ? String(preset.seed) : '')
      toast.success(`Applied preset "${preset.name}"`)
    }
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
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="e.g., blurry, low quality"
                    className="mt-2 min-h-[60px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Describe what to avoid in the output
                  </p>
                </div>

                {/* Inference Steps */}
                <div>
                  <Label htmlFor="inference-steps">Inference Steps: {numInferenceSteps}</Label>
                  <input
                    id="inference-steps"
                    type="range"
                    min="1"
                    max="50"
                    value={numInferenceSteps}
                    onChange={(e) => setNumInferenceSteps(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher values improve quality but take longer (1-50, default: 50)
                  </p>
                </div>

                {/* Output Format */}
                <div>
                  <Label htmlFor="output-format">Output Format</Label>
                  <select
                    id="output-format"
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border rounded-md bg-background text-foreground"
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                  </select>
                </div>

                {/* Enable Safety Checker */}
                <div className="flex items-center gap-2">
                  <input
                    id="safety-checker"
                    type="checkbox"
                    checked={enableSafetyChecker}
                    onChange={(e) => setEnableSafetyChecker(e.target.checked)}
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
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
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
                disabled={editImage.isEditing || !editImage.prompt.trim()}
                className="w-full"
                size="lg"
              >
                {editImage.isEditing ? 'Editing Image...' : 'Edit Image'}
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
                    <div className="flex gap-2">
                      <Button onClick={handleSavePreset} className="flex-1" size="sm">
                        Save Preset
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

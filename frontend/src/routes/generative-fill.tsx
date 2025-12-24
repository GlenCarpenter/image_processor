import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dropzone, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useImageStore } from '@/store/imageStore'
import { extractImageMetadata } from '@/lib/imageUtils'
import { InputCard } from '@/components/input-card'
import { API_BASE_URL } from '@/lib/constants'
import { AdvancedMaskCanvas } from '@/components/advanced-mask-canvas'
import { ImageDetailDialog } from '@/components/image-detail-dialog'

type GenerativeFillSearch = {
  filename?: string
}

export const Route = createFileRoute('/generative-fill')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): GenerativeFillSearch => {
    return {
      filename: search.filename as string | undefined,
    }
  },
})

interface SDXLModel {
  name: string
  path: string
  filename: string
}

function RouteComponent() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  // Store actions
  const setFillOriginal = useImageStore((state) => state.setFillOriginal)
  const setFillResult = useImageStore((state) => state.setFillResult)
  const setFillPrompt = useImageStore((state) => state.setFillPrompt)
  const fillPrompt = useImageStore((state) => state.fillImage.prompt)
  const fillOriginal = useImageStore((state) => state.fillImage.originalFile)
  const fillResult = useImageStore((state) => state.fillImage.result)
  const fillEditing = useImageStore((state) => state.fillImage.editing)
  const fillError = useImageStore((state) => state.fillImage.error)
  const setFillEditing = useImageStore((state) => state.setFillEditing)
  const setFillError = useImageStore((state) => state.setFillError)
  const sendToSegment = useImageStore((state) => state.sendToSegment)
  const sendToUpscale = useImageStore((state) => state.sendToUpscale)
  const sendToEdit = useImageStore((state) => state.sendToEdit)
  const setFillMask = useImageStore((state) => state.setFillMask)
  const fillMask = useImageStore((state) => state.fillImage.maskFile)

  // Local state for fill-specific parameters
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [sdxlModels, setSdxlModels] = useState<SDXLModel[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [numSteps, setNumSteps] = useState(30)
  const [guidanceScale, setGuidanceScale] = useState(7.5)
  const [strength, setStrength] = useState(1.0)
  const [seed, setSeed] = useState<number | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resultFilename, setResultFilename] = useState<string | null>(null)
  const [resultMetadata, setResultMetadata] = useState<{
    outputWidth: number
    outputHeight: number
    outputPixels: number
  } | null>(null)

  // Load SDXL models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/fill/models`)
        const data = await response.json()
        if (data.success && data.models.length > 0) {
          setSdxlModels(data.models)
          setSelectedModel(data.models[0].name)
          toast.success(`Found ${data.models.length} SDXL model(s)`)
        } else {
          toast.error('No SDXL models found. Add *.safetensors files to sdxl/ directory')
        }
      } catch (error) {
        console.error('Failed to load models:', error)
        toast.error('Failed to load SDXL models')
      } finally {
        setLoadingModels(false)
      }
    }

    loadModels()
  }, [])

  // Load image from URL query param on mount
  useEffect(() => {
    if (search.filename && !fillOriginal) {
      const imageUrl = `${API_BASE_URL}/images/output/${search.filename}`

      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], search.filename!, { type: blob.type })
          setFillOriginal(file)
          setFillEditing(false)

          extractImageMetadata(file, imageUrl)
            .then(async (metadata) => {
              console.log('Image metadata:', metadata)
            })
            .catch((error) => {
              console.error('Failed to extract metadata:', error)
            })
        })
        .catch((error) => {
          console.error('Failed to load image:', error)
          toast.error('Failed to load image from history')
        })
    }
  }, [search.filename, fillOriginal, setFillOriginal, setFillEditing])

  const handleImageDrop = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0]
      setFillOriginal(file)
      setFillEditing(false)
      setFillError(null)
    }
  }

  const handleGenerativeFill = async () => {
    if (!fillOriginal) {
      toast.error('Please select an image first')
      return
    }

    if (!fillMask) {
      toast.error('Please select a mask image')
      return
    }

    if (!fillPrompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    if (!selectedModel) {
      toast.error('Please select a model')
      return
    }

    setFillEditing(true)
    setFillError(null)

    try {
      const formData = new FormData()
      formData.append('file', fillOriginal)
      formData.append('mask', fillMask)
      formData.append('prompt', fillPrompt)
      formData.append('model_name', selectedModel)
      formData.append('negative_prompt', negativePrompt)
      formData.append('num_inference_steps', numSteps.toString())
      formData.append('guidance_scale', guidanceScale.toString())
      formData.append('strength', strength.toString())
      if (seed !== null) {
        formData.append('seed', seed.toString())
      }

      const response = await fetch(`${API_BASE_URL}/fill/fill`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Fill failed')
      }

      const result = await response.json()
      const imageUrl = `${API_BASE_URL}/images/output/${result.filename}`

      const blob = await fetch(imageUrl).then((res) => res.blob())
      const resultFile = new File([blob], result.filename, { type: blob.type })

      setFillResult(resultFile)
      setResultFilename(result.filename)
      setResultMetadata({
        outputWidth: result.width,
        outputHeight: result.height,
        outputPixels: result.width * result.height,
      })
      toast.success('Generative fill completed successfully!')
      setDialogOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setFillError(message)
      toast.error(`Fill failed: ${message}`)
    } finally {
      setFillEditing(false)
    }
  }

  const handleSendToUpscale = () => {
    if (!resultFilename) return
    sendToUpscale()
    setDialogOpen(false)
    navigate({ to: '/upscale', search: { filename: resultFilename } })
  }

  const handleSendToResize = () => {
    if (!resultFilename) return
    setDialogOpen(false)
    navigate({ to: '/resize-image', search: { filename: resultFilename } })
  }

  const handleSendToSegment = () => {
    if (!resultFilename) return
    sendToSegment()
    setDialogOpen(false)
    navigate({ to: '/segment', search: { filename: resultFilename } })
  }

  const handleSendToEdit = () => {
    if (!resultFilename) return
    sendToEdit()
    setDialogOpen(false)
    navigate({ to: '/edit', search: { filename: resultFilename } })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Generative Fill</h1>
          <p className="text-muted-foreground">
            Fill masked regions of an image using SDXL models with text prompts
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column - Mask Creation Canvas */}
          <div className="space-y-6">
            {!fillOriginal ? (
              <InputCard
                title="Upload Image"
                description="Upload an image to create a mask and fill"
              >
                <Dropzone onDrop={handleImageDrop}>
                  <DropzoneEmptyState />
                </Dropzone>
              </InputCard>
            ) : !fillMask ? (
              <InputCard
                title="Create Mask"
                description="Draw, erase, or use AI segmentation to create your mask"
              >
                <AdvancedMaskCanvas
                  imageFile={fillOriginal}
                  onMaskCreated={(mask) => {
                    setFillMask(mask)
                    toast.success('Mask created successfully')
                  }}
                />
              </InputCard>
            ) : (
              <InputCard title="Image with Mask" description="White overlay shows fill areas">
                <div className="space-y-4">
                  <div className="relative w-full">
                    <img
                      src={URL.createObjectURL(fillOriginal)}
                      alt="Original"
                      className="w-full rounded-lg"
                    />
                    <img
                      src={URL.createObjectURL(fillMask)}
                      alt="Mask overlay"
                      className="absolute inset-0 w-full h-full rounded-lg"
                      style={{
                        mixBlendMode: 'lighten',
                        opacity: 0.3,
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setFillOriginal(null)
                        setFillResult(null)
                        setFillMask(null)
                      }}
                    >
                      Clear All
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setFillMask(null)}>
                      Edit Mask
                    </Button>
                  </div>
                </div>
              </InputCard>
            )}
          </div>

          {/* Right column - Parameters and Output */}
          <div className="space-y-6">
            {/* Model Selection */}
            <InputCard title="SDXL Model" description="Select the SDXL model to use">
              {loadingModels ? (
                <div className="text-center py-4 text-muted-foreground">Loading models...</div>
              ) : sdxlModels.length === 0 ? (
                <div className="text-center py-4 text-destructive">
                  <p className="text-sm mb-2">No SDXL models found</p>
                  <p className="text-xs">Add *.safetensors files to the sdxl/ directory</p>
                </div>
              ) : (
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sdxlModels.map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </InputCard>

            {/* Prompt */}
            <InputCard title="Prompt" description="Describe what to generate">
              <Textarea
                placeholder="Describe what you want to generate in the masked area..."
                value={fillPrompt}
                onChange={(e) => setFillPrompt(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </InputCard>

            {/* Negative Prompt */}
            <InputCard title="Negative Prompt (Optional)" description="Describe what to avoid">
              <Textarea
                placeholder="Describe what to avoid..."
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </InputCard>

            {/* Advanced Parameters */}
            <InputCard title="Advanced Parameters" description="Fine-tune generation settings">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">
                    Inference Steps: <span className="font-semibold">{numSteps}</span>
                  </Label>
                  <input
                    type="range"
                    min="20"
                    max="50"
                    value={numSteps}
                    onChange={(e) => setNumSteps(parseInt(e.target.value))}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    20-50 steps (more = better quality but slower)
                  </p>
                </div>

                <div>
                  <Label className="text-sm">
                    Guidance Scale:{' '}
                    <span className="font-semibold">{guidanceScale.toFixed(1)}</span>
                  </Label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={guidanceScale}
                    onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    7-15 recommended (higher = more prompt adherence)
                  </p>
                </div>

                <div>
                  <Label className="text-sm">
                    Strength: <span className="font-semibold">{strength.toFixed(2)}</span>
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={strength}
                    onChange={(e) => setStrength(parseFloat(e.target.value))}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    1.0 = full inpaint, lower = more preservation
                  </p>
                </div>

                <div>
                  <Label htmlFor="seed" className="text-sm">
                    Seed (Optional):
                  </Label>
                  <input
                    id="seed"
                    type="number"
                    value={seed ?? ''}
                    onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Random if empty"
                    className="w-full mt-2 px-3 py-2 border rounded-md text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for random results
                  </p>
                </div>
              </div>
            </InputCard>

            {/* Generate Button */}
            <Button
              onClick={handleGenerativeFill}
              disabled={
                fillEditing ||
                !fillOriginal ||
                !fillMask ||
                !selectedModel ||
                sdxlModels.length === 0
              }
              className="w-full py-6 text-lg"
            >
              {fillEditing ? 'Generating...' : 'Generate Fill'}
            </Button>

            {/* Output */}
            {fillResult && (
              <InputCard title="Generated Image" description="Your filled image">
                <div className="space-y-4">
                  <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                    <img
                      src={URL.createObjectURL(fillResult)}
                      alt="Generated result"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      const url = URL.createObjectURL(fillResult)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = fillResult.name
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    Download Result
                  </Button>
                </div>
              </InputCard>
            )}

            {/* Error Message */}
            {fillError && (
              <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                <p className="text-sm text-destructive">{fillError}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result Detail Dialog */}
      <ImageDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        filename={resultFilename}
        originalFilename={fillOriginal?.name || 'unknown'}
        title={resultFilename || 'Generated Image'}
        description="Generative Fill • Just now"
        onSendToUpscale={handleSendToUpscale}
        onSendToResize={handleSendToResize}
        onSendToSegment={handleSendToSegment}
        onSendToEdit={handleSendToEdit}
        metadata={resultMetadata || undefined}
      />
    </div>
  )
}

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

const SAMPLER_OPTIONS = [
  { value: '_default', label: 'Default (auto)', description: 'Uses model default sampler' },
  { value: 'DPMSolverMultistep', label: 'DPM++', description: 'Recommended - Best quality/speed' },
  { value: 'DDIM', label: 'DDIM', description: 'Fast and deterministic' },
  { value: 'EulerAncestralDiscrete', label: 'Euler A', description: 'Varied results' },
  { value: 'EulerDiscrete', label: 'Euler', description: 'Stable and deterministic' },
  { value: 'PNDM', label: 'PNDM', description: 'Balanced quality/speed' },
  { value: 'LMSDiscrete', label: 'LMS', description: 'Smooth results' },
  { value: 'LCM', label: 'LCM', description: 'Latent Consistency - Very fast' },
  { value: 'EDMEuler', label: 'EDM Euler', description: 'Exponential - High quality' },
] as const

const SCHEDULE_OPTIONS = [
  { value: '_default', label: 'Default', description: 'Standard noise schedule' },
  { value: 'karras', label: 'Karras', description: 'Improved noise schedule' },
  { value: 'exponential', label: 'Exponential', description: 'EDM-style exponential' },
] as const

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

interface LoRA {
  name: string
  path: string
  filename: string
}

interface LoRASelection {
  name: string
  scale: number
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
  const [selectedSampler, setSelectedSampler] = useState<string>('')
  const [selectedSchedule, setSelectedSchedule] = useState<string>('')
  const [availableLoras, setAvailableLoras] = useState<LoRA[]>([])
  const [loadingLoras, setLoadingLoras] = useState(true)
  const [selectedLoras, setSelectedLoras] = useState<LoRASelection[]>([])

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

  // Load LoRAs on mount
  useEffect(() => {
    const loadLoras = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/fill/loras`)
        const data = await response.json()
        if (data.success && data.loras.length > 0) {
          setAvailableLoras(data.loras)
          toast.success(`Found ${data.loras.length} LoRA(s)`)
        }
      } catch (error) {
        console.error('Failed to load LoRAs:', error)
        // Don't show error toast - LoRAs are optional
      } finally {
        setLoadingLoras(false)
      }
    }

    loadLoras()
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
      if (selectedSampler && selectedSampler !== '_default') {
        formData.append('sampler', selectedSampler)
      }
      if (selectedSchedule && selectedSchedule !== '_default') {
        formData.append('schedule', selectedSchedule)
      }
      if (selectedLoras.length > 0) {
        const loraNames = selectedLoras.map((l) => l.name).join(',')
        const loraScales = selectedLoras.map((l) => l.scale).join(',')
        formData.append('lora_names', loraNames)
        formData.append('lora_scales', loraScales)
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

            {/* Sampler Selection */}
            <InputCard title="Sampler (Optional)" description="Choose the sampling algorithm">
              <Select value={selectedSampler} onValueChange={setSelectedSampler}>
                <SelectTrigger>
                  <SelectValue placeholder="Default (auto)" />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLER_OPTIONS.map((sampler) => (
                    <SelectItem key={sampler.value} value={sampler.value}>
                      {sampler.label}
                      {sampler.description && (
                        <span className="text-muted-foreground"> - {sampler.description}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Different samplers affect generation quality and speed
              </p>
            </InputCard>

            {/* Schedule Selection */}
            <InputCard title="Schedule (Optional)" description="Choose the noise schedule">
              <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                <SelectTrigger>
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((schedule) => (
                    <SelectItem key={schedule.value} value={schedule.value}>
                      {schedule.label}
                      {schedule.description && (
                        <span className="text-muted-foreground"> - {schedule.description}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Noise schedule affects how denoising progresses
              </p>
            </InputCard>

            {/* LoRA Selection */}
            {!loadingLoras && availableLoras.length > 0 && (
              <InputCard
                title="LoRAs (Optional)"
                description="Customize style with Low-Rank Adaptations"
              >
                <div className="space-y-4">
                  {selectedLoras.length > 0 && (
                    <div className="space-y-2">
                      {selectedLoras.map((lora, index) => (
                        <div
                          key={index}
                          className="flex gap-2 items-center p-3 bg-muted rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{lora.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Label className="text-xs text-muted-foreground">Scale:</Label>
                              <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={lora.scale}
                                onChange={(e) => {
                                  const newLoras = [...selectedLoras]
                                  newLoras[index].scale = parseFloat(e.target.value)
                                  setSelectedLoras(newLoras)
                                }}
                                className="flex-1"
                              />
                              <span className="text-xs font-mono w-8">{lora.scale.toFixed(1)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLoras(selectedLoras.filter((_, i) => i !== index))
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && !selectedLoras.find((l) => l.name === value)) {
                        setSelectedLoras([...selectedLoras, { name: value, scale: 1.0 }])
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add LoRA..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLoras
                        .filter((lora) => !selectedLoras.find((l) => l.name === lora.name))
                        .map((lora) => (
                          <SelectItem key={lora.name} value={lora.name}>
                            {lora.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    LoRAs modify the model for specific styles. Scale: 0.5-1.2 recommended
                  </p>
                </div>
              </InputCard>
            )}

            {/* Advanced Parameters */}
            <InputCard title="Advanced Parameters" description="Fine-tune generation settings">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Inference Steps</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={numSteps}
                      onChange={(e) => setNumSteps(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={numSteps}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) {
                          setNumSteps(val)
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (isNaN(val) || val < 1) {
                          setNumSteps(1)
                        } else if (val > 100) {
                          setNumSteps(100)
                        }
                      }}
                      className="w-16 px-2 py-1 border rounded-md text-sm text-center"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    1-100 steps (more = better quality but slower)
                  </p>
                </div>

                <div>
                  <Label className="text-sm">Guidance Scale</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={guidanceScale}
                      onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="0.5"
                      value={guidanceScale}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) {
                          setGuidanceScale(val)
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value)
                        if (isNaN(val) || val < 1) {
                          setGuidanceScale(1)
                        } else if (val > 20) {
                          setGuidanceScale(20)
                        }
                      }}
                      className="w-16 px-2 py-1 border rounded-md text-sm text-center"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    7-15 recommended (higher = more prompt adherence)
                  </p>
                </div>

                <div>
                  <Label className="text-sm">Strength</Label>
                  <div className="flex gap-2 items-center mt-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={strength}
                      onChange={(e) => setStrength(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={strength}
                      onChange={(e) => {
                        const val = e.target.value
                        // Allow empty string and incomplete decimals while typing
                        if (val === '' || val === '.' || val === '0.') {
                          setStrength(parseFloat(val) || 0)
                        } else {
                          const parsed = parseFloat(val)
                          if (!isNaN(parsed)) {
                            setStrength(parsed)
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value)
                        if (isNaN(val) || val < 0) {
                          setStrength(0)
                        } else if (val > 1) {
                          setStrength(1)
                        }
                      }}
                      className="w-16 px-2 py-1 border rounded-md text-sm text-center"
                    />
                  </div>
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

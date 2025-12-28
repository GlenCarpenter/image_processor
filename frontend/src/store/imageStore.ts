import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { API_BASE_URL } from '@/lib/constants'

export interface ResizeInfo {
  originalWidth: number
  originalHeight: number
  targetWidth: number
  targetHeight: number
  aspectRatio: string
  originalPixels: number
  actualPixels: number
}

export interface UpscaleInfo {
  outputWidth: number
  outputHeight: number
  outputPixels: number
  fileSize: number
  upscaleMode: string
  upscaleFactor: number
}

export interface EditPreset {
  id: number
  name: string
  prompt: string
  numInferenceSteps: number
  negativePrompt?: string
  enableSafetyChecker: boolean
  outputFormat: string
  seed?: number
  targetResolution: number
  created_at: string
  updated_at: string
}

interface ImageState {
  // Home page image
  homeImage: {
    file: File | null
    url: string | null
  }

  // Resize page images
  resizeImage: {
    originalFile: File | null
    jobId: number | null
    outputFilename: string | null
    resizeInfo: ResizeInfo | null
  }

  // Upscale page images
  upscaleImage: {
    originalFile: File | null
    jobId: number | null
    outputFilename: string | null
    upscaleInfo: UpscaleInfo | null
    isUpscaling: boolean
    error: string | null
    originalMetadata: any | null
    resultMetadata: any | null
  }

  // Edit page image
  editImage: {
    originalFiles: File[] // Support multiple files (1-4)
    jobId: number | null
    outputFilename: string | null
    info: { outputWidth: number; outputHeight: number } | null
    prompt: string
    numInferenceSteps?: number
    negativePrompt?: string
    enableSafetyChecker?: boolean
    outputFormat?: string
    seed?: string
    targetResolution?: number
    isEditing: boolean
    error: string | null
    originalMetadata: any | null
    resultMetadata: any | null
  }

  // Generative fill page state
  fillImage: {
    originalFile: File | null
    maskFile: File | null
    result: File | null
    prompt: string
    editing: boolean
    error: string | null
  }

  // Segment page state
  segmentImage: {
    originalFile: File | null
    croppedFilename: string | null
    points: Array<{ x: number; y: number; label: number }>
    boxes: Array<{ x1: number; y1: number; x2: number; y2: number }>
    maskDataUrl: string | null
    cropPadding: number
    maskPadding: number
    aspectRatio: string
    sessionEnded: boolean
    isUploading: boolean
    isPredicting: boolean
    isCropping: boolean
    error: string | null
  }

  // Home page actions
  setHomeImage: (file: File | null, url: string | null) => void
  clearHomeImage: () => void

  // Resize page actions
  setResizeOriginal: (file: File | null) => void
  setResizeResult: (
    jobId: number | null,
    outputFilename: string | null,
    info: ResizeInfo | null
  ) => void
  clearResizeImages: () => void

  // Upscale page actions
  setUpscaleOriginal: (file: File | null) => void
  setUpscaleResult: (
    jobId: number | null,
    outputFilename: string | null,
    info: UpscaleInfo | null
  ) => void
  setUpscaleUpscaling: (loading: boolean) => void
  setUpscaleError: (error: string | null) => void
  setUpscaleOriginalMetadata: (metadata: any) => void
  setUpscaleResultMetadata: (metadata: any) => void
  clearUpscaleImages: () => void

  // Edit page actions
  setEditOriginal: (file: File | null) => void
  setEditOriginalFiles: (files: File[]) => void
  setEditResult: (
    jobId: number | null,
    outputFilename: string | null,
    info: { outputWidth: number; outputHeight: number } | null
  ) => void
  setEditPrompt: (prompt: string) => void
  setEditEditing: (loading: boolean) => void
  setEditError: (error: string | null) => void
  setEditOriginalMetadata: (metadata: any) => void
  setEditResultMetadata: (metadata: any) => void
  clearEditImages: () => void
  setEditImage: (
    jobId: number | null,
    outputFilename: string | null,
    info: ResizeInfo | null
  ) => void
  clearEditImage: () => void
  setEditNumInferenceSteps: (steps: number) => void
  setEditNegativePrompt: (prompt: string) => void
  setEditEnableSafetyChecker: (enabled: boolean) => void
  setEditOutputFormat: (format: string) => void
  setEditSeed: (seed: string) => void
  setEditTargetResolution: (resolution: number) => void

  // Fill page actions
  setFillOriginal: (file: File | null) => void
  setFillMask: (file: File | null) => void
  setFillResult: (file: File | null) => void
  setFillPrompt: (prompt: string) => void
  setFillEditing: (editing: boolean) => void
  setFillError: (error: string | null) => void
  clearFillImages: () => void

  // Segment page actions
  setSegmentOriginal: (file: File | null) => void
  setSegmentResult: (filename: string | null) => void
  setSegmentPoints: (points: Array<{ x: number; y: number; label: number }>) => void
  setSegmentBoxes: (boxes: Array<{ x1: number; y1: number; x2: number; y2: number }>) => void
  setSegmentMask: (maskDataUrl: string | null) => void
  setSegmentCropPadding: (padding: number) => void
  setSegmentMaskPadding: (maskPadding: number) => void
  setSegmentAspectRatio: (aspectRatio: string) => void
  setSegmentSessionEnded: (ended: boolean) => void
  setSegmentUploading: (loading: boolean) => void
  setSegmentPredicting: (loading: boolean) => void
  setSegmentCropping: (loading: boolean) => void
  setSegmentError: (error: string | null) => void
  clearSegmentImages: () => void

  // Transfer actions - simplified single functions
  sendToResize: () => void
  sendToEdit: () => void
  sendToUpscale: () => void
  sendToSegment: () => void
  sendToFill: () => void

  // Presets actions
  presets: EditPreset[]
  loadPresets: () => Promise<void>
  savePreset: (preset: Omit<EditPreset, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  deletePreset: (presetId: number) => Promise<void>
  applyPreset: (preset: EditPreset) => void
}

export const useImageStore = create<ImageState>()(
  devtools(
    (set, get) => ({
      // Initial state
      homeImage: {
        file: null,
        url: null,
      },
      segmentImage: {
        originalFile: null,
        croppedFilename: null,
        points: [],
        boxes: [],
        maskDataUrl: null,
        cropPadding: 0,
        maskPadding: 0,
        aspectRatio: 'None',
        sessionEnded: false,
        isUploading: false,
        isPredicting: false,
        isCropping: false,
        error: null,
      },
      presets: [],
      resizeImage: {
        originalFile: null,
        jobId: null,
        outputFilename: null,
        resizeInfo: null,
      },
      upscaleImage: {
        originalFile: null,
        jobId: null,
        outputFilename: null,
        upscaleInfo: null,
        isUpscaling: false,
        error: null,
        originalMetadata: null,
        resultMetadata: null,
      },
      editImage: {
        originalFiles: [],
        jobId: null,
        outputFilename: null,
        info: null,
        prompt: '',
        numInferenceSteps: 30,
        negativePrompt: '',
        enableSafetyChecker: true,
        outputFormat: 'png',
        seed: '',
        targetResolution: 1328,
        isEditing: false,
        error: null,
        originalMetadata: null,
        resultMetadata: null,
      },
      fillImage: {
        originalFile: null,
        maskFile: null,
        result: null,
        prompt: '',
        editing: false,
        error: null,
      },

      // Home page actions
      setHomeImage: (file, url) =>
        set({
          homeImage: { file, url },
        }),
      clearHomeImage: () =>
        set({
          homeImage: { file: null, url: null },
        }),

      // Resize page actions
      setResizeOriginal: (file) =>
        set({
          resizeImage: { ...get().resizeImage, originalFile: file },
        }),
      setResizeResult: (jobId, outputFilename, info) =>
        set({
          resizeImage: { ...get().resizeImage, jobId, outputFilename, resizeInfo: info },
        }),
      clearResizeImages: () =>
        set({
          resizeImage: {
            originalFile: null,
            jobId: null,
            outputFilename: null,
            resizeInfo: null,
          },
        }),

      // Upscale page actions
      setUpscaleOriginal: (file) =>
        set({
          upscaleImage: { ...get().upscaleImage, originalFile: file },
        }),
      setUpscaleResult: (jobId, outputFilename, info) =>
        set({
          upscaleImage: { ...get().upscaleImage, jobId, outputFilename, upscaleInfo: info },
        }),
      setUpscaleUpscaling: (loading) =>
        set((state) => ({ upscaleImage: { ...state.upscaleImage, isUpscaling: loading } })),
      setUpscaleError: (error) =>
        set((state) => ({ upscaleImage: { ...state.upscaleImage, error } })),
      setUpscaleOriginalMetadata: (metadata) =>
        set((state) => ({ upscaleImage: { ...state.upscaleImage, originalMetadata: metadata } })),
      setUpscaleResultMetadata: (metadata) =>
        set((state) => ({ upscaleImage: { ...state.upscaleImage, resultMetadata: metadata } })),
      clearUpscaleImages: () =>
        set({
          upscaleImage: {
            originalFile: null,
            jobId: null,
            outputFilename: null,
            upscaleInfo: null,
            isUpscaling: false,
            error: null,
            originalMetadata: null,
            resultMetadata: null,
          },
        }),

      // Edit page actions
      setEditOriginal: (file) =>
        set({
          editImage: { ...get().editImage, originalFiles: file ? [file] : [] },
        }),
      setEditOriginalFiles: (files) =>
        set({
          editImage: { ...get().editImage, originalFiles: files },
        }),
      setEditResult: (jobId, outputFilename, info) =>
        set({
          editImage: { ...get().editImage, jobId, outputFilename, info },
        }),
      setEditPrompt: (prompt) => set((state) => ({ editImage: { ...state.editImage, prompt } })),
      setEditEditing: (loading) =>
        set((state) => ({ editImage: { ...state.editImage, isEditing: loading } })),
      setEditError: (error) => set((state) => ({ editImage: { ...state.editImage, error } })),
      setEditOriginalMetadata: (metadata) =>
        set((state) => ({ editImage: { ...state.editImage, originalMetadata: metadata } })),
      setEditResultMetadata: (metadata) =>
        set((state) => ({ editImage: { ...state.editImage, resultMetadata: metadata } })),
      clearEditImages: () =>
        set({
          editImage: {
            originalFiles: [],
            jobId: null,
            outputFilename: null,
            info: null,
            prompt: '',
            isEditing: false,
            error: null,
            originalMetadata: null,
            resultMetadata: null,
          },
        }),
      setEditImage: (jobId, outputFilename, info) =>
        set({
          editImage: {
            ...get().editImage,
            jobId,
            outputFilename,
            info: info ? { outputWidth: info.targetWidth, outputHeight: info.targetHeight } : null,
          },
        }),
      clearEditImage: () =>
        set({
          editImage: {
            originalFiles: [],
            jobId: null,
            outputFilename: null,
            info: null,
            prompt: '',
            isEditing: false,
            error: null,
            originalMetadata: null,
            resultMetadata: null,
          },
        }),
      setEditNumInferenceSteps: (steps) =>
        set((state) => ({ editImage: { ...state.editImage, numInferenceSteps: steps } })),
      setEditNegativePrompt: (prompt) =>
        set((state) => ({ editImage: { ...state.editImage, negativePrompt: prompt } })),
      setEditEnableSafetyChecker: (enabled) =>
        set((state) => ({ editImage: { ...state.editImage, enableSafetyChecker: enabled } })),
      setEditOutputFormat: (format) =>
        set((state) => ({ editImage: { ...state.editImage, outputFormat: format } })),
      setEditSeed: (seed) => set((state) => ({ editImage: { ...state.editImage, seed } })),
      setEditTargetResolution: (resolution) =>
        set((state) => ({ editImage: { ...state.editImage, targetResolution: resolution } })),

      // Fill page actions
      setFillOriginal: (file) =>
        set((state) => ({ fillImage: { ...state.fillImage, originalFile: file } })),
      setFillMask: (file) =>
        set((state) => ({ fillImage: { ...state.fillImage, maskFile: file } })),
      setFillResult: (file) =>
        set((state) => ({ fillImage: { ...state.fillImage, result: file } })),
      setFillPrompt: (prompt) => set((state) => ({ fillImage: { ...state.fillImage, prompt } })),
      setFillEditing: (editing) => set((state) => ({ fillImage: { ...state.fillImage, editing } })),
      setFillError: (error) => set((state) => ({ fillImage: { ...state.fillImage, error } })),
      clearFillImages: () =>
        set({
          fillImage: {
            originalFile: null,
            maskFile: null,
            result: null,
            prompt: '',
            editing: false,
            error: null,
          },
        }),

      // Segment page actions
      setSegmentOriginal: (file) =>
        set((state) => ({
          segmentImage: { ...state.segmentImage, originalFile: file },
        })),
      setSegmentResult: (filename) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, croppedFilename: filename } })),
      setSegmentPoints: (points) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, points } })),
      setSegmentBoxes: (boxes) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, boxes } })),
      setSegmentMask: (maskDataUrl) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, maskDataUrl } })),
      setSegmentCropPadding: (cropPadding) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, cropPadding } })),
      setSegmentMaskPadding: (maskPadding) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, maskPadding } })),
      setSegmentAspectRatio: (aspectRatio) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, aspectRatio } })),
      setSegmentSessionEnded: (ended) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, sessionEnded: ended } })),
      setSegmentUploading: (loading) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, isUploading: loading } })),
      setSegmentPredicting: (loading) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, isPredicting: loading } })),
      setSegmentCropping: (loading) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, isCropping: loading } })),
      setSegmentError: (error) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, error } })),
      clearSegmentImages: () =>
        set({
          segmentImage: {
            originalFile: null,
            croppedFilename: null,
            points: [],
            boxes: [],
            maskDataUrl: null,
            cropPadding: 0,
            maskPadding: 0,
            aspectRatio: 'None',
            sessionEnded: false,
            isUploading: false,
            isPredicting: false,
            isCropping: false,
            error: null,
          },
        }),

      // Transfer actions - simplified, navigation passes filename via query params
      sendToResize: () => {
        const { homeImage } = get()
        // Transfer homeImage.file only when navigating from home
        // Other pages use filename query params and will load from server
        set({
          resizeImage: {
            originalFile: homeImage.file,
            jobId: null,
            outputFilename: null,
            resizeInfo: null,
          },
        })
        // Clear home image after transferring to prevent stale data
        if (homeImage.file) {
          set({ homeImage: { file: null, url: null } })
        }
      },
      sendToEdit: () => {
        set({
          editImage: {
            originalFiles: [],
            jobId: null,
            outputFilename: null,
            info: null,
            prompt: '',
            isEditing: false,
            error: null,
            originalMetadata: null,
            resultMetadata: null,
          },
        })
      },
      sendToUpscale: () => {
        const { homeImage } = get()
        // Transfer homeImage.file only when navigating from home
        // Other pages use filename query params and will load from server
        set({
          upscaleImage: {
            originalFile: homeImage.file,
            jobId: null,
            outputFilename: null,
            upscaleInfo: null,
            isUpscaling: false,
            error: null,
            originalMetadata: null,
            resultMetadata: null,
          },
        })
        // Clear home image after transferring to prevent stale data
        if (homeImage.file) {
          set({ homeImage: { file: null, url: null } })
        }
      },
      sendToSegment: () => {
        const { homeImage } = get()
        // Transfer homeImage.file only when navigating from home
        // Other pages use filename query params and will load from server
        set({
          segmentImage: {
            originalFile: homeImage.file,
            croppedFilename: null,
            points: [],
            boxes: [],
            maskDataUrl: null,
            cropPadding: 0,
            maskPadding: 0,
            aspectRatio: 'None',
            sessionEnded: false,
            isUploading: false,
            isPredicting: false,
            isCropping: false,
            error: null,
          },
        })
        // Clear home image after transferring to prevent stale data
        if (homeImage.file) {
          set({ homeImage: { file: null, url: null } })
        }
      },
      sendToFill: () => {
        // Clear fill state for new operation
        set({
          fillImage: {
            originalFile: null,
            maskFile: null,
            result: null,
            prompt: '',
            editing: false,
            error: null,
          },
        })
      },
      loadPresets: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/presets`)
          if (response.ok) {
            const apiPresets = await response.json()
            // Transform snake_case to camelCase
            const presets = apiPresets.map((p: any) => ({
              id: p.id,
              name: p.name,
              prompt: p.prompt,
              numInferenceSteps: p.num_inference_steps,
              negativePrompt: p.negative_prompt,
              enableSafetyChecker: p.enable_safety_checker,
              outputFormat: p.output_format,
              seed: p.seed,
              targetResolution: p.target_resolution,
              created_at: p.created_at,
              updated_at: p.updated_at,
            }))
            set({ presets })
          }
        } catch (error) {
          console.error('Failed to load presets:', error)
        }
      },
      savePreset: async (preset) => {
        try {
          const state = get()
          const existingPreset = state.presets.find((p) => p.name === preset.name)

          // Transform camelCase to snake_case for API
          const apiPayload = {
            name: preset.name,
            prompt: preset.prompt,
            num_inference_steps: preset.numInferenceSteps,
            negative_prompt: preset.negativePrompt,
            enable_safety_checker: preset.enableSafetyChecker,
            output_format: preset.outputFormat,
            seed: preset.seed,
            target_resolution: preset.targetResolution,
          }

          let response
          if (existingPreset) {
            // Update existing preset
            response = await fetch(`${API_BASE_URL}/presets/${existingPreset.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(apiPayload),
            })
          } else {
            // Create new preset
            response = await fetch(`${API_BASE_URL}/presets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(apiPayload),
            })
          }

          if (response.ok) {
            const savedPreset = await response.json()
            // Transform snake_case response to camelCase
            const transformedPreset = {
              id: savedPreset.id,
              name: savedPreset.name,
              prompt: savedPreset.prompt,
              numInferenceSteps: savedPreset.num_inference_steps,
              negativePrompt: savedPreset.negative_prompt,
              enableSafetyChecker: savedPreset.enable_safety_checker,
              outputFormat: savedPreset.output_format,
              seed: savedPreset.seed,
              targetResolution: savedPreset.target_resolution,
              created_at: savedPreset.created_at,
              updated_at: savedPreset.updated_at,
            }
            set((state) => {
              const filtered = state.presets.filter((p) => p.id !== transformedPreset.id)
              return {
                presets: [...filtered, transformedPreset].sort((a, b) => a.name.localeCompare(b.name)),
              }
            })
          } else {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to save preset')
          }
        } catch (error) {
          console.error('Failed to save preset:', error)
          throw error
        }
      },
      deletePreset: async (presetId: number) => {
        try {
          const response = await fetch(`${API_BASE_URL}/presets/${presetId}`, {
            method: 'DELETE',
          })
          if (response.ok) {
            set((state) => ({
              presets: state.presets.filter((p) => p.id !== presetId),
            }))
          } else {
            throw new Error('Failed to delete preset')
          }
        } catch (error) {
          console.error('Failed to delete preset:', error)
          throw error
        }
      },
      applyPreset: (preset) => {
        set((state) => ({
          editImage: {
            ...state.editImage,
            prompt: preset.prompt,
            numInferenceSteps: preset.numInferenceSteps,
            negativePrompt: preset.negativePrompt || '',
            enableSafetyChecker: preset.enableSafetyChecker,
            outputFormat: preset.outputFormat,
            seed: preset.seed ? String(preset.seed) : '',
            targetResolution: preset.targetResolution,
          },
        }))
      },
    }),
    { name: 'ImageStore' }
  )
)

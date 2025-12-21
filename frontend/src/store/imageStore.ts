import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

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
    originalFile: File | null
    jobId: number | null
    outputFilename: string | null
    info: { outputWidth: number; outputHeight: number } | null
    prompt: string
    isEditing: boolean
    error: string | null
    originalMetadata: any | null
    resultMetadata: any | null
  }

  // Segment page state
  segmentImage: {
    sessionId: string | null
    originalFile: File | null
    croppedFilename: string | null
    points: Array<{ x: number; y: number; label: number }>
    maskDataUrl: string | null
    padding: number
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

  // Segment page actions
  setSegmentSession: (sessionId: string | null) => void
  setSegmentOriginal: (file: File | null) => void
  setSegmentResult: (filename: string | null) => void
  setSegmentPoints: (points: Array<{ x: number; y: number; label: number }>) => void
  setSegmentMask: (maskDataUrl: string | null) => void
  setSegmentPadding: (padding: number) => void
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
        sessionId: null,
        originalFile: null,
        croppedFilename: null,
        points: [],
        maskDataUrl: null,
        padding: 10,
        aspectRatio: 'None',
        sessionEnded: false,
        isUploading: false,
        isPredicting: false,
        isCropping: false,
        error: null,
      },
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
        originalFile: null,
        jobId: null,
        outputFilename: null,
        info: null,
        prompt: '',
        isEditing: false,
        error: null,
        originalMetadata: null,
        resultMetadata: null,
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
          editImage: { ...get().editImage, originalFile: file },
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
            originalFile: null,
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
            originalFile: null,
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

      // Segment page actions
      setSegmentSession: (sessionId) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, sessionId } })),
      setSegmentOriginal: (file) =>
        set((state) => ({
          segmentImage: { ...state.segmentImage, originalFile: file },
        })),
      setSegmentResult: (filename) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, croppedFilename: filename } })),
      setSegmentPoints: (points) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, points } })),
      setSegmentMask: (maskDataUrl) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, maskDataUrl } })),
      setSegmentPadding: (padding) =>
        set((state) => ({ segmentImage: { ...state.segmentImage, padding } })),
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
            sessionId: null,
            originalFile: null,
            croppedFilename: null,
            points: [],
            maskDataUrl: null,
            padding: 10,
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
        set({
          resizeImage: {
            originalFile: homeImage.file,
            jobId: null,
            outputFilename: null,
            resizeInfo: null,
          },
        })
      },
      sendToEdit: () => {
        set({
          editImage: {
            originalFile: null,
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
      },
      sendToSegment: () => {
        const { homeImage } = get()
        set({
          segmentImage: {
            sessionId: null,
            originalFile: homeImage.file,
            croppedFilename: null,
            points: [],
            maskDataUrl: null,
            padding: 10,
            aspectRatio: 'None',
            sessionEnded: false,
            isUploading: false,
            isPredicting: false,
            isCropping: false,
            error: null,
          },
        })
      },
    }),
    { name: 'ImageStore' }
  )
)

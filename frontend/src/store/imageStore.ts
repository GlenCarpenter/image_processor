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
    originalUrl: string | null
    jobId: number | null
    outputFilename: string | null
    resizeInfo: ResizeInfo | null
  }

  // Upscale page images
  upscaleImage: {
    originalFile: File | null
    originalUrl: string | null
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
    jobId: number | null
    outputFilename: string | null
    info: ResizeInfo | null
  }

  // Segment page state
  segmentImage: {
    sessionId: string | null
    originalFile: File | null
    originalUrl: string | null
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
  setResizeOriginal: (file: File | null, url: string | null) => void
  setResizeResult: (
    jobId: number | null,
    outputFilename: string | null,
    info: ResizeInfo | null
  ) => void
  clearResizeImages: () => void

  // Upscale page actions
  setUpscaleOriginal: (file: File | null, url: string | null) => void
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
  setEditImage: (
    jobId: number | null,
    outputFilename: string | null,
    info: ResizeInfo | null
  ) => void
  clearEditImage: () => void

  // Segment page actions
  setSegmentSession: (sessionId: string | null) => void
  setSegmentOriginal: (file: File | null, url: string | null) => void
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

  // Transfer actions
  sendHomeToResize: () => void
  sendHomeToEdit: () => void
  sendHomeToUpscale: () => void
  sendHomeToSegment: () => void
  sendResizeToEdit: () => void
  sendResizeToUpscale: () => void
  sendResizeToSegment: () => void
  sendUpscaleToEdit: () => void
  sendEditToUpscale: () => void
  sendSegmentToUpscale: () => void
  sendSegmentToResize: () => void
  sendUpscaleToUpscale: () => void
  sendUpscaleToResize: () => void
  sendUpscaleToSegment: () => void
  sendSegmentToSegment: () => void
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
        originalUrl: null,
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
    originalUrl: null,
    jobId: null,
    outputFilename: null,
    resizeInfo: null,
  },
  upscaleImage: {
    originalFile: null,
    originalUrl: null,
    jobId: null,
    outputFilename: null,
    upscaleInfo: null,
    isUpscaling: false,
    error: null,
    originalMetadata: null,
    resultMetadata: null,
  },
  editImage: {
    jobId: null,
    outputFilename: null,
    info: null,
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
  setResizeOriginal: (file, url) =>
    set({
      resizeImage: { ...get().resizeImage, originalFile: file, originalUrl: url },
    }),
  setResizeResult: (jobId, outputFilename, info) =>
    set({
      resizeImage: { ...get().resizeImage, jobId, outputFilename, resizeInfo: info },
    }),
  clearResizeImages: () =>
    set({
      resizeImage: {
        originalFile: null,
        originalUrl: null,
        jobId: null,
        outputFilename: null,
        resizeInfo: null,
      },
    }),

  // Upscale page actions
  setUpscaleOriginal: (file, url) =>
    set({
      upscaleImage: { ...get().upscaleImage, originalFile: file, originalUrl: url },
    }),
  setUpscaleResult: (jobId, outputFilename, info) =>
    set({
      upscaleImage: { ...get().upscaleImage, jobId, outputFilename, upscaleInfo: info },
    }),
  setUpscaleUpscaling: (loading) =>
    set((state) => ({ upscaleImage: { ...state.upscaleImage, isUpscaling: loading } })),
  setUpscaleError: (error) => set((state) => ({ upscaleImage: { ...state.upscaleImage, error } })),
  setUpscaleOriginalMetadata: (metadata) =>
    set((state) => ({ upscaleImage: { ...state.upscaleImage, originalMetadata: metadata } })),
  setUpscaleResultMetadata: (metadata) =>
    set((state) => ({ upscaleImage: { ...state.upscaleImage, resultMetadata: metadata } })),
  clearUpscaleImages: () =>
    set({
      upscaleImage: {
        originalFile: null,
        originalUrl: null,
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
  setEditImage: (jobId, outputFilename, info) =>
    set({
      editImage: { jobId, outputFilename, info },
    }),
  clearEditImage: () =>
    set({
      editImage: { jobId: null, outputFilename: null, info: null },
    }),

  // Segment page actions
  setSegmentSession: (sessionId) =>
    set((state) => ({ segmentImage: { ...state.segmentImage, sessionId } })),
  setSegmentOriginal: (file, url) =>
    set((state) => ({
      segmentImage: { ...state.segmentImage, originalFile: file, originalUrl: url },
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
  setSegmentError: (error) => set((state) => ({ segmentImage: { ...state.segmentImage, error } })),
  clearSegmentImages: () =>
    set({
      segmentImage: {
        sessionId: null,
        originalFile: null,
        originalUrl: null,
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

  // Transfer actions
  sendHomeToResize: () => {
    const { homeImage } = get()
    set({
      resizeImage: {
        originalFile: homeImage.file,
        originalUrl: homeImage.url,
        jobId: null,
        outputFilename: null,
        resizeInfo: null,
      },
    })
  },
  sendHomeToEdit: () => {
    set({
      editImage: {
        jobId: null,
        outputFilename: null,
        info: null,
      },
    })
  },
  sendHomeToUpscale: () => {
    const { homeImage } = get()
    set({
      upscaleImage: {
        originalFile: homeImage.file,
        originalUrl: homeImage.url,
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
  sendHomeToSegment: () => {
    const { homeImage } = get()
    set({
      segmentImage: {
        sessionId: null,
        originalFile: homeImage.file,
        originalUrl: homeImage.url,
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
  sendResizeToEdit: () => {
    const { resizeImage } = get()
    set({
      editImage: {
        jobId: resizeImage.jobId,
        outputFilename: resizeImage.outputFilename,
        info: resizeImage.resizeInfo,
      },
    })
  },
  sendResizeToUpscale: () => {
    const { resizeImage } = get()
    set({
      upscaleImage: {
        originalFile: null,
        originalUrl: resizeImage.outputFilename
          ? `http://localhost:8000/api/images/output/${resizeImage.outputFilename}`
          : null,
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
  sendResizeToSegment: () => {
    const { resizeImage } = get()
    set({
      segmentImage: {
        sessionId: null,
        originalFile: null,
        originalUrl: resizeImage.outputFilename
          ? `http://localhost:8000/api/images/output/${resizeImage.outputFilename}`
          : null,
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
  sendUpscaleToEdit: () => {
    const { upscaleImage } = get()
    set({
      editImage: {
        jobId: upscaleImage.jobId,
        outputFilename: upscaleImage.outputFilename,
        info: null, // Upscale info structure is different
      },
    })
  },
  sendEditToUpscale: () => {
    const { editImage } = get()
    set({
      upscaleImage: {
        originalFile: null,
        originalUrl: null,
        jobId: editImage.jobId,
        outputFilename: editImage.outputFilename,
        upscaleInfo: null,
        isUpscaling: false,
        error: null,
        originalMetadata: null,
        resultMetadata: null,
      },
    })
  },
  sendSegmentToUpscale: () => {
    const { segmentImage } = get()
    set({
      upscaleImage: {
        originalFile: null,
        originalUrl: segmentImage.croppedFilename
          ? `http://localhost:8000/api/images/output/${segmentImage.croppedFilename}`
          : null,
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
  sendSegmentToResize: () => {
    const { segmentImage } = get()
    set({
      resizeImage: {
        originalFile: null,
        originalUrl: segmentImage.croppedFilename
          ? `http://localhost:8000/api/images/output/${segmentImage.croppedFilename}`
          : null,
        jobId: null,
        outputFilename: null,
        resizeInfo: null,
      },
    })
  },
  sendUpscaleToUpscale: () => {
    const { upscaleImage } = get()
    set({
      upscaleImage: {
        originalFile: null,
        originalUrl: upscaleImage.outputFilename
          ? `http://localhost:8000/api/images/output/${upscaleImage.outputFilename}`
          : null,
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
  sendUpscaleToResize: () => {
    const { upscaleImage } = get()
    set({
      resizeImage: {
        originalFile: null,
        originalUrl: upscaleImage.outputFilename
          ? `http://localhost:8000/api/images/output/${upscaleImage.outputFilename}`
          : null,
        jobId: null,
        outputFilename: null,
        resizeInfo: null,
      },
    })
  },
  sendUpscaleToSegment: () => {
    const { upscaleImage } = get()
    set({
      segmentImage: {
        sessionId: null,
        originalFile: null,
        originalUrl: upscaleImage.outputFilename
          ? `http://localhost:8000/api/images/output/${upscaleImage.outputFilename}`
          : null,
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
  sendSegmentToSegment: () => {
    const { segmentImage } = get()
    set({
      segmentImage: {
        sessionId: null,
        originalFile: null,
        originalUrl: segmentImage.croppedFilename
          ? `http://localhost:8000/api/images/output/${segmentImage.croppedFilename}`
          : null,
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

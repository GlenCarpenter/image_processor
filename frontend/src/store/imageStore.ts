import { create } from 'zustand'

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
  }

  // Edit page image
  editImage: {
    jobId: number | null
    outputFilename: string | null
    info: ResizeInfo | null
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
  clearUpscaleImages: () => void

  // Edit page actions
  setEditImage: (
    jobId: number | null,
    outputFilename: string | null,
    info: ResizeInfo | null
  ) => void
  clearEditImage: () => void

  // Transfer actions
  sendHomeToResize: () => void
  sendHomeToEdit: () => void
  sendResizeToEdit: () => void
  sendUpscaleToEdit: () => void
  sendEditToUpscale: () => void
}

export const useImageStore = create<ImageState>()((set, get) => ({
  // Initial state
  homeImage: {
    file: null,
    url: null,
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
  clearUpscaleImages: () =>
    set({
      upscaleImage: {
        originalFile: null,
        originalUrl: null,
        jobId: null,
        outputFilename: null,
        upscaleInfo: null,
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
    const { homeImage } = get()
    set({
      editImage: {
        jobId: null,
        outputFilename: null,
        info: null,
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
      },
    })
  },
}))

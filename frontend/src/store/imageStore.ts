import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ResizeInfo {
  originalWidth: number
  originalHeight: number
  targetWidth: number
  targetHeight: number
  aspectRatio: string
  originalPixels: number
  actualPixels: number
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
    resizedUrl: string | null
    resizeInfo: ResizeInfo | null
  }

  // Edit page image
  editImage: {
    url: string | null
    info: ResizeInfo | null
  }

  // Home page actions
  setHomeImage: (file: File | null, url: string | null) => void
  clearHomeImage: () => void

  // Resize page actions
  setResizeOriginal: (file: File | null, url: string | null) => void
  setResizeResult: (url: string | null, info: ResizeInfo | null) => void
  clearResizeImages: () => void

  // Edit page actions
  setEditImage: (url: string | null, info: ResizeInfo | null) => void
  clearEditImage: () => void

  // Transfer actions
  sendHomeToResize: () => void
  sendHomeToEdit: () => void
  sendResizeToEdit: () => void
}

export const useImageStore = create<ImageState>()(
  persist(
    (set, get) => ({
      // Initial state
      homeImage: {
        file: null,
        url: null,
      },
      resizeImage: {
        originalFile: null,
        originalUrl: null,
        resizedUrl: null,
        resizeInfo: null,
      },
      editImage: {
        url: null,
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
      setResizeResult: (url, info) =>
        set({
          resizeImage: { ...get().resizeImage, resizedUrl: url, resizeInfo: info },
        }),
      clearResizeImages: () =>
        set({
          resizeImage: {
            originalFile: null,
            originalUrl: null,
            resizedUrl: null,
            resizeInfo: null,
          },
        }),

      // Edit page actions
      setEditImage: (url, info) =>
        set({
          editImage: { url, info },
        }),
      clearEditImage: () =>
        set({
          editImage: { url: null, info: null },
        }),

      // Transfer actions
      sendHomeToResize: () => {
        const { homeImage } = get()
        set({
          resizeImage: {
            originalFile: homeImage.file,
            originalUrl: homeImage.url,
            resizedUrl: null,
            resizeInfo: null,
          },
        })
      },
      sendHomeToEdit: () => {
        const { homeImage } = get()
        set({
          editImage: {
            url: homeImage.url,
            info: null,
          },
        })
      },
      sendResizeToEdit: () => {
        const { resizeImage } = get()
        set({
          editImage: {
            url: resizeImage.resizedUrl || resizeImage.originalUrl,
            info: resizeImage.resizeInfo,
          },
        })
      },
    }),
    {
      name: 'image-store',
      // Persist URLs and info, but not File objects
      partialize: (state) => ({
        homeImage: { file: null, url: state.homeImage.url },
        resizeImage: {
          originalFile: null,
          originalUrl: state.resizeImage.originalUrl,
          resizedUrl: state.resizeImage.resizedUrl,
          resizeInfo: state.resizeImage.resizeInfo,
        },
        editImage: state.editImage,
      }),
    }
  )
)

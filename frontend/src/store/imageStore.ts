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
  // Current image being worked on
  selectedFile: File | null
  originalImageUrl: string | null
  resizedImageUrl: string | null
  resizeInfo: ResizeInfo | null

  // Actions
  setSelectedFile: (file: File | null) => void
  setOriginalImageUrl: (url: string | null) => void
  setResizedImageUrl: (url: string | null) => void
  setResizeInfo: (info: ResizeInfo | null) => void
  clearImages: () => void
}

export const useImageStore = create<ImageState>()(
  persist(
    (set) => ({
      // Initial state
      selectedFile: null,
      originalImageUrl: null,
      resizedImageUrl: null,
      resizeInfo: null,

      // Actions
      setSelectedFile: (file) => set({ selectedFile: file }),
      setOriginalImageUrl: (url) => set({ originalImageUrl: url }),
      setResizedImageUrl: (url) => set({ resizedImageUrl: url }),
      setResizeInfo: (info) => set({ resizeInfo: info }),
      clearImages: () =>
        set({
          selectedFile: null,
          originalImageUrl: null,
          resizedImageUrl: null,
          resizeInfo: null,
        }),
    }),
    {
      name: 'image-store', // unique name for localStorage key
      // Only persist URLs and info, not the File object (can't serialize)
      partialize: (state) => ({
        originalImageUrl: state.originalImageUrl,
        resizedImageUrl: state.resizedImageUrl,
        resizeInfo: state.resizeInfo,
      }),
    }
  )
)

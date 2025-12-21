/**
 * Global job tracking hook
 * Monitors all active jobs and provides toast notifications when they complete
 */

import { useEffect, useCallback, useRef } from 'react'
import { useImageStore } from '@/store/imageStore'
import { API_BASE_URL } from '@/lib/constants'
import { extractImageMetadata } from '@/lib/imageUtils'

interface Job {
  id: number
  job_type: string
  job_status: string
  output_filename: string | null
  output_width: number | null
  output_height: number | null
  output_pixels: number | null
  error_message: string | null
}

export function useGlobalJobTracker() {
  const trackedJobs = useRef<Set<number>>(new Set())
  const pollInterval = useRef<number | null>(null)

  // Store actions
  const setUpscaleResult = useImageStore((state) => state.setUpscaleResult)
  const setUpscaleUpscaling = useImageStore((state) => state.setUpscaleUpscaling)
  const setUpscaleError = useImageStore((state) => state.setUpscaleError)
  const setUpscaleResultMetadata = useImageStore((state) => state.setUpscaleResultMetadata)
  const setEditResult = useImageStore((state) => state.setEditResult)
  const setEditEditing = useImageStore((state) => state.setEditEditing)
  const setEditError = useImageStore((state) => state.setEditError)
  const setEditResultMetadata = useImageStore((state) => state.setEditResultMetadata)

  const handleJobCompletion = useCallback(
    async (job: Job) => {
      if (job.job_status === 'completed' && job.output_filename) {
        // Show success notification
        showNotification(
          'Job Completed',
          `${job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)} completed successfully!`
        )

        // Extract metadata from the output image
        try {
          const imageUrl = `${API_BASE_URL}/images/output/${job.output_filename}`
          const response = await fetch(imageUrl)
          const blob = await response.blob()
          const file = new File([blob], job.output_filename, { type: blob.type })

          const metadata = await extractImageMetadata(file, imageUrl)

          // Update store based on job type
          if (job.job_type === 'upscale') {
            const info = {
              outputWidth: job.output_width || 0,
              outputHeight: job.output_height || 0,
              outputPixels: job.output_pixels || 0,
              fileSize: 0, // Not available from API
              upscaleMode: 'factor',
              upscaleFactor: 2,
            }
            setUpscaleResult(job.id, job.output_filename, info)
            setUpscaleResultMetadata(metadata)
            setUpscaleUpscaling(false)
          } else if (job.job_type === 'edit') {
            const info = {
              outputWidth: job.output_width || 0,
              outputHeight: job.output_height || 0,
            }
            setEditResult(job.id, job.output_filename, info)
            setEditResultMetadata(metadata)
            setEditEditing(false)
          }
        } catch (error) {
          console.error('Failed to extract metadata:', error)
          // Still update the result even if metadata fails
          if (job.job_type === 'upscale') {
            const info = {
              outputWidth: job.output_width || 0,
              outputHeight: job.output_height || 0,
              outputPixels: job.output_pixels || 0,
              fileSize: 0,
              upscaleMode: 'factor',
              upscaleFactor: 2,
            }
            setUpscaleResult(job.id, job.output_filename, info)
            setUpscaleUpscaling(false)
          } else if (job.job_type === 'edit') {
            const info = {
              outputWidth: job.output_width || 0,
              outputHeight: job.output_height || 0,
            }
            setEditResult(job.id, job.output_filename, info)
            setEditEditing(false)
          }
        }
      } else if (job.job_status === 'failed') {
        // Show error notification
        showNotification(
          'Job Failed',
          job.error_message || `${job.job_type} job failed`,
          'error'
        )

        // Update store with error
        if (job.job_type === 'upscale') {
          setUpscaleError(job.error_message || 'Job failed')
          setUpscaleUpscaling(false)
        } else if (job.job_type === 'edit') {
          setEditError(job.error_message || 'Job failed')
          setEditEditing(false)
        }
      }
    },
    [
      setUpscaleResult,
      setUpscaleUpscaling,
      setUpscaleError,
      setUpscaleResultMetadata,
      setEditResult,
      setEditEditing,
      setEditError,
      setEditResultMetadata,
    ]
  )

  const showNotification = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    // Simple browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message })
    } else {
      // Fallback to console log
      console.log(`[${type.toUpperCase()}] ${title}: ${message}`)
    }
  }

  const checkJobs = useCallback(async () => {
    try {
      // Get all active jobs
      const response = await fetch(`${API_BASE_URL}/jobs/active`)
      if (!response.ok) return

      const data = await response.json()
      const activeJobs: Job[] = data.jobs || []

      // Check each active job
      for (const job of activeJobs) {
        if (!trackedJobs.current.has(job.id)) {
          trackedJobs.current.add(job.id)
        }

        // If job is no longer active, check its final status
        if (!['pending', 'processing', 'queued'].includes(job.job_status)) {
          // Job completed or failed
          handleJobCompletion(job)
          trackedJobs.current.delete(job.id)
        }
      }

      // Also check individual tracked jobs for status updates
      for (const jobId of trackedJobs.current) {
        const jobResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}`)
        if (jobResponse.ok) {
          const jobData = await jobResponse.json()
          const job: Job = jobData.job

          if (!['pending', 'processing', 'queued'].includes(job.job_status)) {
            handleJobCompletion(job)
            trackedJobs.current.delete(job.id)
          }
        }
      }
    } catch (error) {
      console.error('Error checking jobs:', error)
    }
  }, [handleJobCompletion])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Start polling
  useEffect(() => {
    pollInterval.current = setInterval(checkJobs, 5000) // Check every 5 seconds

    // Initial check
    checkJobs()

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current)
      }
    }
  }, [checkJobs])

  // Manually track a job
  const trackJob = useCallback((jobId: number) => {
    trackedJobs.current.add(jobId)
  }, [])

  return { trackJob }
}

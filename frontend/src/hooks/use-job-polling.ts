/**
 * Hook for polling async Fal jobs
 */

import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '@/lib/constants'

export interface Job {
  id: number
  job_type: string
  job_status: string
  fal_request_id: string | null
  output_filename: string | null
  output_path: string | null
  output_width: number | null
  output_height: number | null
  output_pixels: number | null
  original_filename: string
  original_width: number | null
  original_height: number | null
  error_message: string | null
  created_at: string
  updated_at: string
  metadata: string | null
}

export interface UseJobPollingOptions {
  jobId: number | null
  enabled?: boolean
  onComplete?: (job: Job) => void
  onError?: (error: string) => void
  pollInterval?: number
}

export function useJobPolling({
  jobId,
  enabled = true,
  onComplete,
  onError,
  pollInterval = 5000,
}: UseJobPollingOptions) {
  const [job, setJob] = useState<Job | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollJob = useCallback(async () => {
    if (!jobId || !enabled) return

    try {
      // Just get the job status - backend is polling Fal automatically
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`)

      if (!response.ok) {
        throw new Error('Failed to get job status')
      }

      const data = await response.json()
      const updatedJob = data.job as Job

      setJob(updatedJob)

      // Check if job is completed or failed
      if (updatedJob.job_status === 'completed') {
        setIsPolling(false)
        onComplete?.(updatedJob)
      } else if (updatedJob.job_status === 'failed') {
        setIsPolling(false)
        const errorMsg = updatedJob.error_message || 'Job failed'
        setError(errorMsg)
        onError?.(errorMsg)
      }
    } catch (err) {
      console.error('Error polling job:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to poll job'
      setError(errorMsg)
      onError?.(errorMsg)
      setIsPolling(false)
    }
  }, [jobId, enabled, onComplete, onError])

  // Start polling when jobId changes and is valid
  useEffect(() => {
    if (!jobId || !enabled) {
      setIsPolling(false)
      return
    }

    setIsPolling(true)
    setError(null)

    // Poll immediately
    pollJob()

    // Set up polling interval
    const intervalId = setInterval(pollJob, pollInterval)

    return () => {
      clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, enabled, pollInterval])

  return {
    job,
    isPolling,
    error,
    pollJob,
  }
}

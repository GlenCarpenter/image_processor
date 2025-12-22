import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ImageDetailDialog } from '@/components/image-detail-dialog'
import { useImageStore } from '@/store/imageStore'
import { Loader2, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react'
import { API_BASE_URL } from '@/lib/constants'

export const Route = createFileRoute('/jobs')({
  component: RouteComponent,
})

interface Job {
  id: number
  job_type: string
  job_status: string
  fal_request_id: string | null
  output_filename: string | null
  original_filename: string
  error_message: string | null
  created_at: string
  updated_at: string
  output_width: number | null
  output_height: number | null
}

function RouteComponent() {
  const navigate = useNavigate()
  const sendToUpscale = useImageStore((state) => state.sendToUpscale)
  const sendToResize = useImageStore((state) => state.sendToResize)
  const sendToSegment = useImageStore((state) => state.sendToSegment)
  const sendToEdit = useImageStore((state) => state.sendToEdit)

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs?limit=100`)
      if (!response.ok) throw new Error('Failed to fetch jobs')

      const data = await response.json()
      setJobs(data.jobs || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
    } finally {
      setLoading(false)
    }
  }

  const clearJobs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to clear jobs')

      setJobs([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear jobs')
    }
  }

  useEffect(() => {
    fetchJobs()

    if (autoRefresh) {
      const interval = setInterval(fetchJobs, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'processing':
      case 'queued':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      failed: 'destructive',
      processing: 'secondary',
      queued: 'secondary',
      pending: 'outline',
    }

    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    )
  }

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A'

    // SQLite CURRENT_TIMESTAMP returns UTC time without 'Z' suffix
    // Add 'Z' to parse as UTC, or handle as-is if it already has timezone info
    const dateStr =
      dateString.includes('Z') ||
        dateString.includes('+') ||
        (dateString.includes('T') && dateString.split('T')[1].includes('-'))
        ? dateString
        : dateString.replace(' ', 'T') + 'Z'

    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (seconds < 0) return 'just now' // Handle future dates
    if (seconds < 60) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleString()
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setDialogOpen(true)
  }

  const handleSendToResize = () => {
    if (!selectedJob || !selectedJob.output_filename) return
    sendToResize()
    setDialogOpen(false)
    navigate({ to: '/resize-image', search: { filename: selectedJob.output_filename } })
  }

  const handleSendToUpscale = () => {
    if (!selectedJob || !selectedJob.output_filename) return
    sendToUpscale()
    setDialogOpen(false)
    navigate({ to: '/upscale', search: { filename: selectedJob.output_filename } })
  }

  const handleSendToSegment = () => {
    if (!selectedJob || !selectedJob.output_filename) return
    sendToSegment()
    setDialogOpen(false)
    navigate({ to: '/segment', search: { filename: selectedJob.output_filename } })
  }

  const handleSendToEdit = () => {
    if (!selectedJob || !selectedJob.output_filename) return
    sendToEdit()
    setDialogOpen(false)
    navigate({ to: '/edit', search: { filename: selectedJob.output_filename } })
  }

  const activeJobs = jobs.filter((job) =>
    ['pending', 'processing', 'queued'].includes(job.job_status)
  )
  const completedJobs = jobs.filter((job) => job.job_status === 'completed')
  const failedJobs = jobs.filter((job) => job.job_status === 'failed')

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Job Queue</CardTitle>
              <CardDescription>Track your image processing jobs</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
                {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
              </Button>
              <Button variant="outline" size="sm" onClick={fetchJobs}>
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={clearJobs}
                disabled={jobs.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
              {error}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No jobs yet. Upload and process an image to see jobs here.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{jobs.length}</div>
                    <p className="text-xs text-muted-foreground">Total Jobs</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-500">{activeJobs.length}</div>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-500">{completedJobs.length}</div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-500">{failedJobs.length}</div>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </CardContent>
                </Card>
              </div>

              {/* Job List */}
              <div className="space-y-2">
                {jobs.map((job) => (
                  <Card
                    key={job.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleJobClick(job)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(job.job_status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">#{job.id}</span>
                              <Badge variant="outline" className="text-xs">
                                {job.job_type}
                              </Badge>
                              {getStatusBadge(job.job_status)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {job.original_filename}
                              {job.output_filename && <span> → {job.output_filename}</span>}
                            </div>
                            {job.output_width && job.output_height && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Output: {job.output_width} × {job.output_height}
                              </div>
                            )}
                            {job.error_message && (
                              <div className="text-xs text-red-500 mt-1">
                                Error: {job.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Created {formatDate(job.created_at)}
                          </div>
                          {job.created_at !== job.updated_at && (
                            <div className="text-xs text-muted-foreground">
                              Updated {formatDate(job.updated_at)}
                            </div>
                          )}
                          {job.output_filename && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 mt-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (job.output_filename) {
                                  const link = document.createElement('a')
                                  link.href = `${API_BASE_URL}/images/output/${job.output_filename}/download`
                                  link.download = job.output_filename
                                  document.body.appendChild(link)
                                  link.click()
                                  document.body.removeChild(link)
                                }
                              }}
                            >
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Detail Dialog */}
      <ImageDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        filename={selectedJob?.output_filename || null}
        originalFilename={selectedJob?.original_filename || ''}
        title={selectedJob?.original_filename || ''}
        description={
          selectedJob
            ? `${selectedJob.job_type.charAt(0).toUpperCase() + selectedJob.job_type.slice(1)} • ${selectedJob.job_status}`
            : ''
        }
        onSendToUpscale={handleSendToUpscale}
        onSendToResize={handleSendToResize}
        onSendToSegment={handleSendToSegment}
        onSendToEdit={handleSendToEdit}
        status={
          selectedJob?.job_status === 'completed'
            ? 'completed'
            : selectedJob?.job_status === 'failed'
              ? 'failed'
              : 'processing'
        }
        errorMessage={selectedJob?.error_message}
      />
    </div>
  )
}

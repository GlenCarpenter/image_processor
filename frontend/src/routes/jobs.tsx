import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useImageStore } from '@/store/imageStore'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Download,
  ArrowUpCircle,
  Expand,
  Scissors,
  Pencil,
} from 'lucide-react'
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

  const formatDate = (dateString: string) => {
    // SQLite CURRENT_TIMESTAMP returns UTC time without 'Z' suffix
    // Add 'Z' to parse as UTC, or handle as-is if it already has timezone info
    const dateStr = dateString.includes('Z') || dateString.includes('+') || dateString.includes('T') && dateString.split('T')[1].includes('-')
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
              <CardDescription>
                Track your image processing jobs
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
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
                              {job.output_filename && (
                                <span> → {job.output_filename}</span>
                              )}
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="break-all overflow-wrap-anywhere max-w-full">
                  Job #{selectedJob.id} - {selectedJob.original_filename}
                </DialogTitle>
                <DialogDescription>
                  {selectedJob.job_type.charAt(0).toUpperCase() + selectedJob.job_type.slice(1)} •{' '}
                  {getStatusBadge(selectedJob.job_status)} • Created {formatDate(selectedJob.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 flex-1 overflow-auto">
                {selectedJob.output_filename ? (
                  <div className="w-full h-[60vh] overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                    <img
                      src={`${API_BASE_URL}/images/output/${selectedJob.output_filename}`}
                      alt={selectedJob.original_filename}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-full h-[60vh] overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      {selectedJob.job_status === 'failed' ? (
                        <div>
                          <XCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
                          <p>Job Failed</p>
                          {selectedJob.error_message && (
                            <p className="text-sm mt-2 text-red-500">{selectedJob.error_message}</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin" />
                          <p>Processing...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Job Type:</span>
                    <p className="font-medium capitalize">{selectedJob.job_type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1">{getStatusBadge(selectedJob.job_status)}</div>
                  </div>
                  {selectedJob.output_width && selectedJob.output_height && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Output Size:</span>
                        <p className="font-medium">
                          {selectedJob.output_width} × {selectedJob.output_height}
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="font-medium">{formatDate(selectedJob.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated:</span>
                    <p className="font-medium">{formatDate(selectedJob.updated_at)}</p>
                  </div>
                  {selectedJob.fal_request_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Request ID:</span>
                      <p className="font-mono text-xs break-all">{selectedJob.fal_request_id}</p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {selectedJob.output_filename && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const link = document.createElement('a')
                        link.href = `${API_BASE_URL}/images/output/${selectedJob.output_filename}/download`
                        link.download = selectedJob.output_filename || 'image'
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }}
                      className="w-full sm:w-auto sm:mr-auto"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
                      <Button variant="outline" size="sm" onClick={handleSendToUpscale}>
                        <ArrowUpCircle className="w-4 h-4 mr-1" />
                        Upscale
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSendToResize}>
                        <Expand className="w-4 h-4 mr-1" />
                        Resize
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSendToSegment}>
                        <Scissors className="w-4 h-4 mr-1" />
                        Segment
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSendToEdit}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

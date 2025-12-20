import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useImageStore } from '@/store/imageStore'
import { ImageIcon, Calendar, Ruler, Trash2, Download, Check, ArrowUpCircle, Expand, Scissors } from 'lucide-react'

const API_BASE_URL = 'http://localhost:8000/api'

export const Route = createFileRoute('/history')({
  component: RouteComponent,
})

interface Job {
  id: number
  job_type: string
  original_filename: string
  output_filename: string
  output_path: string
  created_at: string
  original_width: number
  original_height: number
  original_pixels: number
  output_width: number
  output_height: number
  output_pixels: number
  aspect_ratio: string
  quality: number
  target_pixels: number
}

function RouteComponent() {
  const navigate = useNavigate()
  const setResizeResult = useImageStore((state) => state.setResizeResult)
  const setEditImage = useImageStore((state) => state.setEditImage)
  const sendResizeToUpscale = useImageStore((state) => state.sendResizeToUpscale)
  const sendResizeToSegment = useImageStore((state) => state.sendResizeToSegment)

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedFilenames, setSelectedFilenames] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  // Ref for the intersection observer target
  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadJobs(true)
  }, [])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreJobs()
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loading, loadingMore, offset])

  const loadJobs = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true)
        setOffset(0)
      } else {
        setLoadingMore(true)
      }
      setError(null)
      
      const currentOffset = initial ? 0 : offset
      const response = await fetch(`${API_BASE_URL}/images/jobs?limit=50&offset=${currentOffset}`)

      if (!response.ok) {
        throw new Error('Failed to load job history')
      }

      const data = await response.json()
      
      if (initial) {
        setJobs(data.jobs || [])
      } else {
        setJobs(prev => [...prev, ...(data.jobs || [])])
      }
      
      setHasMore(data.has_more || false)
      setOffset(currentOffset + (data.jobs?.length || 0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMoreJobs = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    loadJobs(false)
  }, [hasMore, loading, loadingMore, offset])

  const handleThumbnailClick = (job: Job) => {
    setSelectedJob(job)
    setDialogOpen(true)
  }

  const handleSendToResize = () => {
    if (!selectedJob) return

    // Set the result in the resize page with this job's data
    const info = {
      originalWidth: selectedJob.original_width,
      originalHeight: selectedJob.original_height,
      targetWidth: selectedJob.output_width,
      targetHeight: selectedJob.output_height,
      aspectRatio: selectedJob.aspect_ratio,
      originalPixels: selectedJob.original_pixels,
      actualPixels: selectedJob.output_pixels,
    }

    setResizeResult(selectedJob.id, selectedJob.output_filename, info)
    setDialogOpen(false)
    navigate({ to: '/resize-image', search: { filename: selectedJob.output_filename } })
  }

  const handleSendToEdit = () => {
    if (!selectedJob) return

    const info = {
      originalWidth: selectedJob.original_width,
      originalHeight: selectedJob.original_height,
      targetWidth: selectedJob.output_width,
      targetHeight: selectedJob.output_height,
      aspectRatio: selectedJob.aspect_ratio,
      originalPixels: selectedJob.original_pixels,
      actualPixels: selectedJob.output_pixels,
    }

    setEditImage(selectedJob.id, selectedJob.output_filename, info)
    setDialogOpen(false)
    navigate({ to: '/edit', search: { filename: selectedJob.output_filename } })
  }

  const handleSendToUpscale = () => {
    if (!selectedJob) return

    const info = {
      originalWidth: selectedJob.original_width,
      originalHeight: selectedJob.original_height,
      targetWidth: selectedJob.output_width,
      targetHeight: selectedJob.output_height,
      aspectRatio: selectedJob.aspect_ratio,
      originalPixels: selectedJob.original_pixels,
      actualPixels: selectedJob.output_pixels,
    }

    setResizeResult(selectedJob.id, selectedJob.output_filename, info)
    sendResizeToUpscale()
    setDialogOpen(false)
    navigate({ to: '/upscale', search: { filename: selectedJob.output_filename } })
  }

  const handleSendToSegment = () => {
    if (!selectedJob) return

    const info = {
      originalWidth: selectedJob.original_width,
      originalHeight: selectedJob.original_height,
      targetWidth: selectedJob.output_width,
      targetHeight: selectedJob.output_height,
      aspectRatio: selectedJob.aspect_ratio,
      originalPixels: selectedJob.original_pixels,
      actualPixels: selectedJob.output_pixels,
    }

    setResizeResult(selectedJob.id, selectedJob.output_filename, info)
    sendResizeToSegment()
    setDialogOpen(false)
    navigate({ to: '/segment', search: { filename: selectedJob.output_filename } })
  }

  const handleDelete = async () => {
    if (!selectedJob) return

    if (
      !confirm(
        `Are you sure you want to delete "${selectedJob.original_filename}"? This cannot be undone.`
      )
    ) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/images/job/${selectedJob.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete image')
      }

      // Remove job from local state
      setJobs(jobs.filter((job) => job.id !== selectedJob.id))
      setDialogOpen(false)
      setSelectedJob(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete image')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const toggleSelection = (filename: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedFilenames((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(filename)) {
        newSet.delete(filename)
      } else {
        newSet.add(filename)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedFilenames(new Set(jobs.map((job) => job.output_filename)))
  }

  const clearSelection = () => {
    setSelectedFilenames(new Set())
  }

  const handleBatchDownload = async () => {
    if (selectedFilenames.size === 0) return

    setDownloading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/images/batch-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(selectedFilenames)),
      })

      if (!response.ok) {
        throw new Error('Failed to download images')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `images_${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Clear selection after successful download
      clearSelection()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download images')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Image History</h1>
        <p className="text-muted-foreground">
          Browse your previously processed images and reuse them
        </p>
      </div>

      {/* Batch Actions Bar */}
      {jobs.length > 0 && (
        <div className="mb-6 flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedFilenames.size} selected
          </div>
          <Button
            onClick={handleBatchDownload}
            disabled={selectedFilenames.size === 0 || downloading}
            className="ml-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading ? 'Downloading...' : `Download ${selectedFilenames.size > 0 ? `(${selectedFilenames.size})` : 'Selected'}`}
          </Button>
        </div>
      )}

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => loadJobs(true)} variant="outline" className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="w-full aspect-square rounded-md mb-4" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Images Yet</CardTitle>
            <CardDescription>
              Process some images to see them appear in your history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: '/resize-image' })}>Resize an Image</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow relative"
              onClick={() => handleThumbnailClick(job)}
            >
              {/* Selection Checkbox */}
              <div
                className="absolute top-2 right-2 z-10"
                onClick={(e) => toggleSelection(job.output_filename, e)}
              >
                <div
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                    selectedFilenames.has(job.output_filename)
                      ? 'bg-primary border-primary'
                      : 'bg-background border-muted-foreground/50 hover:border-primary'
                  }`}
                >
                  {selectedFilenames.has(job.output_filename) && (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>
              </div>

              <CardContent className="p-0">
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  <img
                    src={`${API_BASE_URL}/images/output/${job.output_filename}`}
                    alt={job.original_filename}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold truncate text-sm">{job.original_filename}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Ruler className="w-3 h-3" />
                    <span>
                      {job.output_width} × {job.output_height}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(job.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={`loading-${i}`}>
              <CardContent className="p-4">
                <Skeleton className="w-full aspect-square rounded-md mb-4" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Intersection observer target for infinite scroll */}
      <div ref={observerTarget} className="h-10" />

      {/* End of results message */}
      {!loading && !loadingMore && !hasMore && jobs.length > 0 && (
        <div className="text-center text-muted-foreground py-8">
          No more images to load
        </div>
      )}

      {/* Image Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="break-all overflow-wrap-anywhere max-w-full">
                  {selectedJob.original_filename}
                </DialogTitle>
                <DialogDescription>
                  {selectedJob.job_type.charAt(0).toUpperCase() + selectedJob.job_type.slice(1)} •{' '}
                  {formatDate(selectedJob.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="w-full max-h-96 overflow-hidden rounded-lg border bg-muted">
                  <img
                    src={`${API_BASE_URL}/images/output/${selectedJob.output_filename}`}
                    alt={selectedJob.original_filename}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Original Size:</span>
                    <p className="font-medium">
                      {selectedJob.original_width} × {selectedJob.original_height}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedJob.original_pixels?.toLocaleString()} pixels
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Output Size:</span>
                    <p className="font-medium">
                      {selectedJob.output_width} × {selectedJob.output_height}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedJob.output_pixels?.toLocaleString()} pixels
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Aspect Ratio:</span>
                    <p className="font-medium">{selectedJob.aspect_ratio}</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full sm:w-auto sm:mr-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
                <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
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
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

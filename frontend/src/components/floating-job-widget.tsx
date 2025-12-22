import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, Clock, X } from 'lucide-react'
import { API_BASE_URL } from '@/lib/constants'
import { useNavigate } from '@tanstack/react-router'

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

export function FloatingJobWidget() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [isMinimized, setIsMinimized] = useState(true)

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs?limit=10`)
      if (!response.ok) return

      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    }
  }

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-500" />
      case 'processing':
      case 'queued':
        return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-3 w-3 text-yellow-500" />
    }
  }

  const activeJobs = jobs.filter((job) =>
    ['pending', 'processing', 'queued'].includes(job.job_status)
  )

  return (
    <>
      {/* Minimized floating button */}
      {isMinimized && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setIsMinimized(false)}
            className="rounded-full h-14 w-14 shadow-lg"
            size="icon"
          >
            <div className="relative">
              {activeJobs.length > 0 ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                    {activeJobs.length}
                  </span>
                </>
              ) : (
                <Clock className="h-6 w-6" />
              )}
            </div>
          </Button>
        </div>
      )}

      {/* Expanded floating widget */}
      {!isMinimized && (
        <Card className="fixed bottom-4 right-4 w-96 z-50 shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Recent Jobs ({jobs.length})
                {activeJobs.length > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({activeJobs.length} active)
                  </span>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[280px] overflow-y-auto space-y-2">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No jobs yet</div>
            ) : (
              jobs.map((job) => (
                <Card
                  key={job.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => {
                    setIsMinimized(true)
                    navigate({ to: '/jobs' })
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      {getStatusIcon(job.job_status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">#{job.id}</span>
                          <Badge variant="outline" className="text-xs">
                            {job.job_type}
                          </Badge>
                          <Badge
                            variant={
                              job.job_status === 'completed'
                                ? 'default'
                                : job.job_status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="text-xs capitalize"
                          >
                            {job.job_status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {job.original_filename}
                        </div>
                        {job.error_message && (
                          <div className="text-xs text-red-500 mt-1 truncate">
                            {job.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}

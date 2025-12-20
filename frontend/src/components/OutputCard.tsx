import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, ArrowUpCircle, Expand, Scissors } from 'lucide-react'
import { API_BASE_URL } from '@/lib/constants'
import type { ReactNode } from 'react'

interface OutputCardProps {
  title: string
  description: string
  outputFilename: string | null
  downloadButtonText: string
  emptyStateText: string
  onUpscale: () => void
  onResize: () => void
  onSegment: () => void
  onDownload: () => void
  additionalInfo?: ReactNode
}

export function OutputCard({
  title,
  description,
  outputFilename,
  downloadButtonText,
  emptyStateText,
  onUpscale,
  onResize,
  onSegment,
  onDownload,
  additionalInfo,
}: OutputCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {outputFilename ? (
          <>
            <div>
              <img
                src={`${API_BASE_URL}/images/output/${outputFilename}`}
                alt={title}
                className="w-full rounded-md border"
              />
            </div>

            {additionalInfo}

            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={onUpscale} variant="outline" size="sm">
                  <ArrowUpCircle className="w-4 h-4 mr-1" />
                  Upscale
                </Button>
                <Button onClick={onResize} variant="outline" size="sm">
                  <Expand className="w-4 h-4 mr-1" />
                  Resize
                </Button>
                <Button onClick={onSegment} variant="outline" size="sm">
                  <Scissors className="w-4 h-4 mr-1" />
                  Segment
                </Button>
              </div>
              <Button onClick={onDownload} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                {downloadButtonText}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>{emptyStateText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

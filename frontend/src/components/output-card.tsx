import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, ArrowBigUpDash, Expand, Scissors, Pencil, ExternalLink } from 'lucide-react'
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
  onEdit: () => void
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
  onEdit,
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
            <div className="relative group">
              <img
                src={`${API_BASE_URL}/images/output/${outputFilename}`}
                alt={title}
                className="w-full rounded-md border"
              />
              <a
                href={`${API_BASE_URL}/images/output/${outputFilename}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {additionalInfo}

            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <Button onClick={onResize} variant="outline" size="sm">
                  <Expand className="w-4 h-4 mr-1" />
                  Resize
                </Button>
                <Button onClick={onUpscale} variant="outline" size="sm">
                  <ArrowBigUpDash className="w-4 h-4 mr-1" />
                  Upscale
                </Button>
                <Button onClick={onSegment} variant="outline" size="sm">
                  <Scissors className="w-4 h-4 mr-1" />
                  Segment
                </Button>
                <Button onClick={onEdit} variant="outline" size="sm">
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
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

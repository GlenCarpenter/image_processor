import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowUpCircle,
  Download,
  Expand,
  Scissors,
  Pencil,
  Trash2,
  Loader2,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { API_BASE_URL } from '@/lib/constants'

interface ImageDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filename: string | null
  originalFilename: string
  title: string
  description: string
  onDelete?: () => void
  onSendToUpscale?: () => void
  onSendToResize?: () => void
  onSendToSegment?: () => void
  onSendToEdit?: () => void
  deleting?: boolean
  status?: 'completed' | 'failed' | 'processing' | 'pending'
  errorMessage?: string | null
  metadata?: {
    originalWidth?: number | null
    originalHeight?: number | null
    originalPixels?: number | null
    outputWidth?: number | null
    outputHeight?: number | null
    outputPixels?: number | null
    aspectRatio?: string | null
    quality?: number | null
    targetPixels?: number | null
    [key: string]: any
  }
}

export function ImageDetailDialog({
  open,
  onOpenChange,
  filename,
  title,
  description,
  onDelete,
  onSendToUpscale,
  onSendToResize,
  onSendToSegment,
  onSendToEdit,
  deleting = false,
  status = 'completed',
  errorMessage,
  metadata,
}: ImageDetailDialogProps) {
  const handleDownload = () => {
    if (!filename) return
    const link = document.createElement('a')
    link.href = `${API_BASE_URL}/images/output/${filename}/download`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  console.log(description)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-6">
        <DialogHeader>
          <DialogTitle className="break-all overflow-wrap-anywhere max-w-full">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 my-6">
          {/* Metadata Column */}
          {metadata && (
            <div className="w-64 flex-shrink-0 max-h-[70vh] overflow-y-auto pr-2">
              <div className="space-y-4 text-sm">
                {metadata.originalWidth && metadata.originalHeight && (
                  <div>
                    <span className="text-muted-foreground font-medium">Original Size</span>
                    <p className="font-medium mt-1">
                      {metadata.originalWidth} × {metadata.originalHeight}
                    </p>
                    {metadata.originalPixels && (
                      <p className="text-xs text-muted-foreground">
                        {metadata.originalPixels.toLocaleString()} pixels
                      </p>
                    )}
                  </div>
                )}

                {metadata.outputWidth && metadata.outputHeight && (
                  <div>
                    <span className="text-muted-foreground font-medium">Output Size</span>
                    <p className="font-medium mt-1">
                      {metadata.outputWidth} × {metadata.outputHeight}
                    </p>
                    {metadata.outputPixels && (
                      <p className="text-xs text-muted-foreground">
                        {metadata.outputPixels.toLocaleString()} pixels
                      </p>
                    )}
                  </div>
                )}

                {metadata.aspectRatio && (
                  <div>
                    <span className="text-muted-foreground font-medium">Aspect Ratio</span>
                    <p className="font-medium mt-1">{metadata.aspectRatio}</p>
                  </div>
                )}

                {metadata.quality && (
                  <div>
                    <span className="text-muted-foreground font-medium">Quality</span>
                    <p className="font-medium mt-1">{metadata.quality}</p>
                  </div>
                )}

                {metadata.targetPixels && (
                  <div>
                    <span className="text-muted-foreground font-medium">Target Pixels</span>
                    <p className="font-medium mt-1">{metadata.targetPixels.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Image Container */}
          <div className="flex-1 flex items-center justify-center">
            {filename ? (
              <div className="relative group">
                <img
                  src={`${API_BASE_URL}/images/output/${filename}`}
                  alt={filename}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
                <a
                  href={`${API_BASE_URL}/images/output/${filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div className="w-full h-[60vh] flex items-center justify-center bg-muted rounded-lg">
                <div className="text-center text-muted-foreground">
                  {status === 'failed' ? (
                    <div>
                      <XCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
                      <p>Job Failed</p>
                      {errorMessage && <p className="text-sm mt-2 text-red-500">{errorMessage}</p>}
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
          </div>

          {/* Action Buttons Column */}
          {filename && (
            <div className="flex flex-col gap-2 min-w-[140px]">
              {onDelete && (
                <Button
                  variant="destructive"
                  onClick={onDelete}
                  disabled={deleting}
                  className="w-full justify-start"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              )}
              <Button onClick={handleDownload} className="w-full justify-start">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              {onSendToUpscale && (
                <Button
                  variant="outline"
                  onClick={onSendToUpscale}
                  className="w-full justify-start"
                >
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Upscale
                </Button>
              )}
              {onSendToResize && (
                <Button variant="outline" onClick={onSendToResize} className="w-full justify-start">
                  <Expand className="w-4 h-4 mr-2" />
                  Resize
                </Button>
              )}
              {onSendToSegment && (
                <Button
                  variant="outline"
                  onClick={onSendToSegment}
                  className="w-full justify-start"
                >
                  <Scissors className="w-4 h-4 mr-2" />
                  Segment
                </Button>
              )}
              {onSendToEdit && (
                <Button variant="outline" onClick={onSendToEdit} className="w-full justify-start">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

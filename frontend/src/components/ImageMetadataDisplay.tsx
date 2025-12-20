import { Label } from '@/components/ui/label'
import { formatFileSize, formatImageType, type ImageMetadata } from '@/lib/imageUtils'

interface ImageMetadataDisplayProps {
  metadata: ImageMetadata
}

export function ImageMetadataDisplay({ metadata }: ImageMetadataDisplayProps) {
  return (
    <div className="bg-muted/50 p-3 rounded-md space-y-2">
      <Label className="text-xs font-semibold uppercase text-muted-foreground">
        Image Metadata
      </Label>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Dimensions:</span>
          <p className="font-medium">
            {metadata.width} × {metadata.height}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Total Pixels:</span>
          <p className="font-medium">
            {(metadata.width * metadata.height).toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">File Size:</span>
          <p className="font-medium">{formatFileSize(metadata.size)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Type:</span>
          <p className="font-medium">{formatImageType(metadata.type)}</p>
        </div>
      </div>
    </div>
  )
}

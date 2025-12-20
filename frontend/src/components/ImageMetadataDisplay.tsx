import { Label } from '@/components/ui/label'
import {
  formatFileSize,
  formatImageType,
  formatExifValue,
  formatExifLabel,
  type ImageMetadata,
} from '@/lib/imageUtils'

interface ImageMetadataDisplayProps {
  metadata: ImageMetadata
}

export function ImageMetadataDisplay({ metadata }: ImageMetadataDisplayProps) {
  const hasExif = metadata.exif && Object.keys(metadata.exif).length > 0

  return (
    <div className="bg-muted/50 p-3 rounded-md space-y-3">
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
          <p className="font-medium">{(metadata.width * metadata.height).toLocaleString()}</p>
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

      {hasExif && (
        <>
          <div className="border-t border-border pt-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              EXIF Data
            </Label>
          </div>

          {metadata.exif?.camera && Object.keys(metadata.exif.camera).length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Camera</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(metadata.exif.camera).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground">{formatExifLabel(key)}:</span>
                    <p className="font-medium truncate" title={formatExifValue(key, value)}>
                      {formatExifValue(key, value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metadata.exif?.settings && Object.keys(metadata.exif.settings).length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Camera Settings</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(metadata.exif.settings).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground">{formatExifLabel(key)}:</span>
                    <p className="font-medium truncate" title={formatExifValue(key, value)}>
                      {formatExifValue(key, value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metadata.exif?.datetime && Object.keys(metadata.exif.datetime).length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Date & Time</Label>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {Object.entries(metadata.exif.datetime).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground">{formatExifLabel(key)}:</span>
                    <p className="font-medium">{formatExifValue(key, value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metadata.exif?.other && Object.keys(metadata.exif.other).length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Additional Info</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(metadata.exif.other).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground">{formatExifLabel(key)}:</span>
                    <p className="font-medium truncate" title={formatExifValue(key, value)}>
                      {formatExifValue(key, value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
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
  const hasPrompt = !!metadata.prompt
  const hasGenerationParams = !!metadata.generationParams && Object.keys(metadata.generationParams).length > 0
  const hasImageInfo = !!metadata.imageInfo && Object.keys(metadata.imageInfo).length > 0
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

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

      {hasPrompt && (
        <>
          <div className="border-t border-border pt-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              AI Generation
            </Label>
          </div>

          <div className="space-y-2 bg-primary/5 p-3 rounded-md border border-primary/20">
            <Label className="text-xs font-medium text-primary">Prompt</Label>
            <p className="text-sm font-medium break-words whitespace-pre-wrap">{metadata.prompt}</p>
          </div>
        </>
      )}

      {hasGenerationParams && (
        <>
          <div className="border-t border-border pt-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Generation Parameters
            </Label>
          </div>

          <div className="space-y-2 bg-secondary/20 p-3 rounded-md border border-secondary/40">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(metadata.generationParams!).map(([key, value]) => {
                // Format the key to be more readable
                const formattedKey = key
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (l) => l.toUpperCase())

                // Format the value
                let formattedValue = String(value)
                if (typeof value === 'boolean') {
                  formattedValue = value ? 'Yes' : 'No'
                } else if (typeof value === 'number') {
                  formattedValue = value.toString()
                }

                return (
                  <div key={key} className="break-words">
                    <span className="text-muted-foreground">{formattedKey}:</span>
                    <p className="font-medium">{formattedValue}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {hasExif && (
        <>
          <div className="border-t border-border pt-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              EXIF Data
            </Label>
          </div>

          {metadata.exif?.other?.AIPrompt && (
            <div className="space-y-2 bg-primary/5 p-3 rounded-md border border-primary/20">
              <Label className="text-xs font-medium text-primary">AI Generation Prompt</Label>
              <p className="text-sm font-medium break-words whitespace-pre-wrap">
                {metadata.exif.other.AIPrompt}
              </p>
            </div>
          )}

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
                {Object.entries(metadata.exif.other)
                  .filter(([key]) => key !== 'AIPrompt')
                  .map(([key, value]) => (
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

      {hasImageInfo && (
        <>
          <div className="border-t border-border pt-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Image Info (PNG Metadata)
            </Label>
          </div>

          <div className="space-y-2 bg-muted/30 p-3 rounded-md">
            <div className="grid grid-cols-1 gap-2 text-sm">
              {Object.entries(metadata.imageInfo!).map(([key, value]) => {
                const stringValue = String(value)
                const isLong = typeof value === 'string' && value.length > 200
                const isExpanded = expandedKeys.has(key)

                return (
                  <div key={key} className="break-words">
                    <span className="text-muted-foreground font-medium">{key}:</span>
                    <p className="font-mono text-xs mt-1 whitespace-pre-wrap">
                      {isLong && !isExpanded ? (
                        <>
                          {value.substring(0, 200)}
                          <button
                            onClick={() => toggleExpanded(key)}
                            className="text-primary hover:underline ml-1"
                          >
                            ... (click to expand)
                          </button>
                        </>
                      ) : isLong && isExpanded ? (
                        <>
                          {value}
                          <button
                            onClick={() => toggleExpanded(key)}
                            className="text-primary hover:underline ml-1 block mt-1"
                          >
                            (click to collapse)
                          </button>
                        </>
                      ) : (
                        stringValue
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

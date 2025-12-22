import { Label } from '@/components/ui/label'
import { ExternalLink } from 'lucide-react'

interface OriginalImagePreviewProps {
  file: File | null
  filename?: string
  apiBaseUrl: string
}

export function OriginalImagePreview({ file, filename, apiBaseUrl }: OriginalImagePreviewProps) {
  if (!file && !filename) return null

  const imageSrc = file ? URL.createObjectURL(file) : `${apiBaseUrl}/images/output/${filename}`

  return (
    <div>
      <Label>Original Image Preview</Label>
      <div className="relative group mt-2">
        <img
          src={imageSrc}
          alt="Original"
          className="max-h-64 w-full object-contain rounded-md border"
        />
        <a
          href={imageSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

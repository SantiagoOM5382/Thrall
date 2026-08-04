"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { UploadCloud, Loader2, Film, Trash2, Play } from "lucide-react"
import { uploadModelPreview, deleteModelPreview } from "../actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MAX_MB = 15
const ACCEPT = "video/mp4,video/webm,image/gif"

// Uploader for the animated hover preview (one per model). Prefers MP4 for
// weight, but accepts webm and gif since agencies may only have gifs handy.
// The current preview is shown inline (video autoplays muted-looping so the
// admin can verify what visitors will see); a delete button clears it.
export function PreviewUploader({
  userId,
  currentUrl,
}: {
  userId: string
  currentUrl: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState(false)

  function onFile(list: FileList | null) {
    const f = list?.[0] ?? null
    if (f && f.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo excede ${MAX_MB} MB`)
      setSelected(null)
      return
    }
    setSelected(f)
  }

  function onUpload() {
    if (!selected) return
    const fd = new FormData()
    fd.append("file", selected)
    startTransition(async () => {
      const res = await uploadModelPreview(userId, fd)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Preview actualizado")
        setSelected(null)
        if (inputRef.current) inputRef.current.value = ""
      }
    })
  }

  function onDelete() {
    if (!currentUrl) return
    if (!confirm("¿Eliminar el preview actual?")) return
    startTransition(async () => {
      const res = await deleteModelPreview(userId)
      if (res.error) toast.error(res.error)
      else toast.success("Preview eliminado")
    })
  }

  const isVideo = currentUrl?.endsWith(".mp4") || currentUrl?.endsWith(".webm")
  const isGif = currentUrl?.endsWith(".gif")

  return (
    <div className="space-y-3">
      {currentUrl && (
        <div className="relative overflow-hidden rounded-lg border bg-black/40">
          <div className="flex items-start gap-3 p-3">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-black">
              {isVideo && (
                <video
                  src={currentUrl}
                  muted
                  loop
                  autoPlay
                  playsInline
                  className="size-full object-cover"
                />
              )}
              {isGif && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentUrl} alt="preview" className="size-full object-cover" />
              )}
              {!isVideo && !isGif && (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <Play className="size-6" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Preview activo</p>
              <p className="text-xs text-muted-foreground">
                Se reproduce en illidan cuando alguien pasa el cursor.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isPending}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          </div>
        </div>
      )}

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (inputRef.current && e.dataTransfer.files) {
            inputRef.current.files = e.dataTransfer.files
            onFile(e.dataTransfer.files)
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UploadCloud className="size-5" />
        </span>
        <p className="text-sm">
          <span className="font-medium">
            {currentUrl ? "Reemplazar preview" : "Subir preview animado"}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          MP4 (recomendado), WebM o GIF · máx {MAX_MB} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => onFile(e.target.files)}
          className="sr-only"
        />
      </label>

      {selected && (
        <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <Film className="size-4 text-muted-foreground" />
          <span className="flex-1 text-xs text-muted-foreground">{selected.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(null)
              if (inputRef.current) inputRef.current.value = ""
            }}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onUpload} disabled={isPending} className="gap-1.5">
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {isPending ? "Subiendo…" : "Subir"}
          </Button>
        </div>
      )}
    </div>
  )
}

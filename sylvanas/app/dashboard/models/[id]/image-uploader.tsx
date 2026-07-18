"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { UploadCloud, Loader2, ImageIcon, X } from "lucide-react"
import { uploadModelImage } from "../actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ImageUploader({ userId }: { userId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [isPending, startTransition] = useTransition()

  function setSelected(list: FileList | null) {
    setFiles(list ? Array.from(list) : [])
  }

  function onSubmit() {
    if (files.length === 0 || !inputRef.current?.files) return
    const formData = new FormData()
    for (const file of Array.from(inputRef.current.files)) {
      formData.append("file", file)
    }
    startTransition(async () => {
      const res = await uploadModelImage(userId, formData)
      if (res.uploaded && res.uploaded > 0) {
        toast.success(res.uploaded === 1 ? "Imagen subida" : `${res.uploaded} imágenes subidas`)
      }
      if (res.error) toast.error(res.error)
      if (!res.error) {
        formRef.current?.reset()
        setFiles([])
      }
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-3"
    >
      <label
        htmlFor="model-photo-input"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (inputRef.current) {
            inputRef.current.files = e.dataTransfer.files
          }
          setSelected(e.dataTransfer.files)
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40"
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UploadCloud className="size-5" />
        </span>
        <p className="text-sm">
          <span className="font-medium text-foreground">Haz clic para subir</span>{" "}
          <span className="text-muted-foreground">o arrastra fotos aquí</span>
        </p>
        <p className="text-xs text-muted-foreground">PNG o JPG</p>
        <input
          ref={inputRef}
          id="model-photo-input"
          type="file"
          name="file"
          accept="image/*"
          multiple
          onChange={(e) => setSelected(e.target.files)}
          className="sr-only"
        />
      </label>

      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                <ImageIcon className="size-3" />
                {f.name}
              </span>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto gap-1 text-muted-foreground"
            onClick={() => {
              formRef.current?.reset()
              setFiles([])
            }}
          >
            <X className="size-3.5" />
            Limpiar
          </Button>
          <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {isPending ? "Subiendo…" : `Subir ${files.length > 1 ? `(${files.length})` : ""}`}
          </Button>
        </div>
      )}
    </form>
  )
}

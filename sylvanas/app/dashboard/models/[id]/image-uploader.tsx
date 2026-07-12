"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { uploadModelImage } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ImageUploader({ userId }: { userId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [hasFile, setHasFile] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await uploadModelImage(userId, formData)
      if (res.uploaded && res.uploaded > 0) {
        toast.success(
          res.uploaded === 1
            ? "Imagen subida"
            : `${res.uploaded} imágenes subidas`
        )
      }
      if (res.error) {
        toast.error(res.error)
      }
      if (!res.error) {
        formRef.current?.reset()
        setHasFile(false)
      }
    })
  }

  return (
    <form ref={formRef} action={onSubmit} className="flex items-end gap-3">
      <Input
        type="file"
        name="file"
        accept="image/*"
        multiple
        onChange={(e) => setHasFile(!!e.target.files?.length)}
        className="max-w-xs"
      />
      <Button type="submit" disabled={!hasFile || isPending}>
        {isPending ? "Subiendo…" : "Subir imágenes"}
      </Button>
    </form>
  )
}

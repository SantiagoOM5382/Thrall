"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { deleteModelImage } from "../actions"
import { Button } from "@/components/ui/button"

export function DeleteImageButton({
  imageId,
  userId,
}: {
  imageId: string
  userId: string
}) {
  const [isPending, startTransition] = useTransition()

  function onClick() {
    startTransition(async () => {
      const res = await deleteModelImage(imageId, userId)
      if (res.error) toast.error(res.error)
      else toast.success("Imagen eliminada")
    })
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      aria-label="Eliminar imagen"
      onClick={onClick}
      disabled={isPending}
      className="absolute right-2 top-2 size-8 p-0 opacity-0 shadow-md transition-opacity group-hover:opacity-100"
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  )
}

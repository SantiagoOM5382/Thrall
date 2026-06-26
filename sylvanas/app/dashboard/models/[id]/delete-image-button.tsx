"use client"

import { useTransition } from "react"
import { toast } from "sonner"
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
      onClick={onClick}
      disabled={isPending}
      className="absolute right-2 top-2"
    >
      {isPending ? "…" : "Eliminar"}
    </Button>
  )
}

"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { deleteFine, deleteLoan } from "./fine-loan-actions"
import { Button } from "@/components/ui/button"

export function DeleteMovementButton({
  kind,
  id,
}: {
  kind: "fine" | "loan"
  id: string
}) {
  const [isPending, startTransition] = useTransition()
  function onClick() {
    startTransition(async () => {
      const res = kind === "fine" ? await deleteFine(id) : await deleteLoan(id)
      if (res.error) toast.error(res.error)
      else toast.success("Eliminado")
    })
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={isPending} className="gap-1.5">
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      Eliminar
    </Button>
  )
}

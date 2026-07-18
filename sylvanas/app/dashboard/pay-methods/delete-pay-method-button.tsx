"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { deletePayMethod } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function DeletePayMethodButton({
  id,
  code,
}: {
  id: string
  code: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onConfirm() {
    startTransition(async () => {
      const res = await deletePayMethod(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Método eliminado")
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="gap-1.5" />}>
        <Trash2 className="size-3.5" />
        Eliminar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar método de pago</DialogTitle>
          <DialogDescription>
            Se eliminará el método <strong>{code}</strong>. ¿Continuar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending} className="gap-1.5">
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

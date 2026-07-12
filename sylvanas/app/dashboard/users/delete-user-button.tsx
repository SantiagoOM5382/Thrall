"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { deleteUser } from "./actions"
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

export function DeleteUserButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteUser(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Usuario eliminado")
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Eliminar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar usuario</DialogTitle>
          <DialogDescription>
            Se eliminará a <strong>{name}</strong>. ¿Continuar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

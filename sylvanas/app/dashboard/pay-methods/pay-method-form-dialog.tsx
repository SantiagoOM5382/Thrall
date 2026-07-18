"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil, Loader2 } from "lucide-react"
import { createPayMethod, updatePayMethod } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  code: z.string().min(1, "Código requerido"),
  displayName: z.string().min(1, "Nombre requerido"),
})

type FormValues = z.infer<typeof schema>

interface Props {
  mode: "create" | "edit"
  initial?: { id: string; code: string; displayName: string }
}

export function PayMethodFormDialog({ mode, initial }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initial?.code ?? "",
      displayName: initial?.displayName ?? "",
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createPayMethod(values)
          : await updatePayMethod(initial!.id, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(mode === "create" ? "Método creado" : "Método actualizado")
      setOpen(false)
      if (mode === "create") reset({ code: "", displayName: "" })
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={mode === "create" ? "default" : "ghost"} size="sm" className="gap-1.5" />
        }
      >
        {mode === "create" ? <Plus className="size-4" /> : <Pencil className="size-3.5" />}
        {mode === "create" ? "Nuevo método" : "Editar"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo método de pago" : "Editar método"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input id="code" placeholder="NQST" {...register("code")} />
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Nombre</Label>
            <Input
              id="displayName"
              placeholder="Nequi Santiago"
              {...register("displayName")}
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createBrand, updateBrand } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({ name: z.string().min(1, "Nombre requerido") })
type FormValues = z.infer<typeof schema>

export function BrandFormDialog({
  mode,
  initial,
}: {
  mode: "create" | "edit"
  initial?: { id: string; name: string }
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? "" },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = mode === "create"
        ? await createBrand(values.name)
        : await updateBrand(initial!.id, { name: values.name })
      if (res.error) { toast.error(res.error); return }
      toast.success(mode === "create" ? "Brand creada" : "Brand actualizada")
      setOpen(false)
      if (mode === "create") reset({ name: "" })
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={mode === "create" ? "default" : "ghost"} size="sm" />}>
        {mode === "create" ? "Nueva brand" : "Editar"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nueva brand" : "Editar brand"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="brand-name">Nombre</Label>
            <Input id="brand-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { UserPlus, Loader2 } from "lucide-react"
import { createModel } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function CreateModelDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await createModel({
        ...values,
        phone: values.phone || undefined,
        telegram: values.telegram || undefined,
        description: values.description || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Modelo creada")
      setOpen(false)
      reset({ name: "", email: "", password: "" })
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <UserPlus className="size-4" />
        Nueva modelo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva modelo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="m-name">Nombre</Label>
            <Input id="m-name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-email">Correo</Label>
            <Input id="m-email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-password">Contraseña</Label>
            <Input id="m-password" type="text" {...register("password")} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="m-phone">Teléfono (opcional)</Label>
              <Input id="m-phone" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-telegram">Telegram (opcional)</Label>
              <Input id="m-telegram" {...register("telegram")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-description">Descripción (opcional)</Label>
            <Textarea id="m-description" rows={2} {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? "Creando…" : "Crear modelo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

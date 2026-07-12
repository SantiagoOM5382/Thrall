"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createUser } from "./actions"
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
  role: z.enum(["admin", "monitor", "model"]),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "model" },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await createUser({
        ...values,
        phone: values.phone || undefined,
        telegram: values.telegram || undefined,
        description: values.description || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Usuario creado")
      setOpen(false)
      reset({ role: "model", name: "", email: "", password: "" })
    })
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Nuevo usuario</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="u-role">Rol</Label>
            <select id="u-role" className={selectClass} {...register("role")}>
              <option value="model">Modelo</option>
              <option value="monitor">Monitor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-name">Nombre</Label>
            <Input id="u-name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-email">Correo</Label>
            <Input id="u-email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-password">Contraseña</Label>
            <Input id="u-password" type="text" {...register("password")} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="u-phone">Teléfono (opcional)</Label>
              <Input id="u-phone" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-telegram">Telegram (opcional)</Label>
              <Input id="u-telegram" {...register("telegram")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-description">Descripción (opcional)</Label>
            <Textarea id="u-description" rows={2} {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

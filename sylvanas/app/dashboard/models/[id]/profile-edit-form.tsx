"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { updateModelProfile } from "./profile-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Correo inválido"),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function ProfileEditForm({
  id,
  initial,
}: {
  id: string
  initial: FormValues
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initial })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await updateModelProfile(id, {
        ...values,
        phone: values.phone || undefined,
        telegram: values.telegram || undefined,
        description: values.description || undefined,
      })
      if (res.error) toast.error(res.error)
      else toast.success("Perfil actualizado")
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-name">Nombre</Label>
          <Input id="p-name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-email">Correo</Label>
          <Input id="p-email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-phone">Teléfono</Label>
          <Input id="p-phone" {...register("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-telegram">Telegram</Label>
          <Input id="p-telegram" {...register("telegram")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-description">Descripción</Label>
        <Textarea id="p-description" rows={3} {...register("description")} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  )
}

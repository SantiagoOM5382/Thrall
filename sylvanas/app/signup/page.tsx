"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signup } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const signupSchema = z
  .object({
    brandName: z.string().min(1, "El nombre de la agencia es requerido"),
    adminName: z.string().min(1, "Tu nombre es requerido"),
    email: z.string().email("Correo inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  })

type SignupForm = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) })

  async function onSubmit(data: SignupForm) {
    setServerError(null)
    const result = await signup(
      data.brandName,
      data.adminName,
      data.email,
      data.password
    )
    if (result.error) {
      setServerError(result.error)
      return
    }
    if (result.redirectTo) {
      router.push(result.redirectTo)
      router.refresh()
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Crea tu agencia</CardTitle>
          <CardDescription>
            10 días de prueba con acceso completo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="brandName">Nombre de la agencia</Label>
              <Input
                id="brandName"
                autoComplete="organization"
                placeholder="Mi Agencia"
                {...register("brandName")}
              />
              {errors.brandName && (
                <p className="text-sm text-destructive">
                  {errors.brandName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminName">Tu nombre</Label>
              <Input
                id="adminName"
                autoComplete="name"
                placeholder="Ada Lovelace"
                {...register("adminName")}
              />
              {errors.adminName && (
                <p className="text-sm text-destructive">
                  {errors.adminName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@arthas.co"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...register("confirm")}
              />
              {errors.confirm && (
                <p className="text-sm text-destructive">
                  {errors.confirm.message}
                </p>
              )}
            </div>
            {serverError && (
              <p className="text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creando…" : "Crear cuenta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

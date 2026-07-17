"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, AlertCircle } from "lucide-react"
import { signup } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthShell } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/auth/password-input"

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
    <AuthShell
      eyebrow="Crea tu agencia"
      headline="Todo tu negocio de modelos, en un solo panel."
    >
      <div className="mb-7 space-y-1.5">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Crea tu cuenta
        </h2>
        <p className="text-sm text-muted-foreground">
          Empieza gratis — no necesitas tarjeta de crédito.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="brandName">Nombre de la agencia</Label>
          <Input
            id="brandName"
            autoComplete="organization"
            placeholder="Mi Agencia"
            className="h-10"
            aria-invalid={!!errors.brandName}
            {...register("brandName")}
          />
          {errors.brandName && (
            <p className="text-sm text-destructive">{errors.brandName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adminName">Tu nombre</Label>
          <Input
            id="adminName"
            autoComplete="name"
            placeholder="Ada Lovelace"
            className="h-10"
            aria-invalid={!!errors.adminName}
            {...register("adminName")}
          />
          {errors.adminName && (
            <p className="text-sm text-destructive">{errors.adminName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="admin@arthas.co"
            className="h-10"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="text-sm text-destructive">{errors.confirm.message}</p>
            )}
          </div>
        </div>

        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {serverError}
          </div>
        )}

        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Creando tu agencia…" : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  )
}

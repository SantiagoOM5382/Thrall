"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, AlertCircle, Building2, User } from "lucide-react"
import { signup } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthShell } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { cn } from "@/lib/utils"

const signupSchema = z
  .object({
    // For agency signups this is the agency name; for solo signups this is
    // the model's public/artist name (used as brand.name + publicly visible).
    brandName: z.string().min(1, "El nombre es requerido"),
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
type Kind = "agency" | "solo"

export default function SignupPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind>("agency")
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
      data.password,
      kind,
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

  const isSolo = kind === "solo"

  return (
    <AuthShell
      eyebrow={isSolo ? "Crea tu perfil" : "Crea tu agencia"}
      headline={
        isSolo
          ? "Publica tu perfil y consigue clientes."
          : "Todo tu negocio de modelos, en un solo panel."
      }
    >
      <div className="mb-6 space-y-1.5">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Crea tu cuenta
        </h2>
        <p className="text-sm text-muted-foreground">
          Empieza gratis — no necesitas tarjeta de crédito.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
        <KindOption
          selected={kind === "agency"}
          onClick={() => setKind("agency")}
          icon={<Building2 className="size-4" />}
          label="Soy agencia"
        />
        <KindOption
          selected={kind === "solo"}
          onClick={() => setKind("solo")}
          icon={<User className="size-4" />}
          label="Soy modelo"
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="brandName">
            {isSolo ? "Tu nombre artístico" : "Nombre de la agencia"}
          </Label>
          <Input
            id="brandName"
            autoComplete="organization"
            placeholder={isSolo ? "Sofía" : "Mi Agencia"}
            className="h-10"
            aria-invalid={!!errors.brandName}
            {...register("brandName")}
          />
          {errors.brandName && (
            <p className="text-sm text-destructive">{errors.brandName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adminName">
            {isSolo ? "Tu nombre real" : "Tu nombre"}
          </Label>
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
            placeholder={isSolo ? "sofia@correo.com" : "admin@tuagencia.co"}
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

        {isSolo && (
          <p className="rounded-md bg-accent px-2.5 py-2 text-xs text-accent-foreground">
            Tu cuenta permite publicar únicamente tu propio perfil. Si más
            adelante quieres agregar otras modelos, contáctanos y la convertimos
            en agencia.
          </p>
        )}

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
          {isSubmitting
            ? isSolo ? "Creando tu perfil…" : "Creando tu agencia…"
            : "Crear cuenta"}
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

function KindOption({
  selected, onClick, icon, label,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        selected
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  )
}

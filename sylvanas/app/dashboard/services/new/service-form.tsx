"use client"

import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Trash2, Plus, ChevronDown } from "lucide-react"
import { createService } from "../actions"
import { calcEarnings, formatCOP, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

const schema = z
  .object({
    modelId: z.string().min(1, "Selecciona una modelo"),
    startTime: z.string().min(1, "Requerido"),
    endTime: z.string().min(1, "Requerido"),
    basePrice: z.coerce.number().int().positive("Debe ser mayor a 0"),
    payMethodId: z.string().min(1, "Selecciona un método"),
    note: z.string().optional(),
    extras: z
      .array(
        z.object({
          description: z.string().min(1, "Descripción requerida"),
          amount: z.coerce.number().int().positive("Monto inválido"),
        })
      )
      .default([]),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "La hora de fin debe ser posterior al inicio",
    path: ["endTime"],
  })

type FormValues = z.input<typeof schema>

// datetime-local value (e.g. "2024-01-15T14:30") interpreted as Bogota time.
function toBogotaMs(local: string): number {
  return new Date(`${local}:00-05:00`).getTime()
}

function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export function ServiceForm({
  models,
  payMethods,
}: {
  models: { id: string; name: string }[]
  payMethods: { id: string; label: string }[]
}) {
  const router = useRouter()
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { extras: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "extras" })

  const basePrice = Number(watch("basePrice")) || 0
  const extraAmounts = (watch("extras") ?? []).map((e) => Number(e.amount) || 0)
  const earnings = calcEarnings(basePrice, extraAmounts)

  async function onSubmit(values: FormValues) {
    const res = await createService({
      modelId: values.modelId,
      startTime: toBogotaMs(values.startTime),
      endTime: toBogotaMs(values.endTime),
      basePrice: Number(values.basePrice),
      payMethodId: values.payMethodId,
      note: values.note || undefined,
      extras: (values.extras ?? []).map((e) => ({
        description: e.description,
        amount: Number(e.amount),
      })),
    })
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Servicio creado")
    router.push("/dashboard/services")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="modelId">Modelo</Label>
        <Select id="modelId" {...register("modelId")}>
          <option value="">Selecciona…</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        {errors.modelId && (
          <p className="text-sm text-destructive">{errors.modelId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Inicio</Label>
          <Input id="startTime" type="datetime-local" {...register("startTime")} />
          {errors.startTime && (
            <p className="text-sm text-destructive">{errors.startTime.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">Fin</Label>
          <Input id="endTime" type="datetime-local" {...register("endTime")} />
          {errors.endTime && (
            <p className="text-sm text-destructive">{errors.endTime.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="basePrice">Precio base (COP)</Label>
          <Input
            id="basePrice"
            type="number"
            min={1}
            step={1}
            className="tabular-nums"
            {...register("basePrice")}
          />
          {errors.basePrice && (
            <p className="text-sm text-destructive">{errors.basePrice.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="payMethodId">Método de pago</Label>
          <Select id="payMethodId" {...register("payMethodId")}>
            <option value="">Selecciona…</option>
            {payMethods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          {errors.payMethodId && (
            <p className="text-sm text-destructive">{errors.payMethodId.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea id="note" rows={2} {...register("note")} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Adicionales</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => append({ description: "", amount: 0 })}
          >
            <Plus className="size-3.5" />
            Agregar adicional
          </Button>
        </div>
        {fields.map((field, idx) => (
          <div key={field.id} className="flex items-start gap-2 rounded-lg border p-2.5">
            <div className="flex-1">
              <Input
                placeholder="Descripción"
                {...register(`extras.${idx}.description`)}
              />
              {errors.extras?.[idx]?.description && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.extras[idx]?.description?.message}
                </p>
              )}
            </div>
            <div className="w-36">
              <Input
                type="number"
                min={1}
                step={1}
                placeholder="Monto"
                className="tabular-nums"
                {...register(`extras.${idx}.amount`)}
              />
              {errors.extras?.[idx]?.amount && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.extras[idx]?.amount?.message}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Quitar adicional"
              onClick={() => remove(idx)}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 py-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Modelo base</p>
            <p className="mt-0.5 font-medium tabular-nums">{formatCOP(earnings.modelBase)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Extras</p>
            <p className="mt-0.5 font-medium tabular-nums">{formatCOP(earnings.modelExtras)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total modelo</p>
            <p className="mt-0.5 font-semibold tabular-nums text-positive">{formatCOP(earnings.modelTotal)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Empresa</p>
            <p className="mt-0.5 font-semibold tabular-nums text-primary">{formatCOP(earnings.company)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Guardando…" : "Crear servicio"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/services")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

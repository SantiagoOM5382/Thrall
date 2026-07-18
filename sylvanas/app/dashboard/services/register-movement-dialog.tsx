"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { createFine, createLoan } from "./fine-loan-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { NativeSelect as Select } from "@/components/shared/native-select"
import { MoneyInput } from "@/components/shared/money-input"

const schema = z.object({
  modelId: z.string().min(1, "Selecciona una modelo"),
  amount: z.coerce.number().int().positive("Monto inválido"),
  reason: z.string().min(1, "Motivo requerido"),
})
type FormValues = z.input<typeof schema>

export function RegisterMovementDialog({
  kind,
  models,
}: {
  kind: "fine" | "loan"
  models: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const label = kind === "fine" ? "Nueva multa" : "Nuevo préstamo"

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const payload = {
        modelId: values.modelId,
        amount: Number(values.amount),
        reason: values.reason,
      }
      const res = kind === "fine" ? await createFine(payload) : await createLoan(payload)
      if (res.error) { toast.error(res.error); return }
      toast.success(kind === "fine" ? "Multa registrada" : "Préstamo registrado")
      setOpen(false)
      reset({ modelId: "", amount: 0, reason: "" } as FormValues)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="mv-model">Modelo</Label>
            <Select id="mv-model" {...register("modelId")}>
              <option value="">Selecciona…</option>
              {models.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </Select>
            {errors.modelId && <p className="text-sm text-destructive">{errors.modelId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-amount">Monto (COP)</Label>
            <MoneyInput id="mv-amount" {...register("amount")} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-reason">Motivo</Label>
            <Input id="mv-reason" {...register("reason")} />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
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

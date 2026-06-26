"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createFine, createLoan } from "./fine-loan-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

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

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="mv-model">Modelo</Label>
            <select id="mv-model" className={selectClass} {...register("modelId")}>
              <option value="">Selecciona…</option>
              {models.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
            {errors.modelId && <p className="text-sm text-destructive">{errors.modelId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-amount">Monto (COP)</Label>
            <Input id="mv-amount" type="number" min={1} step={1} {...register("amount")} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-reason">Motivo</Label>
            <Input id="mv-reason" {...register("reason")} />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
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

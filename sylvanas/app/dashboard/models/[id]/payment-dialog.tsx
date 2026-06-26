"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createPayment } from "./settlement-actions"
import { formatCOP } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

const schema = z.object({
  amount: z.coerce.number().int().positive("Monto inválido"),
  payMethodId: z.string().min(1, "Selecciona un método"),
})
type FormValues = z.input<typeof schema>

export function PaymentDialog({
  modelId,
  currentBalance,
  payMethods,
}: {
  modelId: string
  currentBalance: number
  payMethods: { id: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: Math.max(0, currentBalance) } as FormValues,
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await createPayment(modelId, Number(values.amount), values.payMethodId)
      if (res.error) { toast.error(res.error); return }
      toast.success("Pago registrado")
      setOpen(false)
    })
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Realizar pago</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Realizar pago — saldo actual {formatCOP(currentBalance)}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Monto a pagar</Label>
            <Input id="pay-amount" type="number" min={1} step={1} {...register("amount")} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-method">Método de pago</Label>
            <select id="pay-method" className={selectClass} {...register("payMethodId")}>
              <option value="">Selecciona…</option>
              {payMethods.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
            </select>
            {errors.payMethodId && <p className="text-sm text-destructive">{errors.payMethodId.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando…" : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

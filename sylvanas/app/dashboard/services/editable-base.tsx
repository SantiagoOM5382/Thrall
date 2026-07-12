"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { editServiceBase } from "./edit-service-action"
import { formatCOP } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function EditableBase({ id, value }: { id: string; value: number }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [isPending, startTransition] = useTransition()

  function save() {
    const n = Number(draft)
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("Monto inválido")
      return
    }
    startTransition(async () => {
      const res = await editServiceBase(id, n)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Precio actualizado")
        setEditing(false)
      }
    })
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center justify-end gap-1">
        {formatCOP(value)}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Editar precio base"
          onClick={() => {
            setDraft(String(value))
            setEditing(true)
          }}
        >
          ✏️
        </Button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-end gap-1">
      <Input
        type="number"
        min={1}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 w-28"
      />
      <Button type="button" size="sm" onClick={save} disabled={isPending}>
        {isPending ? "…" : "Guardar"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancelar
      </Button>
    </span>
  )
}

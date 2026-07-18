import { forwardRef } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const MoneyInput = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  function MoneyInput({ className, ...props }, ref) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          $
        </span>
        <Input ref={ref} type="number" min={1} step={1} className={cn("pl-6 tabular-nums", className)} {...props} />
      </div>
    )
  }
)

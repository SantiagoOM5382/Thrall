import { apiFetch } from "@/lib/api"
import { formatCOP, cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

interface RankingRow {
  position: number
  modelId: string
  name: string
  serviceCount: number
  totalBase: number
}

// Podium colors for the top three; everyone else gets a plain numeral.
const MEDAL: Record<number, string> = {
  1: "bg-[oklch(0.82_0.13_85)] text-[oklch(0.28_0.05_70)]",
  2: "bg-[oklch(0.82_0.01_260)] text-[oklch(0.32_0.01_260)]",
  3: "bg-[oklch(0.72_0.09_55)] text-[oklch(0.98_0.02_70)]",
}

function RankBadge({ position }: { position: number }) {
  const podium = MEDAL[position]
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums",
        podium ?? "bg-muted text-muted-foreground"
      )}
    >
      {position}
    </span>
  )
}

export default async function RankingPage() {
  const ranking = await apiFetch<RankingRow[]>("/reports/ranking")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ranking</h1>

      {ranking.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Aún no hay datos de servicios para el ranking.
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Servicios</TableHead>
                <TableHead className="text-right">Ingresos generados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r) => (
                <TableRow
                  key={r.modelId}
                  className={cn(r.position <= 3 && "font-medium")}
                >
                  <TableCell>
                    <RankBadge position={r.position} />
                  </TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.serviceCount}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCOP(r.totalBase)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

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

const MEDAL: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
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
                  <TableCell>{MEDAL[r.position] ?? r.position}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.serviceCount}</TableCell>
                  <TableCell className="text-right">
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

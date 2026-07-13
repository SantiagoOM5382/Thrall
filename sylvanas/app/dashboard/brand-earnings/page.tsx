import { apiFetch } from "@/lib/api"
import type { BrandEarningsReport } from "@/lib/types"
import {
  formatCOP,
  todayBogota,
  firstOfMonthBogota,
  dayStartBogotaMs,
  dayEndBogotaMs,
} from "@/lib/utils"
import { DateRangePicker } from "@/components/shared/date-range-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

export default async function BrandEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const from = sp.from ?? firstOfMonthBogota()
  const to = sp.to ?? todayBogota()
  const fromMs = dayStartBogotaMs(from)
  const toMs = dayEndBogotaMs(to)

  const report = await apiFetch<BrandEarningsReport>(
    `/reports/brand-earnings?from=${fromMs}&to=${toMs}`
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ingresos por brand</h1>
      <DateRangePicker />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead className="text-right">Servicios</TableHead>
              <TableHead className="text-right">Base total</TableHead>
              <TableHead className="text-right">Ganancia empresa</TableHead>
              <TableHead className="text-right">Ganancia modelos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((r) => (
              <TableRow key={r.brandId}>
                <TableCell className="font-medium">{r.brandName}</TableCell>
                <TableCell className="text-right">{r.totalServices}</TableCell>
                <TableCell className="text-right">{formatCOP(r.totalBase)}</TableCell>
                <TableCell className="text-right">{formatCOP(r.companyEarnings)}</TableCell>
                <TableCell className="text-right">{formatCOP(r.modelTotalEarnings)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totales</TableCell>
              <TableCell className="text-right">{report.totals.totalServices}</TableCell>
              <TableCell className="text-right">{formatCOP(report.totals.totalBase)}</TableCell>
              <TableCell className="text-right font-semibold">
                {formatCOP(report.totals.companyEarnings)}
              </TableCell>
              <TableCell className="text-right">
                {formatCOP(report.totals.modelTotalEarnings)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}

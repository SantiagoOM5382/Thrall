import { apiFetch } from "@/lib/api"
import type { Brand, User } from "@/lib/types"
import { formatBogotaDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandFormDialog } from "./brand-form-dialog"
import { NewAdminDialog } from "./new-admin-dialog"

export const dynamic = "force-dynamic"

export default async function BrandsPage() {
  const [brands, users] = await Promise.all([
    apiFetch<Brand[]>("/brands"),
    apiFetch<User[]>("/users"),
  ])
  const adminsByBrand = new Map<string, User[]>()
  for (const u of users) {
    if (u.role !== "admin") continue
    const list = adminsByBrand.get(u.brandId) ?? []
    list.push(u)
    adminsByBrand.set(u.brandId, list)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
        <BrandFormDialog mode="create" />
      </div>

      {brands.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No hay brands.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {brands.map((b) => {
            const admins = adminsByBrand.get(b.id) ?? []
            return (
              <Card key={b.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{b.name}</CardTitle>
                    {b.isActive === 1 ? (
                      <Badge>Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <BrandFormDialog mode="edit" initial={{ id: b.id, name: b.name }} />
                    <NewAdminDialog brandId={b.id} brandName={b.name} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Creada {formatBogotaDate(b.createdAt, { dateStyle: "medium" })}
                  </p>
                  <p className="font-medium">Admins ({admins.length})</p>
                  {admins.length === 0 ? (
                    <p className="text-muted-foreground">Sin admins.</p>
                  ) : (
                    <ul className="text-muted-foreground">
                      {admins.map((a) => (
                        <li key={a.id}>{a.name} · {a.email}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

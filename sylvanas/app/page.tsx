import Link from "next/link"
import { apiFetchPublic } from "@/lib/api"
import type { Model } from "@/lib/types"
import { ModelAvatar } from "@/components/shared/model-avatar"
import { Card, CardContent } from "@/components/ui/card"

export const revalidate = 3600

async function getModels(): Promise<Model[]> {
  try {
    return await apiFetchPublic<Model[]>("/models")
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const models = await getModels()
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Arthas"

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{appName}</h1>
        <p className="mt-2 text-muted-foreground">Nuestras modelos</p>
      </header>

      {models.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">
          No hay modelos disponibles en este momento.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <Link key={model.id} href={`/models/${model.id}`} className="group">
              <Card className="overflow-hidden p-0 transition-shadow group-hover:shadow-lg">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                  <ModelAvatar
                    url={model.images[0]?.url}
                    name={model.name}
                    size="lg"
                    className="transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <CardContent className="p-4">
                  <h2 className="font-medium">{model.name}</h2>
                  {model.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {model.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

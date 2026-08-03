import type { MetadataRoute } from "next"
import { apiFetchPublic } from "@/lib/api"
import type { Model } from "@/lib/types"

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://musa.co"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/legal/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/legal/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  try {
    const models = await apiFetchPublic<Model[]>("/models")
    const modelEntries: MetadataRoute.Sitemap = models.map((m) => ({
      url: `${BASE_URL}/models/${m.id}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    }))
    return [...staticEntries, ...modelEntries]
  } catch {
    return staticEntries
  }
}

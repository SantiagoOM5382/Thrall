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
    // Fetch everything (bounded by thrall's MAX_LIMIT=500) so every model
    // profile URL and every landing paginated URL land in the sitemap.
    const { models, total, limit } = await apiFetchPublic<{
      models: Model[]; total: number; limit: number
    }>("/models?limit=500")
    const modelEntries: MetadataRoute.Sitemap = models.map((m) => ({
      url: `${BASE_URL}/models/${m.id}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    }))
    // One extra sitemap entry per landing page beyond the first.
    const PAGE_SIZE = 10
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const pageEntries: MetadataRoute.Sitemap = []
    for (let p = 2; p <= totalPages; p++) {
      pageEntries.push({
        url: `${BASE_URL}/?page=${p}`,
        lastModified: now,
        changeFrequency: "hourly",
        priority: 0.6,
      })
    }
    void limit
    return [...staticEntries, ...pageEntries, ...modelEntries]
  } catch {
    return staticEntries
  }
}

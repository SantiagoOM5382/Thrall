export interface ModelImage {
  id: string
  url: string
  sortOrder: number
}

export interface Model {
  id: string
  name: string
  phone: string | null
  telegram: string | null
  description: string | null
  images: ModelImage[]
}

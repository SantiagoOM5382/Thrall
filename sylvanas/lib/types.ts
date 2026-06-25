export type Role = "admin" | "monitor" | "model"

export interface ModelImage {
  id: string
  url: string
  sortOrder: number
}

export interface Model {
  id: string
  brandId: string
  name: string
  email: string
  role: Role
  phone: string | null
  telegram: string | null
  description: string | null
  isActive: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  images: ModelImage[]
}

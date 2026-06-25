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

export interface PayMethod {
  id: string
  code: string
  displayName?: string // only present for admin
  isActive: number
}

export interface ServiceExtra {
  id: string
  serviceId: string
  description: string
  amount: number
  createdAt: number
}

export interface Service {
  id: string
  modelId: string
  createdBy: string
  startTime: number
  endTime: number
  basePrice: number
  payMethodId: string
  note: string | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  extras: ServiceExtra[]
}

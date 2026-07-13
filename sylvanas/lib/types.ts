export type Role = "admin" | "monitor" | "model" | "dev"

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

export type User = Omit<Model, "images">

export interface Brand {
  id: string
  name: string
  isActive: number
  createdAt: number
  updatedAt: number
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

export interface Fine {
  id: string
  modelId: string
  amount: number
  reason: string
  createdBy: string
  createdAt: number
  deletedAt: number | null
}

export type Loan = Fine // identical shape

export interface Payment {
  id: string
  modelId: string
  amount: number
  payMethodId: string
  createdBy: string
  createdAt: number
}

export interface ModelBalance {
  balance: number
  totalEarnings: number
  totalFines: number
  totalLoans: number
  totalPayments: number
}

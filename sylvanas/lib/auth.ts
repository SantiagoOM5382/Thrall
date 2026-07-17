"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { homeRouteForRole } from "@/lib/routes"

const COOKIE_NAME = "arthas_token"

export interface LoginResult {
  error?: string
  redirectTo?: string
}

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  let redirectTo: string

  try {
    const res = await fetch(`${process.env.THRALL_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { error: body.error ?? "Credenciales inválidas" }
    }

    const { token, user } = await res.json()
    ;(await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24h
      path: "/",
    })

    redirectTo = homeRouteForRole(user.role)
  } catch {
    return { error: "No se pudo conectar con el servidor" }
  }

  return { redirectTo }
}

export interface SignupResult {
  error?: string
  redirectTo?: string
}

const SIGNUP_ERROR_MESSAGES: Record<string, string> = {
  email_in_use: "Ese email ya está registrado",
  brand_name_in_use: "Ese nombre de agencia ya existe",
}

export async function signup(
  brandName: string,
  adminName: string,
  email: string,
  password: string
): Promise<SignupResult> {
  try {
    const res = await fetch(`${process.env.THRALL_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName, adminName, email, password }),
      cache: "no-store",
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return {
        error: SIGNUP_ERROR_MESSAGES[body.error] ?? "No se pudo crear la cuenta",
      }
    }

    const { token, user } = await res.json()
    ;(await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24h
      path: "/",
    })

    return { redirectTo: homeRouteForRole(user.role) }
  } catch {
    return { error: "No se pudo conectar con el servidor" }
  }
}

export async function logout() {
  ;(await cookies()).delete(COOKIE_NAME)
  redirect("/login")
}

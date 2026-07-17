import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { DashboardHome } from "@/components/dashboard/dashboard-home"

export default async function DashboardIndex() {
  const user = await getSession()
  if (!user) redirect("/login")
  if (user.role === "dev") redirect("/dashboard/brands")
  if (user.role === "model") redirect("/dashboard/profile")
  return <DashboardHome />
}

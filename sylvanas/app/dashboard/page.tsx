import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"

export default async function DashboardIndex() {
  const user = await getSession()
  if (!user) redirect("/login")
  redirect(user.role === "model" ? "/dashboard/profile" : "/dashboard/services")
}

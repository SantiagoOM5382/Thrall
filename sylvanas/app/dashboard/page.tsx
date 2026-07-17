import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { homeRouteForRole } from "@/lib/routes"
import { DashboardHome } from "@/components/dashboard/dashboard-home"

export default async function DashboardIndex() {
  const user = await getSession()
  if (!user) redirect("/login")

  const home = homeRouteForRole(user.role)
  if (home !== "/dashboard") redirect(home)

  return <DashboardHome />
}

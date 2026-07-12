import { redirect } from "next/navigation"

export default function Home() {
  // Sylvanas is the admin dashboard only. The public showcase lives in illidan.
  // The dashboard layout / middleware handle auth and role-based routing.
  redirect("/dashboard")
}

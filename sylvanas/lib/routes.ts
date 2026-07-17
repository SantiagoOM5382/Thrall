import type { Role } from "@/lib/types"

// Single source of truth for "where does this role land after auth" — used
// by login/signup redirects and by /dashboard's own index page, so they
// can never drift apart again.
export function homeRouteForRole(role: Role): string {
  if (role === "model") return "/dashboard/profile"
  if (role === "dev") return "/dashboard/brands"
  return "/dashboard"
}

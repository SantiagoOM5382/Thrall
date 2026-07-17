const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Arthas"
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL
const DEVELOPER_NAME = process.env.NEXT_PUBLIC_DEVELOPER_NAME

export function DashboardFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <p>
          {APP_NAME} © {year}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {CONTACT_EMAIL && (
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
              {CONTACT_EMAIL}
            </a>
          )}
          {DEVELOPER_NAME && <p>Desarrollado por {DEVELOPER_NAME}</p>}
        </div>
      </div>
    </footer>
  )
}

import { Mail } from "lucide-react"
import { InstagramIcon, WhatsAppIcon, TikTokIcon, XIcon } from "./social-icons"

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Arthas"
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL
const DEVELOPER_NAME = process.env.NEXT_PUBLIC_DEVELOPER_NAME

// Each entry only renders once its env var is set — no placeholder links
// pointing nowhere while handles/URLs are still being decided.
const SOCIALS = [
  { href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM, label: "Instagram", Icon: InstagramIcon },
  { href: process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP, label: "WhatsApp", Icon: WhatsAppIcon },
  { href: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK, label: "TikTok", Icon: TikTokIcon },
  { href: process.env.NEXT_PUBLIC_SOCIAL_X, label: "X", Icon: XIcon },
].filter((s): s is { href: string; label: string; Icon: typeof InstagramIcon } => !!s.href)

export function DashboardFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/30">
      <div className="grid gap-8 px-6 py-10 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary font-heading text-sm font-bold text-primary-foreground">
              {APP_NAME[0]}
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">
              {APP_NAME}
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            El panel administrativo para tu agencia de modelos — servicios, ganancias y visibilidad, en un solo lugar.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Contacto
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            {CONTACT_EMAIL ? (
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-2 text-foreground/80 hover:text-primary"
              >
                <Mail className="size-4" />
                {CONTACT_EMAIL}
              </a>
            ) : (
              <p className="text-muted-foreground/60 italic">Próximamente</p>
            )}
          </div>
          {SOCIALS.length > 0 && (
            <div className="mt-4 flex gap-2">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/70 transition-colors hover:bg-primary/15 hover:text-primary"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Créditos
          </h3>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            {DEVELOPER_NAME && <p>Desarrollado por {DEVELOPER_NAME}</p>}
            <p>
              © {year} {APP_NAME}. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

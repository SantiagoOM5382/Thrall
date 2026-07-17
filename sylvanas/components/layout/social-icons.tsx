import type { SVGProps } from "react"

// Lucide dropped brand marks a while back, so these are small inline SVGs —
// sized and stroked/filled to sit comfortably next to lucide icons elsewhere.
export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.47 14.38c-.29-.15-1.73-.85-2-.95-.27-.1-.46-.15-.66.15-.2.29-.76.94-.93 1.14-.17.2-.34.22-.63.07-.29-.15-1.22-.45-2.32-1.43-.86-.76-1.44-1.71-1.6-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.58-.9-2.17-.24-.57-.48-.5-.66-.5-.17 0-.37-.02-.56-.02-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44s1.05 2.83 1.19 3.02c.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.67.61.7.22 1.34.19 1.84.12.56-.08 1.73-.71 1.98-1.39.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34Z" />
      <path d="M12.02 2C6.5 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.08-1.33A9.96 9.96 0 0 0 12.02 22C17.52 22 22 17.52 22 12S17.52 2 12.02 2Zm0 18.13c-1.65 0-3.19-.45-4.51-1.24l-.32-.19-3.02.79.8-2.94-.21-.32A8.1 8.1 0 0 1 3.87 12c0-4.5 3.65-8.15 8.15-8.15S20.17 7.5 20.17 12s-3.65 8.13-8.15 8.13Z" />
    </svg>
  )
}

export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 5.82c-.9-.63-1.52-1.6-1.7-2.72h-3.02v13.1c0 1.42-1.15 2.57-2.57 2.57a2.57 2.57 0 0 1-2.57-2.57 2.57 2.57 0 0 1 2.57-2.57c.24 0 .48.03.7.1v-3.08a5.6 5.6 0 0 0-.7-.05A5.6 5.6 0 0 0 3.75 16.1a5.6 5.6 0 0 0 5.56 5.6 5.6 5.6 0 0 0 5.6-5.6V9.03a8.15 8.15 0 0 0 4.6 1.42V7.44c-1.03 0-2.03-.32-2.9-.9Z" />
    </svg>
  )
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m4 3 7.09 9.06L4.28 21H6.9l5.53-6.6L17 21h4l-7.4-9.44L20.02 3h-2.62l-5.14 6.13L9 3H4Zm2.85 1.72h1.9l9.4 12.56h-1.9L6.85 4.72Z" />
    </svg>
  )
}

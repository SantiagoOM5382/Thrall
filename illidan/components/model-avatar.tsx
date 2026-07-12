import { cn } from "@/lib/utils"

const SIZES = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-lg",
  lg: "h-full w-full text-3xl",
} as const

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function ModelAvatar({
  url,
  name,
  size = "md",
  className,
}: {
  url?: string
  name: string
  size?: keyof typeof SIZES
  className?: string
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        className={cn(
          "object-cover",
          size === "lg" ? "h-full w-full" : `${SIZES[size]} rounded-full`,
          className
        )}
      />
    )
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
        SIZES[size],
        className
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  )
}

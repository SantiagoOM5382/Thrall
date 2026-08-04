"use client"

import { useRef, useState } from "react"

// A model card's cover slot. Priority:
//   1. If the model has a video preview (mp4/webm) → show video paused on
//      frame 0 as the default state; play on hover, pause+reset on leave.
//   2. If the preview is a gif → show it (gif auto-plays natively; browsers
//      can't pause a gif without canvas trickery, so we accept always-animated
//      for that case).
//   3. Otherwise → static cover photo (previous behaviour).
export function ModelCardMedia({
  name,
  cover,
  previewUrl,
  fallback,
}: {
  name: string
  cover: string | undefined
  previewUrl: string | null | undefined
  fallback: React.ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  const isVideo =
    !!previewUrl && (previewUrl.endsWith(".mp4") || previewUrl.endsWith(".webm"))
  const isGif = !!previewUrl && previewUrl.endsWith(".gif")

  function onEnter() {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => { /* some browsers block autoplay; the video stays paused, which is fine */ })
    }
  }
  function onLeave() {
    if (isVideo && videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  // Video preview available: it IS the primary visual.
  if (isVideo) {
    return (
      <div onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave} className="h-full w-full">
        <video
          ref={videoRef}
          src={previewUrl!}
          poster={cover}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={() => setReady(true)}
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
        />
        {/* While the video's first frame is loading, keep the static cover
            visible under it as a soft placeholder — avoids a black flash. */}
        {!ready && cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={name}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            aria-hidden="true"
          />
        )}
      </div>
    )
  }

  // GIF preview: browser plays it continuously — no way to pause without
  // canvas-based frame extraction, so accept always-animated here.
  if (isGif) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl!}
        alt={name}
        className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
      />
    )
  }

  // No preview at all — fall back to static gallery photo, or initials.
  if (!cover) {
    return <div className="flex h-full w-full items-center justify-center">{fallback}</div>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cover}
      alt={name}
      className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
    />
  )
}

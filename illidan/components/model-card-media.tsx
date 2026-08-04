"use client"

import { useRef } from "react"

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

  // URL-suffix detection covers uploads made after the extension fix; anything
  // uploaded before that (paths without extensions) defaults to video, which
  // is the correct guess for the vast majority of previews (mp4/webm).
  const isGif = !!previewUrl && previewUrl.endsWith(".gif")
  const isVideo =
    !!previewUrl && !isGif

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
  //
  // Deliberately NO `poster` attribute — `poster` is not a "loading
  // placeholder", it's a persistent image the browser shows UNTIL the video
  // actually starts playing. Using the static gallery cover as poster meant
  // the video was hidden behind that photo on first load, only revealing on
  // hover. Without a poster the browser renders the video's own first frame
  // as the thumbnail. Nudging currentTime forces that frame to render even
  // in browsers that would otherwise show a blank rectangle.
  if (isVideo) {
    return (
      <div onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave} className="h-full w-full">
        <video
          ref={videoRef}
          src={previewUrl!}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={name}
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.01 }}
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
        />
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

"use client"

import { useEffect, useRef } from "react"

// A model card's cover slot. Priority:
//   1. If the model has a video preview (mp4/webm) → autoplay when the card
//      scrolls into view; pause when it scrolls out. Works identically on
//      desktop and mobile (no hover:hover feature detection needed).
//   2. If the preview is a gif → let the browser render it (auto-animates).
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
  const isVideo = !!previewUrl && !isGif

  // Instagram/Reels-style visibility playback. threshold=0.5 → the video only
  // starts once at least half of the card is on screen, so scrolling briefly
  // past a card doesn't trigger an instant play+pause. Only the currently
  // visible cards spend bandwidth on video data.
  useEffect(() => {
    const el = videoRef.current
    if (!el || !isVideo) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => { /* autoplay blocked by browser policy; harmless */ })
        } else {
          el.pause()
          el.currentTime = 0
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isVideo])

  // Video preview: it IS the primary visual.
  //
  // Deliberately NO `poster` attribute — `poster` is not a "loading
  // placeholder", it's a persistent image the browser shows UNTIL the video
  // actually starts playing. Without a poster the browser renders the video's
  // own first frame as the thumbnail. Nudging currentTime forces that frame
  // to render even in browsers that would otherwise show a blank rectangle
  // (matters for the split-second before the IntersectionObserver fires).
  if (isVideo) {
    return (
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

"use client"

import { useRef, useState } from "react"

// A model card's cover slot: static photo by default; on hover / focus,
// crossfades to the animated preview if the model has one. Video previews
// (mp4/webm) autoplay muted-looping on desktop hover; gif URLs animate
// natively via <img>. Falls back to just the static photo when there's no
// preview URL.
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
  const [hovering, setHovering] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const isVideo =
    !!previewUrl && (previewUrl.endsWith(".mp4") || previewUrl.endsWith(".webm"))
  const isGif = !!previewUrl && previewUrl.endsWith(".gif")

  function onEnter() {
    setHovering(true)
    if (isVideo && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => { /* autoplay may be blocked; harmless */ })
    }
  }
  function onLeave() {
    setHovering(false)
    if (isVideo && videoRef.current) {
      videoRef.current.pause()
    }
  }

  if (!cover) {
    return <div className="flex h-full w-full items-center justify-center">{fallback}</div>
  }

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className="relative h-full w-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt={name}
        className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
      />
      {isVideo && (
        <video
          ref={videoRef}
          src={previewUrl!}
          muted
          loop
          playsInline
          preload="metadata"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            hovering ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {isGif && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl!}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            hovering ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  )
}

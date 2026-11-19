# Block-editor media attachments download their blob only within 200px of the viewport

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `FileNodeView.test.tsx` (no fetch for a plain file, deferred fetch for an image until
  in view, fetch for an in-view video); the 200px margin is `reviewer`
- **Related:** #36456

## Context
`FileNodeView` fetched each attachment's authenticated blob on mount through
`useAuthenticatedImage`. A block-editor surface (knowledge page, entity description) with N
image/video/audio attachments therefore fired N `downloadAsset` requests up front, regardless of
how many were on screen — a burst that scales with attachment count, not with what the user sees.
Plain files never had this cost: they download on click.

## Decision
- Image, video and audio attachments download their blob only once the node is within **200px** of
  the viewport (`rootMargin: '200px'`), at most once per mount (`triggerOnce`). Where
  `IntersectionObserver` is unavailable they load immediately (`fallbackInView: true`).
- Plain file attachments (`FileType.FILE`) are unchanged — no blob fetch until the user clicks to
  download.
- The split lives in `useAuthenticatedMediaUrls`: it passes the real URL to the auth hook only when
  `fileType !== FileType.FILE && inView`, otherwise an empty string, which the hook no-ops on.

## Consequences
Only media near the viewport loads, so a long page of attachments no longer fetches every blob at
once. The 200px margin trades a small amount of eager prefetch for media appearing loaded as it
scrolls in; widen it if media visibly pops in on fast scroll, narrow it if the prefetch is wasteful.
Revisit the eager/lazy split if plain files ever need inline preview, or if a surface renders the
editor fully off-screen (export, print, screenshot) and needs every attachment resolved regardless
of viewport.

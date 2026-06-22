# LogViewer Modal — Pure Component Design

**Date:** 2026-06-22
**Status:** Approved (design), pending implementation plan

## Summary

A reusable, presentational **`LogViewerModal`** component that displays log text
in a dark terminal-style modal matching the attached "AI Automations" design
reference. It wraps the existing `@melloware/react-logviewer` (`LazyLog`) library
for the actual log rendering (virtualized lines, line numbers, search, ANSI
colors) and uses the `@openmetadata/ui-core-components` React-Aria modal shell
for the overlay, backdrop, focus-trap, and animations.

The component does **no data fetching**. It is fully controlled by its parent,
which owns `open`, `logs`, and `loading`. It is designed to be live-log ready via
a `follow` prop (auto-tail) without implementing any streaming itself.

## Goals

- Display a full log string in a modal styled to match the screenshot
  (dark surface, light monospace text, line-number gutter, bottom search bar).
- Reuse the existing `LazyLog` library — no custom log renderer.
- Use Untitled UI / Tailwind (`tw:`) styling and the `ui-core-components` modal
  primitives. No MUI.
- Be a "pure" presentational component: stateless beyond `LazyLog`'s internals,
  controlled open/close, no API calls.
- Be live-log ready (future scope) through a single `follow` prop.

## Non-Goals

- No data fetching, polling, or WebSocket wiring (parent's responsibility).
- No "AI Automations" page/feature wiring — this spec covers only the reusable
  modal component. (That feature does not exist in the codebase yet.)
- No changes to `ui-core-components` (the log library stays a main-UI-app
  dependency).

## Location

Main UI app (decided — Option A), because `@melloware/react-logviewer` is already
a dependency there and not of the `ui-core-components` library.

```
openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/
  LogViewerModal.component.tsx     # presentational component, no data fetching
  LogViewerModal.interface.ts      # LogViewerModalProps
  LogViewerModal.test.tsx          # Jest + React Testing Library
  log-viewer-modal.less            # scoped theming for LazyLog internals only
```

## Public Interface

```ts
interface LogViewerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;                 // e.g. "Auto-document workflow · logs"
  logs: string;                  // full log text (LazyLog consumes a string)
  loading?: boolean;             // show loader while parent fetches; default false
  theme?: 'dark' | 'light';      // default 'dark' (matches screenshot)
  follow?: boolean;              // default false; live-tail auto-scroll to newest line
  enableSearch?: boolean;        // default true (bottom search bar)
  enableCopy?: boolean;          // default true (copy-all button in header)
  onDownload?: () => void;       // download button; rendered only when provided
}
```

- **Controlled**: parent supplies `open` and `onClose`.
- **`theme`**: `'dark'` applies the library's `dark-mode` scoping class so Untitled
  tokens resolve to dark values, plus dark `LazyLog` theming; `'light'` uses light
  tokens with a light-themed log panel.
- **`follow`**: passed straight through to `LazyLog.follow`. When a parent later
  streams `logs`, setting `follow` keeps the view pinned to the newest line. No
  other component change is needed for live logs.

## Architecture / Approach

**Approach 1 (chosen):** Compose the modal from `ui-core-components` primitives —
`ModalOverlay` + `Modal` + `AriaDialog` — with a custom dark body, rather than the
high-level `Dialog` composite (whose built-in padding/border/footer and single
absolute close-button fight the full-bleed terminal layout and inline header
actions).

Layout:

- `ModalOverlay` — dim + blur backdrop, enter/exit fade (from the library).
- `Modal` — centered container, roughly `max-w-4xl`, ~80vh tall, zoom animation.
- Root wrapper `<div class="log-viewer-modal">` carrying the `dark-mode` class when
  `theme === 'dark'`.
- **Header row**: title text on the left (`tw:text-sm tw:font-semibold`); right-aligned
  icon buttons — Copy-all, Download (only if `onDownload`), Close — built from
  `ButtonUtility` / `CloseButton` + `@untitledui/icons`.
- **Body**: full-bleed `LazyLog` filling the remaining height with props:
  `text={logs}`, `enableSearch`, `enableLineNumbers`, `selectableLines`,
  `caseInsensitive`, `follow={follow}`, `extraLines={1}`. The library's built-in
  search bar renders at the bottom, matching the screenshot.
- **Loading**: when `loading`, render the existing `Loader` in the body instead of
  `LazyLog`.

### Styling

- The modal shell, header, and buttons use pure `tw:` classes + `ui-core-components`
  and design tokens — no hardcoded colors.
- `LazyLog`'s internal DOM (search bar, line-number gutter, line text) is
  third-party and cannot take `tw:` classes. A small `.less` scoped under
  `.log-viewer-modal` themes those internals using CSS variables / design tokens.
  `LazyLog`'s default theme is already a dark terminal, so the dark variant is
  mostly defaults; the light variant overrides background/text/gutter colors.
  This mirrors the existing `app-logs-viewer.less` / `logs-viewer-page.style.less`
  pattern already in the codebase.

### Data flow

Fully controlled and stateless beyond `LazyLog`'s own virtualization/search state.
Parent owns `open`, `logs`, `loading`, and the `follow` toggle. Copy is handled by
the existing `CopyToClipboardButton` util on `logs`; download calls `onDownload`.

### Internationalization

The component itself uses `useTranslation` for a single key: `label.download` (the
download button tooltip). Copy labeling is handled by the reused
`CopyToClipboardButton`, which manages its own `message.copy-to-clipboard` keys
internally. The `LazyLog` search bar renders the library's built-in (untranslated)
English placeholder — there are no other string literals in the component's own code.
`title` is always a prop supplied by the caller.

## Library API confirmation

`LazyLog` v6 (`@melloware/react-logviewer` 6.4.1) exposes everything required:
`follow`, `enableSearch`, `enableLineNumbers`, `selectableLines`, `caseInsensitive`,
`extraLines`, `text`, `style`/container style, `lineClassName`,
`highlightLineClassName`, and an `onScroll` callback. No gaps.

## Testing

`LogViewerModal.test.tsx` (Jest + React Testing Library):

- Renders log content when `open` is `true`; renders nothing when `open` is `false`.
- Displays the provided `logs` text and the `title`.
- Copy button present when `enableCopy` (default) and absent when `false`.
- Download button rendered only when `onDownload` is provided; clicking it calls
  `onDownload`.
- Clicking close calls `onClose`.
- `loading` shows the loader instead of the log body.
- `theme='light'` applies the light theme; `theme='dark'` (default) applies the
  dark theme class.

(`LazyLog` itself is mocked/stubbed in the unit test to avoid virtualization noise;
assertions target the component's own structure and props wiring.)

## Future Scope (out of scope for this implementation)

- Live log streaming: a parent component fetches/streams logs (WebSocket or
  polling), continually grows the `logs` string, and sets `follow` to keep the
  viewer pinned to the latest line. No change to `LogViewerModal` required.

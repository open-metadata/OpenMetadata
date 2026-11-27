# Copy-to-clipboard actions use the shared CopyButton

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `CopyButton.test.tsx` (success state, accessible name, click does not reach a parent
  row, labeled variant); reviewer for new call sites
- **Related:** open-metadata/OpenMetadata#37953

## Context
The UI had three copy components (`CopyLinkButton` in Context Center, `common/CopyLinkButton` for
field links, `common/CopyToClipboardButton`) and about thirty hand-rolled `ButtonUtility icon={Copy01}`
+ `useClipboard` blocks. Each gave different feedback — a toast, a tooltip swap, an icon swap, or
nothing — and some copy buttons inside clickable rows also triggered the row.

## Decision
- Every copy-to-clipboard action renders `components/common/CopyButton/CopyButton`: icon-only by
  default, or a text button with `label`. Duplicate/clone actions that merely reuse the `Copy01`
  glyph, and dropdown menu items, are not copy buttons and stay as they are.
- Success is shown by the button itself: icon-only turns into a green circle with a check and a ring
  pulse, and its tooltip reads "Copied"; the labeled variant turns green and its text reads "Copied".
  A copy action does not also raise a success toast.
- The copied state resets after 1200 ms — long enough to read the check, short enough to copy again.
- `CopyButton` stops propagation and prevents default on click, so copying inside a clickable row,
  card or form never activates it.
- Callers pass layout classes only; the copied colours are applied after the caller's `className`
  so they always win.

## Consequences
Copy feedback looks and behaves the same everywhere, and a new copy action is one element. A failed
copy (clipboard API and `execCommand` both refused) leaves the button idle without a message; add an
error path to `useClipboard` if that turns out to matter. Revisit if a surface needs a copy action
whose feedback must outlive the 1200 ms state (for example a one-time secret that must be
acknowledged).

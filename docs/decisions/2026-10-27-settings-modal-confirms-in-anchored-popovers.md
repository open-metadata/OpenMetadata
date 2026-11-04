# Confirmations inside the settings modal use an anchored popover, not a modal

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial) · v2 2026-10-27 (shared tables report the pressed control; `useLastPressedTrigger` removed) · v3 2026-10-27 (entity delete is a radio choice)
- **Deciders:** UI team
- **Guard:** `confirm-popover.test.tsx`, `DeleteEntityPopover.test.tsx`, `useAnchoredConfirm.test.tsx`; reviewer for new panels
- **Related:** ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only

## Context
The new settings UI (`PersonalSpaceModal`) is itself a modal. Delete, remove, restore, reset,
uninstall and similar confirmations opened a second modal on top, stacking two backdrops and hiding
the table the user was acting on.

## Decision
- A confirmation raised inside the settings modal uses core `ConfirmPopover` anchored to the control
  that asked for it, never a modal. Form, viewer, export and unsaved-changes dialogs are out of scope.
- An action handler resolves to whether it succeeded: resolving `false` or rejecting keeps the
  popover open so the user can retry; anything else closes it.
- Entity deletes use `DeleteEntityPopover`. When soft delete is allowed it asks soft or permanent
  delete with a radio choice, soft selected by default and reset to it whenever the popover opens or
  closes; confirm is named after and performs the chosen delete. Otherwise confirm is the permanent
  delete.
- When the action comes from a menu or a shared table that only reports a callback, the table
  passes the pressed control (the button, or the row menu's trigger) as the callback's second
  argument — `onDelete(row, trigger)` — and `useAnchoredConfirm().open(row, trigger)` anchors the
  popover to it.
- Shared components that legacy `/settings` pages also render keep their modal by default and opt
  into the popover through a prop, so the legacy pages do not change.

## Consequences
New settings panels, including ones Collate contributes, confirm in a popover and return a success
boolean from their handlers. The legacy `/settings` pages keep their modals until they are retired.
Revisit if the settings UI stops being an overlay.

## Amendment — v2: shared tables report the pressed control

v1 anchored a callback-driven confirmation through `useLastPressedTrigger`, which listened for
presses on a container around the table and guessed the button. That hook is removed. A shared
table that reports an action as a callback now passes the pressed control as the callback's second
argument, `onDelete(row, trigger)`; legacy callers that take only `row` are unaffected.
`useAnchoredConfirm().open(row, trigger)` stores it as the popover's anchor; it no longer returns a
`containerRef`. A panel that calls `open(row)` without a trigger leaves the popover unanchored.

## Amendment — v3: entity delete is a radio choice

v1 put permanent delete in a secondary footer action next to a soft-delete confirm. Following the
design, `DeleteEntityPopover` now shows Soft delete and Delete permanently as radio options (core
`RadioButton`, `variant="card"`), soft selected by default; the confirm button is named after the
choice and performs it. The choice resets to soft whenever the popover opens or closes, so a
cancelled permanent choice never carries over to the next delete.

# Confirmations inside the settings modal use an anchored popover, not a modal

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
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
- Entity deletes use `DeleteEntityPopover`. When soft delete is allowed it is the default (confirm)
  action and permanent delete is a secondary footer action, replacing `DeleteEntityModal`'s radio
  choice; otherwise confirm is the permanent delete.
- When the action comes from a menu or a shared table that only reports a callback, the popover
  anchors to the pressed button through `useAnchoredConfirm` / `useLastPressedTrigger`.
- Shared components that legacy `/settings` pages also render keep their modal by default and opt
  into the popover through a prop, so the legacy pages do not change.

## Consequences
New settings panels, including ones Collate contributes, confirm in a popover and return a success
boolean from their handlers. The legacy `/settings` pages keep their modals until they are retired.
Revisit if the settings UI stops being an overlay.

# Settings modal views push a history entry only when the user opens them

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Harsh Vador
- **Guard:** `useSettingsHash.test.tsx` (`setHash` replaces unless asked to push; closing goes
  back past the views the modal pushed; the sync hook reopens a closed modal on a view change and
  closes an open one when Back clears the hash); `PersonasPanel.test.tsx` (Back from a persona
  returns to the list); `PersonaSettings.spec.ts` ("browser Back returns to the previous persona
  view")
- **Related:** ADR:2026-10-21-settings-pages-are-classic-only, `hooks/useSettingsHash.ts`,
  `Profile/tabs/personas/PersonasPanel.tsx`

## Context
The AI-mode settings modal keeps its view in the URL hash (`#<tab>[/<subPath>]`). Every view
change was written with `replace`, so opening a persona from the Personas list added no history
entry and the browser Back button left the modal and the page. Switching `setHash` to push
everywhere is not safe: about a dozen panels call it from effects to redirect (a permission
check, a stale link). A pushed redirect puts the redirecting entry under Back, which redirects
again, so Back is trapped.

## Decision
- **`setHash` replaces by default.** A caller passes `{ push: true }` only for a view the user
  opened: a card, a breadcrumb, an Add button, a menu item. Redirects run from effects and
  `updateParams` (paging, a detail tab) always replace.
- **Leaving a view after a delete, a create or a Cancel replaces**, so Back never reopens a
  removed entity or a submitted form.
- **Opening the modal from the user menu pushes**, so the page's own entry never carries a
  settings hash. Each push records the hash it left (`{ fromHash }` in the history state), and the
  hook instance in `useSettingsHashSync` counts the pushes made since the modal opened over the
  page. Closing goes back past all of them to the page's entry, as for a settings link (see
  ADR:2026-10-21-settings-pages-are-classic-only).
- **The sync hook follows Back and Forward.** With the modal closed and a hash still set (the
  fullscreen persona customizer closes it silently), a change of `tab/subPath` reopens it. With
  the modal open, Back to an entry with no settings hash closes it.
- A panel opts in to pushing one view at a time. Personas is the first; the other tabs still
  replace.

## Consequences
- Back and Forward walk the views the user opened, and closing the modal leaves no settings
  entries behind it in history.
- Known gaps: Back from a dirty in-modal customize editor does not show its unsaved-changes
  prompt (breadcrumbs, Cancel and Close do; the fullscreen customizer's own guard still runs).
  A modal opened by a deep link or a refresh sits on an entry that already has a hash, so its
  pushes are not counted and closing replaces as before. Back after that close returns to the
  last pushed view. After the user goes Back inside the modal the count resets, and closing
  replaces the current entry, which leaves a duplicate page entry, never a settings one.
- Revisit if the router gains a blocker that can guard popstate, or if every tab adopts push, at
  which point the default could flip with the redirects marked `replace` explicitly.

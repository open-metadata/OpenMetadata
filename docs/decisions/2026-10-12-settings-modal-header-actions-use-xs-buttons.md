# Settings modal header actions use `xs` buttons; form footers keep the default size

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Rohit Jain
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#35264

## Context
The settings modal (`PersonalSpaceModal` → `ProfilePage`) renders a compact content header — title,
description and an action slot on the right. At the core `Button` default size (`sm`), primary
actions such as "Add Admin" or "Add Team" dominate that header and outweigh the title. Form footers
(Save / Cancel / Test Login) are the primary call to action of a page and read correctly at the
default size.

## Decision
- Buttons passed to the settings-modal content header — via a panel's `onSetHeaderActions` or
  `ProfileHeaderOverride.actions` — use `size="xs"`.
- Form footer buttons and dialog buttons in the modal use the core `Button` default size (no `size`
  prop).

## Consequences
New settings panels follow the same split, so the header stays visually lighter than the form it
controls. Revisit if `ProfileContentHeader` starts enforcing the size itself (then this becomes the
component's default rather than a call-site rule) or if the core `Button` scale changes.

---
description: Frontend accessibility — semantics, keyboard, focus, names, contrast, targets, forms, motion
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Frontend accessibility

Applies to UI `*.{ts,tsx}`. Library choice in `component-library.md`; tokens/contrast values in
`frontend-styling.md`; component conventions in `frontend-react.md`.

## Use the library — it is the accessible path

- `@openmetadata/ui-core-components` is built on **react-aria-components**: roving focus, typeahead,
  `aria-*` wiring, focus trap/restore, and screen-reader announcements are already correct. Reach for
  `Select`, `Dropdown`, `Tabs`, `Modal`, `Toggle`, `RadioButtons`, `Tooltip`, `Popover` **before**
  hand-rolling anything with `role=` + `onKeyDown`.
- `eslint-plugin-jsx-a11y` runs at **error** on 24 rules with a measured zero backlog — an invalid
  `role`, a role missing its required `aria-*` props, a positive `tabIndex`, a label with no control.
  Do not reach for `eslint-disable` to get past them; use the library component instead.
- No new Ant Design (`yarn tw-guard` blocks it) — do not reintroduce `antd` for its a11y behavior.

## Semantics

- **Semantic element first, `div` + `role` never as a default.** `<button>` for actions, `<a href>`
  for navigation, `<ul>/<li>` for lists, `<nav>/<main>/<header>`, `<h1>`–`<h6>` in order without skips.
- A clickable `<div>`/`<span>` is a bug: it has no role, no tab stop, no Enter/Space activation.
- Never put `onClick` on a non-interactive element without also giving it a real role, `tabIndex={0}`,
  and keyboard activation — or better, converting it to `Button`.
- `role="presentation"` / `aria-hidden` only on decorative visuals; never on anything focusable.

## Keyboard

- **Every interactive element must be reachable by Tab and activatable by Enter (and Space for
  buttons/checkboxes).** Escape closes overlays. Arrow keys move within composites (menus, tabs,
  listboxes) — that is the library's job, not a bespoke `onKeyDown`.
- **Never remove the focus ring.** `outline: none` / `tw:outline-none` without a replacement visible
  indicator is not allowed; focus must be visible against its background at 3:1.
- Do not use positive `tabIndex`. `tabIndex={-1}` only for programmatic focus targets.
- **No accidental focus traps.** Modals/drawers must trap deliberately (use `Modal`), everything else
  must let focus leave. Hidden/collapsed content must be removed from the tab order.

## Focus management

- **Route change**: move focus to the new page's `<h1>` or main landmark and reset scroll — do not
  leave focus on the destroyed element.
- **Overlay open**: focus the first meaningful control (not the close button unless nothing else).
  **Overlay close**: restore focus to the trigger.
- Removing the focused node (row delete, filter clear) requires moving focus to a sensible neighbour,
  not letting it fall to `<body>`.
- Announce async results (save/delete/error) via toast (`showErrorToast`/`showSuccessToast`) or an
  `aria-live="polite"` region; `role="alert"` for errors only.

## Names & labels

- Every control needs an accessible name. Visible text is the best name; `aria-label` only when there
  is no visible label. Icon-only buttons **always** need `aria-label` and the icon gets `aria-hidden`.
- Link/button text must make sense out of context — no bare "Click here" / "Learn more".
- All names/labels go through i18n (`i18n.md`), never hardcoded strings.
- Form fields: real `<label htmlFor>` or the library `Form`/`Input` label prop — placeholder is not a
  label. Associate help text and errors via `aria-describedby`, set `aria-invalid` on the failing
  field, and move focus to the first invalid field on submit.
- Give tables `<caption>` or `aria-label`, and `<th scope>` on header cells.

## Visual

- **Contrast minimums**: 4.5:1 body text, 3:1 for text ≥18.66px bold / ≥24px, 3:1 for icons, focus
  rings, and control boundaries. Use semantic tokens (`frontend-styling.md`) rather than inventing a
  lighter grey — check both light and dark mode.
- **Never convey meaning by color alone.** Status, validation, and chart series need an icon, text
  label, or shape too.
- **Touch targets ≥24x24px** with adequate spacing (aim 44x44 for primary mobile actions); pad the
  hit area rather than shrinking below the minimum.
- Respect `prefers-reduced-motion` — gate non-essential transitions/animations/parallax/autoplay
  behind `tw:motion-safe:*` or a media query, and never rely on animation to convey state.
- Layout must survive 200% zoom and 320px width without horizontal scroll or clipped controls.

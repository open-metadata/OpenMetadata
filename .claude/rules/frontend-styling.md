---
description: Frontend styling — Tailwind tw: prefix, design tokens, ring→border rule, token audit
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx,less,css}"
---

# Frontend styling & design tokens

Applies to UI `*.{ts,tsx,less,css}`. Component-library choice is in `component-library.md`.
Token source of truth: `openmetadata-ui/src/main/resources/ui/src/styles/tokens.css` and
`openmetadata-ui-core-components/src/main/resources/ui/src/styles/globals.css`.

## Tailwind & tokens

- **All Tailwind utility classes use the `tw:` prefix** (`tw:flex`, `tw:text-sm`, `tw:bg-blue-500`) to
  avoid collisions with existing Ant Design/Less styles.
- **Use design tokens, never hardcoded color/spacing.** Semantic CSS custom properties are defined in
  `globals.css` — text (`--color-text-primary`…), border (`--color-border-primary`…), background
  (`--color-bg-primary`…), shadows (`--shadow-xs`…`--shadow-3xl`), radius (`--radius-none`…`--radius-full`).
  Full token reference, dark-mode guide, and anti-patterns:
  [`docs/colors.md`](../../openmetadata-ui/src/main/resources/ui/docs/colors.md) — consult before
  choosing any color class.
- In `.less`/`.css` component styles reference `var(--om-*)` — never a raw hex, `rgb()/rgba()`, px
  spacing, raw font-size/weight, border-radius, box-shadow color, z-index, or transition duration.
  The token file is three-layer: Layer 1 `--ds-*` primitives → Layer 2 `--om-*` aliases → components
  use Layer 2. If a value has no token, add it to `tokens.css` (Layers 1+2), not to the component.
  Legacy LESS `@variable` (`variables.less`) is still allowed as a bridge; prefer `var(--om-*)` for new work.

## Borders — never use `tw:ring-*` to draw an edge

Rings compile to `box-shadow`, which WebKit does not pixel-snap, so they thin/vanish in Safari at
non-100% zoom. Use `tw:border-*` where the edge may take layout space, or
`tw:outline-1 tw:-outline-offset-1 tw:outline-<token>` where it must not. On focusable elements the
`outline` is already the focus ring — draw the border on `::after` via `borderAfter` from
`@openmetadata/ui-core-components`. Translation table + gotchas (`outline-hidden` erases outline
borders; `transition-shadow` won't animate them) in [`colors.md` §2.3.1](../../openmetadata-ui/src/main/resources/ui/docs/colors.md).

## Specs, legacy CSS, and the token audit

- **Before writing/modifying UI code, read the relevant spec** in
  `openmetadata-ui/src/main/resources/ui/specs/`: start with `specs/README.md`, then the matching
  `specs/foundations/*.md` (color, spacing, typography, radius, elevation, motion), the master
  `specs/tokens/token-reference.md`, and the `specs/components/*.md` for the component you touch.
- Custom styles in `.less` files use component-specific naming (legacy pattern — avoid for new code);
  follow BEM for custom CSS classes when writing raw CSS.
- **Run the token audit before committing — zero errors required:**
  ```bash
  cd openmetadata-ui/src/main/resources/ui
  yarn token-audit          # CI-ready; exits 1 on hardcoded colors/spacing
  ```
  Supporting: `yarn token-audit:report` (inventory + suggested token), `yarn token-migrate` (idempotent
  codemod), `yarn token-gen` (regenerate the generated block of `tokens.css` + reference),
  `yarn token-test`. Errors = hardcoded colors/spacing (fail CI); warnings = uncommon/off-grid values.

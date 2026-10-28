---
description: Frontend styling — Tailwind tw: prefix, design tokens and the LESS colour bridge, core component styling, ring→border rule, dark mode
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx,less,css}"
---

# Frontend styling & design tokens

Applies to UI `*.{ts,tsx,less,css}`; component choice is in `component-library.md`. Token source of truth: core
`globals.css` (`@theme`, dark values under `.dark-mode`); the app's `src/styles/tokens.css` holds the legacy `--om-*` tokens.

## Tailwind & tokens (ADR:2026-10-20-less-non-colour-values-read-tailwind-theme-vars)

- **All Tailwind utility classes use the `tw:` prefix** (`tw:flex`, `tw:text-sm`, `tw:bg-blue-500`) to
  avoid collisions with existing Ant Design/Less styles.
- **New styling is `tw:` utilities on core components, not LESS.** `yarn tw-guard` blocks new `.less`
  files. When you touch a LESS rule, prefer moving it onto the component.
- **Use design tokens, never hardcoded colour or spacing.** Full token reference, dark-mode guide and
  anti-patterns: [`docs/colors.md`](../../openmetadata-ui/src/main/resources/ui/docs/colors.md) —
  consult it before choosing any colour class.
- **Colours come from core `globals.css`.** In `.less`/`.css` and canvas token strings, read the
  Tailwind bridge vars the `tw:` utilities compile to (`tw:bg-surface` →
  `var(--tw-background-color-surface)`). They hold light values and flip under `.dark-mode`:
  - background: `var(--tw-background-color-<token>)` (`surface`, `primary`, `secondary`, `page`, `canvas`, `overlay-surface`);
  - text: `var(--tw-text-color-<token>)`; border, outline, divider: `var(--tw-border-color-<token>)`;
  - icons/foreground: `var(--tw-color-fg-<token>)`; status/palette: `var(--tw-color-utility-<colour>-<step>)`.
- **Never add `--om-color-*` tokens or references**; switch existing references when editing their line.
  Raw `--color-*` / `--background-color-*` / `--text-color-*` / `--border-color-*` are self-referential
  in `@theme static`, so they are invalid, and transparent, in light.
  Never raw hex, `rgb()`, `@white`/`@black`, legacy palette vars (`--om-grey-*`) that never flip, or
  `--tw-color-bg-*`/`--tw-color-text-*`, which `.dark-mode` does not remap.
- **Non-colour values read Tailwind theme vars**: `calc(var(--tw-spacing) * N)`, `--tw-radius-*`,
  `--tw-shadow-*`, `--tw-text-*`, `--tw-font-weight-*`, `--tw-default-transition-duration`; off-scale
  values round up a step, never new `--om-*` non-colour refs. `yarn token-audit` fails on colours and
  raw spacing; radius, font, z-index and duration warn. Colour roles go to `globals.css`. Existing `variables.less` `@variable`s stay for antd theming only.

## Core components keep their own styling (ADR:2026-10-11-migrated-antd-components-adopt-core-styling)

- **No caller-side overrides.** No `className`, `style` or LESS that sets padding, border, radius,
  shadow, background or text colour on a core component or its sub-components. Use its `variant`,
  `color` and `size` props and sub-components. `Card` padding comes from `size` and `Card.Content`,
  never `tw:p-*` on the root. `Typography` takes `size`/`weight`/`color` props, not text classes.
- **No specificity fights:** no `!important` (`tw:…!`) and no descendant selectors (`tw:[&_label]:…`,
  `.prose >`, reaching into core internals). A gap the core API cannot express is fixed in the core
  component, and a new core variant ships with a Storybook story in both themes.
- **The caller owns layout only**: width, margin, flex/grid placement (`Grid` `colGap`/`rowGap` over the
  legacy `layout-row` gutter shims). A shared component never sets its own outer margin.
- **Never style through `[data-testid=…]` selectors**: a test-id rename silently breaks the styling.
- **Icons** come from `@openmetadata/ui-core-components/icons`, passed as `iconLeading`/`iconTrailing`
  where the component takes them, sized with `tw:size-*` rather than inline styles.

## Borders — never use `tw:ring-*` to draw an edge

Rings compile to `box-shadow`, which WebKit does not pixel-snap, so they thin/vanish in Safari at
non-100% zoom. Use `tw:border-*` where the edge may take layout space, or
`tw:outline-1 tw:-outline-offset-1 tw:outline-<token>` where it must not. On focusable elements the
`outline` is already the focus ring — draw the border on `::after` via `borderAfter` from
`@openmetadata/ui-core-components`. Translation table + gotchas (`outline-hidden` erases outline
borders; `transition-shadow` won't animate them) in [`colors.md` §2.3.1](../../openmetadata-ui/src/main/resources/ui/docs/colors.md).

## Specs and the audits

- **Before writing/modifying UI code, read the relevant spec** in
  `openmetadata-ui/src/main/resources/ui/specs/`: start with `specs/README.md`, then
  `specs/foundations/tailwind.md`, `specs/tokens/tailwind-utility-reference.md` and the
  `specs/untitled/*.md` page for the component you touch.
- **Run the audits before committing — zero errors required** (from `openmetadata-ui/src/main/resources/ui`):
  `yarn tw-audit` (TSX: hardcoded values; `tw:dark:*` is a warning), `yarn token-audit` (LESS/CSS:
  colours and resolvable spacing fail CI) and `yarn tw-guard` (new antd imports, raw-SVG assets, `.less` files).
  **Legacy tool caveat:** `token-audit:report` / `token-migrate` still suggest/write `--om-color-*`;
  replace colour suggestions with semantic `--tw-*` bridge vars before accepting their edits.

## Dark mode — never hardcode, never use a token that doesn't flip

Light mode is frozen: reach dark with tokens that adapt, never by changing light values. Full guide:
[`docs/colors.md`](../../openmetadata-ui/src/main/resources/ui/docs/colors.md).

- **Scope:** dark mode is AI mode on core/Tailwind surfaces only. Classic mode gets no dark theme
  and antd-only surfaces (`.ant-*`) are not themed for dark — migrate them to core instead
  (ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only).
- **Surfaces:** page → `tw:bg-page`; card/panel → core `<Card>` or `tw:bg-surface`; popover, dropdown,
  select, modal, drawer → `tw:bg-overlay-surface`. `tw:bg-primary` is the page colour in dark
  (invisible card); `Box` is layout only — give it no background. Wrappers/grid frames stay transparent
  so gaps between cards show the page. State tokens (`bg-active`, `bg-*_hover`) are states, never surfaces.
- **Raw palette does not flip** (`tw:bg-blue-50`, `tw:text-gray-500`, `tw:bg-yellow-50`): use
  `tw:bg-utility-{color}-*` or a semantic token. Status chips → core `<Badge type="pill-color">` or
  `bg-utility-{color}-50` + `text-utility-{color}-700`, never solid steps (`bg-error-50`, `bg-error-500`).
- **Text:** brand/link → `tw:text-brand-secondary` / `tw:text-link`, never `text-brand-700`/`text-blue-600`.
  Readable secondary copy → `tw:text-tertiary`; `placeholder`/`disabled` only for those states.
- **Icons:** `tw:text-fg-*` (e.g. `fg-quaternary`), not text tokens. SVGs use `fill`/`stroke="currentColor"`
  — a baked-in hex never follows the theme.
- **LESS/CSS:** the bridge vars above (`var(--tw-background-color-surface)`, not `-primary`). LESS
  `darken()`/`fade()`/`lighten()` break on `var()`-backed variables. Theme antd through `variables.less`.
- **Contrast against the parent, not just the page:** a control using the same token as its container
  vanishes in dark (toggle off-track `bg-tertiary` on a `bg-surface` card). Icons need ≥3:1.
- **Audit every aspect in both themes:** background, text, border/outline, shadow, icon fill/stroke,
  gradient/fade stops (a clamp fade must end in its parent surface), chart `fill`/`stroke` props, and
  hover/focus/active/selected/disabled states.
- **`tw:dark:*` is a last resort** (`yarn tw-audit` warns on each): keep the light base and add the dark
  variant (`tw:bg-white tw:dark:bg-surface`), and record it with the dark-override review template in
  `colors.md`. Prefer core components — they are already themed. `tw:bg-bg-primary` is not a class (no background).

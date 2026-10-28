# LESS and CSS read Tailwind theme variables for colour and non-colour values

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer; `yarn token-audit` for raw colour and spacing literals
- **Related:** ADR:2026-10-16-less-colours-read-tailwind-bridge-vars, ADR:2026-10-11-migrated-antd-components-adopt-core-styling

## Context

ADR:2026-10-16-less-colours-read-tailwind-bridge-vars moved LESS colours onto the Tailwind bridge
variables but kept `--om-*` as the token layer for non-colour values. That left two token systems
for the same scale: TSX reads `tw:` utilities backed by the core `@theme` (`--spacing`,
`--radius-*`, `--shadow-*`, `--text-*`), while LESS reads `--om-*` aliases of the same values plus
off-scale entries (`--om-space-14`, `--om-radius-10`, `--om-font-size-11`) that have no utility
counterpart. Off-scale aliases let component styles drift from the design system's ramp.

## Decision

- Colour references in LESS/CSS and canvas token strings read the core Tailwind bridge families:
  `--tw-background-color-*`, `--tw-text-color-*`, `--tw-border-color-*`, `--tw-color-fg-*` and
  `--tw-color-utility-*`. Choose a semantic role that follows the theme. Never add `--om-color-*`
  tokens or references. A missing colour role belongs in core `globals.css` with its light and dark
  values; never reference the unprefixed semantic `--color-*`, `--background-color-*`,
  `--text-color-*` or `--border-color-*` variables from component styles. These carry over
  unchanged from ADR:2026-10-16-less-colours-read-tailwind-bridge-vars.
- Prefer `tw:` utilities and core component props (`Typography` `size`/`weight`) at the call site.
  Keep a LESS rule only when it needs a selector, `:has()`, a media query, a pseudo-element, SVG
  paint or a third-party override that utilities cannot express.
- Non-colour values in LESS read the Tailwind theme variables: spacing as
  `calc(var(--tw-spacing) * N)`, and `--tw-radius-*`, `--tw-shadow-*`, `--tw-text-*`,
  `--tw-font-weight-*`, `--tw-default-transition-duration` and `--tw-ease-*`.
- A value with no theme step rounds to the nearest step, rounding up (an 11px caption becomes
  `text-xs`, a 10px radius `radius-xl`, 100ms the default duration), rather than adding a new
  off-scale `--om-*` token.
- Do not add new `--om-*` non-colour tokens or references. Existing references migrate when their
  rule is edited.

## Consequences

Component styles and utilities share one scale, and off-scale values stop accumulating. Migrating a
file can shift a value by one ramp step; the PR doing it shows before/after captures. A value the
theme does not model and that has no ramp stays a literal: a 0.08em caps tracking, or a `z-index`
(the theme has no stacking scale; in TSX use `tw:z-<n>`). `token-audit:report` and `token-migrate` still suggest `--om-*` names; translate those
suggestions to the theme variables. `tokens.css` keeps the `--om-*` definitions until no component
reads them.

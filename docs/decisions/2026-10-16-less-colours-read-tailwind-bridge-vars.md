# LESS and CSS colours read the Tailwind bridge variables

- **Status:** Superseded by ADR:2026-10-20-less-non-colour-values-read-tailwind-theme-vars
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** reviewer for colour-role selection; `yarn token-audit` for raw colour literals
- **Related:** open-metadata/OpenMetadata#35610, open-metadata/OpenMetadata#34551, open-metadata/OpenMetadata#33626, open-metadata/OpenMetadata#35290, open-metadata/OpenMetadata#35049

## Context

The old LESS guidance directed every value through the app's `--om-*` aliases. Maintainer reviews
in #33626, #35290 and #35049 moved colours to core `globals.css`, and #34551 applies that convention
to lineage styles and canvas colours. The Tailwind bridge variables expose the same colour roles
that `tw:` utilities consume. Raw semantic variables such as `--color-text-primary` are
self-referential in `@theme static`, so using them directly can render transparent in light mode.
Keeping a second colour-alias layer makes the conventions and theme behaviour drift.

## Decision

- New or edited colour references in existing LESS/CSS and canvas token strings read the core
  Tailwind bridge families: `--tw-background-color-*`, `--tw-text-color-*`, `--tw-border-color-*`,
  `--tw-color-fg-*` and `--tw-color-utility-*`. Choose a semantic role that follows the theme.
- Never add `--om-color-*` tokens or references. Existing references migrate when their line is
  edited. `--om-*` remains the app's token layer for non-colour values such as spacing, radius,
  typography, shadows, z-index and duration.
- A missing colour role belongs in core `globals.css`, with its light and dark values. Do not
  reference the unprefixed semantic `--color-*`, `--background-color-*`, `--text-color-*` or
  `--border-color-*` variables directly from component styles.
- TSX uses the corresponding `tw:` utilities and core component props, following
  ADR:2026-10-11-migrated-antd-components-adopt-core-styling.

## Consequences

Colour ownership and theme roles have one source of truth. Existing LESS does not need a bulk
migration, and non-colour tokens keep their current home.

`token-audit:report` and `token-migrate` still suggest or write legacy `--om-color-*` aliases.
Before accepting those edits, replace colour suggestions with the matching semantic bridge
variables. A literal colour alone cannot identify whether the caller needs a text, surface,
border or foreground role, so a value-only codemod does not decide that role for the author.
Revisit this manual step when the tools can preserve semantic intent.

# Every --om-* token is declared in tokens.css, light and dark side by side

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `openmetadata-ui/src/main/resources/ui/scripts/design-tokens/theme-contract.test.js` (run by `yarn token-drift` and the `token-drift` pre-commit hook)
- **Related:** open-metadata/OpenMetadata#34936, open-metadata/OpenMetadata#35271, ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only

## Context
Each legacy LESS palette var (`@grey-15`, `@blue-29`, the status tints, …) was defined in three
files: the LESS var and its fallback hex in `variables.less`, the light `--om-*` value on `:root`
in `tokens.css`, and the dark `--om-*` value under `.dark-mode` in `app.less`. #34936 added the
light values to `tokens.css`. That file is imported after `app.less`, and `:root` has the same
specificity as `.dark-mode` on `<html>`, so the light values won and every bridged var
(the app-wide `@grey-15` border, `@grey-1/2/5/6/9/26`, `@blue-29/30`, the status tints) stayed
light in dark mode. #35271 patched the selector to `:root.dark-mode`, but the split itself, where
correctness depends on import order across files, remained. The same split had already let
`variables.less` carry two `@grey-25` definitions with different fallbacks.

## Decision
- Core tokens (`--color-*`, `--tw-*`, and the other Tailwind theme namespaces) are declared only in
  core `globals.css`, light in `@theme` and dark in `.dark-mode`.
- Project `--om-*` tokens are declared only in `openmetadata-ui/.../src/styles/tokens.css`. A
  token's light value goes on `:root` and its dark value on `:root.dark-mode` in the same file.
  `:root.dark-mode` out-ranks `:root` regardless of order.
- No other stylesheet (`app.less`, component `.less`/`.css`) declares an `--om-*` property. The one
  exception is `--om-page-height`, a layout value each shell re-declares so its `calc()` resolves
  against that shell's navbar height. It is not a themed token.
- Every dark `--om-*` override has a light value in `tokens.css`.
- A `variables.less` bridge (`@x: var(--om-x, <fallback>)`) is defined once, and its fallback
  equals the `tokens.css` light value.
- `theme-contract.test.js` enforces all of the above.

## Consequences
Adding or changing a themed legacy colour is a one-file edit, and the guard fails the
`token-drift` hook if a second file starts declaring `--om-*`. Overrides that must beat inline
custom properties on `<html>` (the `.dark-mode body` brand-accent block in `app.less`) target the
core `--tw-*` layer, not `--om-*`, so they are outside this rule. They stay where they are until
the brand injection stops writing inline vars. Revisit if `tokens.css` is split into per-theme
files, in which case the guard must check the import order instead.

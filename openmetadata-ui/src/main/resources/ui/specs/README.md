# OpenMetadata Design System Specs

Machine- and human-readable specifications for the OpenMetadata design system.
**Read the relevant spec before writing or modifying any UI code.**

## Two stacks: go-forward vs legacy

| | Stack | Style with | Tokens | Audit |
| --- | --- | --- | --- | --- |
| **Go-forward** ✅ | UntitledUI + Tailwind | `tw:` utility classes | `globals.css` `@theme` → [tokens/tailwind-utility-reference.md](tokens/tailwind-utility-reference.md) | `yarn tw-audit` |
| **Legacy** ⚠️ (deprecated) | Ant Design + Less | Existing `.less`: `--tw-*` colours, `--om-*` non-colour tokens | [foundations/color.md](foundations/color.md), [tokens/token-reference.md](tokens/token-reference.md) | `yarn token-audit` |

**New work uses UntitledUI + Tailwind. Do not add new Antd components, new
`.less` files, or new `assets/svg/` raw-SVG files/imports** — `yarn tw-guard` blocks new debt. Never hardcode a value in
either stack: use a `tw:` token utility in TSX. In existing `.less`/`.css` and canvas token strings,
read colours from the Tailwind
bridge vars the utilities compile to (`var(--tw-background-color-surface)`, `--tw-text-color-*`,
`--tw-border-color-*`, `--tw-color-fg-*`, `--tw-color-utility-*`, which flip under `.dark-mode`)
and every other value from `var(--om-*)`. Raw `--color-*` / `--background-color-*` /
`--text-color-*` / `--border-color-*` variables are invalid in light (transparent). The `--om-*`
layer below documents the **deprecated** Antd/Less side (still maintained during the migration);
never add `--om-color-*` tokens or references.

## How the (legacy) LESS system is layered

```
Layer 1  globals.css  Upstream primitives (--color-*, --radius-*, --text-*,
                      --shadow-*, semantic --color-{text,bg,...}) from
                      @openmetadata/ui-core-components. The source of truth.
Layer 2  --om-*       Project aliases in tokens.css. Reference the matching
                      Layer 1 token with a raw fallback (off-scale / legacy
                      values hold the raw value directly). Existing LESS uses these.
Components (.less/.css)  Colours: --tw-background-color-*, --tw-text-color-*,
                      --tw-border-color-*, --tw-color-fg-*, --tw-color-utility-*.
                      Other values: var(--om-*). Never raw hex / px.
```

The legacy LESS bridge — [`src/styles/variables.less`](../src/styles/variables.less)
— is also a token-definition file. Existing `@variable` usage stays for Antd theming;
new component styles use the colour bridge vars and the Tailwind theme vars for non-colour values
(ADR:2026-10-20-less-non-colour-values-read-tailwind-theme-vars). `--om-*` examples in the
foundation and component specs below are legacy; translate them to the theme vars.

## Contents

| Area | Spec |
| --- | --- |
| **Tailwind (go-forward)** ✅ | [foundations/tailwind.md](foundations/tailwind.md) |
| **Tailwind utilities** | [tokens/tailwind-utility-reference.md](tokens/tailwind-utility-reference.md) |
| **UntitledUI components** ✅ | [untitled/](untitled/README.md) |
| _Legacy LESS below_ | |
| Legacy app components | [components/](components/) |
| Colors | [foundations/color.md](foundations/color.md) |
| Spacing | [foundations/spacing.md](foundations/spacing.md) |
| Typography | [foundations/typography.md](foundations/typography.md) |
| Radius | [foundations/radius.md](foundations/radius.md) |
| Elevation | [foundations/elevation.md](foundations/elevation.md) |
| Motion | [foundations/motion.md](foundations/motion.md) |
| **Every token** | [tokens/token-reference.md](tokens/token-reference.md) |
| Components | [components/](components/) |

## Tooling

| Command | What it does |
| --- | --- |
| `yarn tw-audit` | **(go-forward)** Lint `.tsx`/`.ts` for hardcoded values. Explicit `tw:dark:*` and `--ai-*` usage are review warnings; resolvable arbitrary values remain errors. |
| `yarn tw-audit:report` | Full inventory + which token each raw hex matches + Antd/Less debt count. |
| `yarn tw-guard` | Fails on NEW `antd` imports / NEW `assets/svg/` raw-SVG files or imports / NEW `.less` files (deprecation). |
| `yarn token-audit` | _(legacy)_ Lint CSS/LESS for hardcoded values. **Exit 1 on any error.** CI-ready. |
| `yarn token-audit:report` | Full grouped inventory + legacy token suggestions; convert colour suggestions to semantic `--tw-*` bridge vars. |
| `yarn token-migrate` | Legacy codemod to `var(--om-*)`; replace colour aliases with semantic `--tw-*` bridge vars before accepting the edits. |
| `yarn token-gen` | Regenerate the generated block of `tokens.css` + token-reference. |
| `yarn token-test` | Unit tests for the scanner/codemod engine. |

The legacy tools choose tokens by literal value, so their colour output can still use the
prohibited `--om-color-*` aliases. Choose the semantic bridge role for the property being styled;
matching a hex value alone does not identify the role. Non-colour suggestions name `--om-*`;
translate them to the matching theme var. The token decision is
ADR:2026-10-20-less-non-colour-values-read-tailwind-theme-vars.

Errors (fail CI): **hardcoded colors, resolvable hardcoded spacing**.
Warnings: raw radius, font size/weight, z-index and duration, plus unresolved spacing.

Dark-theme warnings do not fail CI while AI-mode migration is in progress. Resolve them with a
shared semantic token or document them using the fixed-color and dark-override review template in
[`docs/colors.md`](../docs/colors.md).

## Rules for contributors and AI agents

1. Read the relevant `specs/` file before touching UI code.
2. Colours come from core `globals.css` only: use `tw:` utilities in TSX and their generated
   `--tw-*` bridge vars in `.less`/`.css` and canvas token strings (`--tw-text-color-primary`,
   `--tw-background-color-surface`, `--tw-border-color-secondary`, `--tw-color-fg-brand-primary`).
   Never add `--om-color-*` tokens or references, or use raw `--color-*` / `--background-color-*`
   variables (invalid in light mode). Non-colour values use the Tailwind theme vars
   (`calc(var(--tw-spacing) * 4)`, `--tw-radius-*`, `--tw-shadow-*`, `--tw-text-*`). Never introduce a raw hex, rgb/rgba, or px spacing value in a
   component style.
3. Prefer semantic tokens (`--tw-text-color-primary`, `--tw-radius-lg`) over
   palette/legacy tokens where one fits.
4. Run `yarn token-audit` before committing. **Zero errors required.**
5. If a needed non-colour value has no theme step, round up to the nearest one; do not add an
   `--om-*` alias. A missing colour role belongs in core `globals.css`.

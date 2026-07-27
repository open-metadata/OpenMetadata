# OpenMetadata Design System Specs

Machine- and human-readable specifications for the OpenMetadata design system.
**Read the relevant spec before writing or modifying any UI code.**

## Two stacks: go-forward vs legacy

| | Stack | Style with | Tokens | Audit |
| --- | --- | --- | --- | --- |
| **Go-forward** ✅ | UntitledUI + Tailwind | `tw:` utility classes | `globals.css` `@theme` → [tokens/tailwind-utility-reference.md](tokens/tailwind-utility-reference.md) | `yarn tw-audit` |
| **Legacy** ⚠️ (deprecated) | Ant Design + Less | `.less` + `var(--om-*)` | [tokens/token-reference.md](tokens/token-reference.md) | `yarn token-audit` |

**New work uses UntitledUI + Tailwind. Do not add new Antd components or new
`.less` files** — `yarn tw-guard` blocks new debt. Never hardcode a value in
either stack: use a `tw:` token utility (or `var(--color-*)`) in TSX, and
`var(--om-*)` in existing `.less`. The `--om-*` layer below documents the
**deprecated** Antd/Less side (still maintained during the migration).

## How the (legacy) LESS system is layered

```
Layer 1  globals.css  Upstream primitives (--color-*, --radius-*, --text-*,
                      --shadow-*, semantic --color-{text,bg,...}) from
                      @openmetadata/ui-core-components. The source of truth.
Layer 2  --om-*       Project aliases in tokens.css. Reference the matching
                      Layer 1 token with a raw fallback (off-scale / legacy
                      values hold the raw value directly). Components use these.
Components (.less/.css)  Reference Layer 2 via var(--om-*). Never raw hex / px.
```

The legacy LESS bridge — [`src/styles/variables.less`](../src/styles/variables.less)
— is also a token-definition file. Existing `@variable` usage is not
a violation; new work should prefer `var(--om-*)`.

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
| `yarn tw-audit` | **(go-forward)** Lint `.tsx`/`.ts` for hardcoded Tailwind values. Exit 1 on error. |
| `yarn tw-audit:report` | Full inventory + which token each raw hex matches + Antd/Less debt count. |
| `yarn tw-guard` | Fails on NEW `antd` imports / NEW `.less` files (deprecation). |
| `yarn token-audit` | _(legacy)_ Lint CSS/LESS for hardcoded values. **Exit 1 on any error.** CI-ready. |
| `yarn token-audit:report` | Full grouped inventory of every value + its suggested token. |
| `yarn token-migrate` | Codemod raw values → `var(--om-*)` tokens (safe, idempotent). |
| `yarn token-gen` | Regenerate the generated block of `tokens.css` + token-reference. |
| `yarn token-test` | Unit tests for the scanner/codemod engine. |

Errors (fail CI): **hardcoded colors, hardcoded spacing**.
Warnings: uncommon values (fractional off-grid sizes, exotic durations).

## Rules for contributors and AI agents

1. Read the relevant `specs/` file before touching UI code.
2. Use only tokens from `tokens.css` (`var(--om-*)`); never introduce a raw hex,
   rgb/rgba, or px spacing value in a component style.
3. Prefer semantic tokens (`--om-color-text-primary`, `--om-space-16`) over
   palette/legacy tokens where one fits.
4. Run `yarn token-audit` before committing. **Zero errors required.**
5. If a needed value has no token, add it to `tokens.css` as an `--om-*` alias
   (referencing the upstream `globals.css` token, or holding the raw value when
   there is no upstream equivalent), not to the component.

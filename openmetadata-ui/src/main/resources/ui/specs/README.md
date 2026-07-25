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
Layer 1  --ds-*   Upstream primitives. Reference the design system
                  (openmetadata-ui-core-components/.../globals.css) with a raw
                  fallback. The ONLY place raw values live.
Layer 2  --om-*   Project aliases. Reference Layer 1 with a fallback. Components
                  reference ONLY these.
Layer 3           Components (.less / .css). Reference Layer 2 via var(--om-*).
                  Never raw hex / px / etc.
```

The legacy LESS bridge — [`src/styles/variables.less`](../src/styles/variables.less)
— is also a token-definition file (Layer 1/2). Existing `@variable` usage is not
a violation; new work should prefer `var(--om-*)`.

## Contents

| Area | Spec |
| --- | --- |
| **Tailwind (go-forward)** ✅ | [foundations/tailwind.md](foundations/tailwind.md) |
| **Tailwind utilities** | [tokens/tailwind-utility-reference.md](tokens/tailwind-utility-reference.md) |
| UntitledUI components | [components/](components/) |
| _Legacy LESS below_ | |
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
| `yarn tw-migrate` | Codemod exact-match arbitrary `tw:` values → utilities. |
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
5. If a needed value has no token, add it to `tokens.css` (Layer 1 + Layer 2),
   not to the component.

# Tailwind (go-forward styling)

The go-forward styling system is **UntitledUI components
(`@openmetadata/ui-core-components`) + Tailwind** with the `tw:` prefix, styled
from the design tokens in
[`globals.css`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/styles/globals.css)
(`@theme`). Ant Design + Less are deprecated — see [../README.md](../README.md).

**Never hardcode a visual value in `.tsx`/`.ts`.** `yarn tw-audit` flags it;
`yarn tw-audit:report` tells you which token a raw hex matches.

## Color

Prefer **semantic** utilities — they adapt to dark mode (`.dark-mode`); palette
utilities are fixed swatches.

| Need | Utility |
| --- | --- |
| Body / heading text | `tw:text-primary` |
| Secondary / tertiary text | `tw:text-secondary`, `tw:text-tertiary` |
| Disabled / placeholder | `tw:text-disabled`, `tw:text-placeholder` |
| Status text | `tw:text-error-primary` / `-warning-primary` / `-success-primary` |
| Page / card background | `tw:bg-primary` |
| Subtle surface | `tw:bg-secondary`, `tw:bg-tertiary` |
| Status / brand surface | `tw:bg-error-primary`, `tw:bg-brand-solid` |
| Border / divider | `tw:border-primary`, `tw:border-secondary` |
| A specific swatch | `tw:bg-brand-500`, `tw:text-gray-700`, … (palette) |

Full list: [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md).
Dark-mode + `tw:` color guidance: [../../docs/colors.md](../../docs/colors.md).

```tsx
/* DO */   <Box className="tw:bg-secondary tw:text-primary tw:border tw:border-secondary" />
/* DON'T */<Box className="tw:bg-[#fafafa] tw:text-[#181d27]" style={{ color: '#181d27' }} />
```

## Spacing, radius, type

- **Spacing** (`tw:p-*`, `tw:m-*`, `tw:gap-*`): 4px scale — `tw:p-2` = 8px,
  `tw:gap-4` = 16px. No `tw:p-[8px]`.
- **Radius**: `tw:rounded-sm` (4px) … `tw:rounded-lg` (8px) … `tw:rounded-full`.
  No `tw:rounded-[8px]`.
- **Font size**: `tw:text-xs` (12) / `tw:text-sm` (14) / `tw:text-md` (16) / … .
- **Sizing** (`tw:w-*`, `tw:h-*`, `tw:max-w-*`) are layout dimensions, not
  spacing tokens — arbitrary values there are allowed and not flagged.

## Borders — never `tw:ring-*`

Rings compile to `box-shadow`, which WebKit doesn't pixel-snap (thins/vanishes in
Safari when zoomed). Use `tw:border-*`, or `tw:outline-1 tw:-outline-offset-1
tw:outline-<token>`; on focusable controls use `borderAfter`. Enforced by an
eslint rule. Full rationale: [../../docs/colors.md §2.3.1](../../docs/colors.md).

## Rules (enforced)

| Rule | Tool |
| --- | --- |
| No arbitrary color/spacing/radius (`tw:bg-[#hex]`, `tw:p-[8px]`) | `yarn tw-audit` (error) |
| No raw hex / `rgb()` in JSX / chart / SVG / `style={{}}` | `yarn tw-audit` (warning + token hint) |
| No new `antd` import / new `.less` file | `yarn tw-guard` (error) |
| No `tw:ring-*` | eslint `no-restricted-syntax` (error) |

## Cross-references

- [Utility reference](../tokens/tailwind-utility-reference.md) · [../README.md](../README.md)
- Component APIs (UntitledUI): [../components/](../components/)
- Legacy LESS tokens: [color.md](color.md), [spacing.md](spacing.md)

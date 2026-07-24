# Spacing

A 4px-based scale. Used for `padding`, `margin`, and `gap` (and their
directional/shorthand variants). Raw px/rem in these properties are flagged as
**errors** by `yarn token-audit`.

> Scope: only `padding*`, `margin*`, `gap` / `row-gap` / `column-gap` are
> tokenized. `width`, `height`, `top`/`left`/`right`/`bottom`, `inset`, and
> `flex-basis` keep raw lengths and are **not** flagged — they are layout
> dimensions, not spacing.

## Core scale (prefer these)

| Token | Value | Typical use |
| --- | --- | --- |
| `--om-space-0` | 0 | reset |
| `--om-space-2` | 2px | hairline gaps |
| `--om-space-4` | 4px | icon/text gap (xxs) |
| `--om-space-6` | 6px | tight padding |
| `--om-space-8` | 8px | control padding (xs) |
| `--om-space-10` | 10px | |
| `--om-space-12` | 12px | form control padding (sm) |
| `--om-space-16` | 16px | card / container padding (md) |
| `--om-space-20` | 20px | section padding (mlg) |
| `--om-space-24` | 24px | container padding (lg) |
| `--om-space-32` | 32px | large gaps |
| `--om-space-36` | 36px | (xl) |
| `--om-space-40` / `-44` / `-48` | 40 / 44 / 48px | |
| `--om-space-56` / `-64` | 56 / 64px | page-level rhythm (3xl = 64) |
| `--om-space-80` / `-96` | 80 / 96px | hero spacing |

These map to the historic LESS `@size-*` / `@padding-*` / `@margin-*` scale
(xxs=4, xs=8, sm=12, md=16, mlg=20, lg=24, xl=36, 2xl=48, 3xl=64).

## Extended / off-grid

Off-scale values in active use (`--om-space-5`, `-14`, `-18`, `-22`, `-26`, …)
and fractional values (`--om-space-3_5` = 3.5px, using `_` as the decimal
separator) exist in the generated block of `tokens.css`. **Do not add new
off-grid spacing** — round to the core scale.

## Negative spacing

Negative margins are expressed with `calc`:

```less
margin-top: calc(-1 * var(--om-space-8)); /* was: -8px */
```

## Layers

- **Layer 1** `--ds-space-<n>: <n>px` (raw values).
- **Layer 2** `--om-space-<n>: var(--ds-space-<n>, <n>px)`.
- **Layer 3** `padding: var(--om-space-16);`

## Do / Don't

```less
/* DO */
padding: var(--om-space-16) var(--om-space-24);
gap: var(--om-space-8);
margin-bottom: var(--om-space-4);

/* DON'T */
padding: 16px 24px;
gap: 0.5rem;
margin-bottom: 4px;
```

## Cross-references

- [Radius](radius.md) · [Typography](typography.md)
- [Token reference](../tokens/token-reference.md)

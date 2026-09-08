# Typography

Font families, sizes, weights, and line heights. `font-size` and `font-weight`
raw values are flagged as warnings by `yarn token-audit` and should be
tokenized.

## Families

| Token | Value |
| --- | --- |
| `--om-font-sans` | `'Inter', 'Poppins', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif` |
| `--om-font-mono` | `ui-monospace, 'Roboto Mono', SFMono-Regular, Menlo, Monaco, …` |

Inter is the product typeface (loaded as a variable font via
`styles/inter-variable.css`).

## Sizes (mirrors upstream `--text-*`)

| Token | Value | Use |
| --- | --- | --- |
| `--om-font-size-xs` | 12px | captions, metadata, badges |
| `--om-font-size-sm` | 14px | **body default** |
| `--om-font-size-md` | 16px | emphasized body |
| `--om-font-size-lg` | 18px | small headings |
| `--om-font-size-xl` | 20px | headings |
| `--om-font-size-display-xs` | 24px | page titles |
| `--om-font-size-display-sm` | 30px | |
| `--om-font-size-display-md` | 36px | |
| `--om-font-size-display-lg` | 48px | hero |
| `--om-font-size-display-xl` | 60px | |
| `--om-font-size-display-2xl` | 72px | |

Off-scale sizes in use (`--om-font-size-10`, `-11`, `-13`, `-15`, and fractional
like `--om-font-size-12_5`) live in the generated block. Prefer the named scale
for new work.

## Weights

| Token | Value |
| --- | --- |
| `--om-font-weight-thin` | 100 |
| `--om-font-weight-light` | 300 |
| `--om-font-weight-regular` | 400 |
| `--om-font-weight-medium` | 500 |
| `--om-font-weight-semibold` | 600 |
| `--om-font-weight-bold` | 700 |
| `--om-font-weight-extrabold` | 800 |
| `--om-font-weight-black` | 900 |

These parallel the LESS `@font-regular/@font-medium/@font-semibold/@font-bold`
variables, which remain valid in existing code.

## Line heights

| Token | Value |
| --- | --- |
| `--om-line-height-none` | 1 |
| `--om-line-height-tight` | 1.25 |
| `--om-line-height-snug` | 1.375 |
| `--om-line-height-normal` | 1.5 |
| `--om-line-height-relaxed` | 1.625 |

## Do / Don't

```less
/* DO */
font-size: var(--om-font-size-sm);
font-weight: var(--om-font-weight-semibold);
line-height: var(--om-line-height-normal);
font-family: var(--om-font-sans);

/* DON'T */
font-size: 14px;
font-weight: 600;
```

## Cross-references

- [Spacing](spacing.md) · [Token reference](../tokens/token-reference.md)

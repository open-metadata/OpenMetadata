# Color

Colors are tokenized in three layers. Components reference **Layer 2 semantic
tokens** (`--om-color-*`); raw hex/rgb/rgba are not allowed in component styles
and are flagged as **errors** by `yarn token-audit`.

## When to use which token

Prefer the most semantic token that fits. Reach for a palette token only when no
semantic token expresses the intent; reach for a legacy token never (they exist
only to hold migrated one-off values until they can be re-expressed).

| Need | Use |
| --- | --- |
| Body / heading text | `--om-color-text-primary` |
| Secondary / supporting text | `--om-color-text-secondary`, `--om-color-text-tertiary` |
| Muted / disabled / placeholder text | `--om-color-text-quaternary`, `--om-color-text-disabled`, `--om-color-text-placeholder` |
| Text on a dark/brand fill | `--om-color-text-inverse` |
| Status text | `--om-color-text-error` / `-warning` / `-success` |
| Page / card background | `--om-color-bg-primary` |
| Subtle / raised surface | `--om-color-bg-secondary`, `--om-color-bg-tertiary` |
| Status surface | `--om-color-bg-error` / `-warning` / `-success` |
| Brand surface / solid | `--om-color-bg-brand`, `--om-color-bg-brand-solid` |
| Modal / drawer scrim | `--om-color-bg-overlay` |
| Default border / divider | `--om-color-border` (= primary), `--om-color-border-secondary` |
| Error / brand border | `--om-color-border-error`, `--om-color-border-brand` |
| Link | `--om-color-link`, `--om-color-link-hover` |
| Hover / active / selected row | `--om-color-interactive-hover` / `-active` / `-selected` |
| Focus ring | `--om-color-focus-ring` |
| A specific brand/gray/red/… swatch | `--om-color-{scale}-{25…950}` (palette) |

## Layers

- **Layer 1** `--ds-color-*` — maps to the upstream semantic tokens
  (`--color-text-primary`, `--color-bg-primary`, …) from `globals.css`, with a
  raw fallback. Also the full palette `--ds-color-{scale}-{step}`.
- **Layer 2** `--om-color-*` — semantic aliases + full palette passthrough +
  `--om-legacy-color-*` (exact migrated values). **Components use these.**
- **Layer 3** — components: `color: var(--om-color-text-primary);`

## Palette scales

Full 12-step scales (`25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`)
are exposed as `--om-color-<scale>-<step>` for every scale in the upstream
system: `brand`, `error`, `warning`, `success`, `gray`, `gray-blue`,
`gray-cool`, `gray-modern`, `gray-neutral`, `gray-iron`, `gray-true`,
`gray-warm`, `blue`, `blue-dark`, `blue-light`, `indigo`, `violet`, `purple`,
`fuchsia`, `pink`, `rose`, `orange`, `orange-dark`, `yellow`, `teal`, `cyan`,
`green`, `green-light`, `moss`. Plus `--om-color-white`, `--om-color-black`,
`--om-color-transparent`.

## Dark mode

Semantic tokens flip automatically: the upstream `--color-*` custom properties
are redefined under `.dark-mode` in `globals.css`, and `--om-color-*` inherit
that through Layer 1. **This is the reason to use semantic tokens** — a palette
token like `--om-color-gray-900` is a fixed color and will not adapt. See
[`../../docs/colors.md`](../../docs/colors.md) for the full dark-mode guide.

## Do / Don't

```less
/* DO */
color: var(--om-color-text-primary);
background: var(--om-color-bg-secondary);
border: 1px solid var(--om-color-border);

/* DON'T — flagged as errors by token-audit */
color: #292a2e;
background: rgba(0, 0, 0, 0.03);
border: 1px solid #eaecf5;
```

## Cross-references

- [Elevation](elevation.md) — shadows use rgba tokens internally.
- [Token reference](../tokens/token-reference.md) — every color token + value.
- [`docs/colors.md`](../../docs/colors.md) — Tailwind `tw:` color usage and dark mode.

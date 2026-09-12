# Color

Colors are tokenized in two layers. Components reference **Layer 2 semantic
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
| Page background | `--om-color-bg-page` |
| Main workspace | `--om-color-bg-canvas` |
| Card / panel / sidebar | `--om-color-bg-surface` |
| Dropdown / menu / popover | `--om-color-bg-raised` |
| Modal / drawer content | `--om-color-bg-overlay-surface` |
| Status surface | `--om-color-bg-error` / `-warning` / `-success` |
| Brand surface / solid | `--om-color-bg-brand`, `--om-color-bg-brand-solid` |
| Modal / drawer scrim | `--om-color-bg-overlay` |
| Interactive control border | `--om-color-border-primary`, `--om-color-border-hover` |
| Card / panel / divider border | `--om-color-border-subtle` |
| Error / brand border | `--om-color-border-error`, `--om-color-border-brand` |
| Link | `--om-color-link`, `--om-color-link-hover` |
| Hover / active / selected row | `--om-color-interactive-hover` / `-active` / `-selected` |
| Focus ring | `--om-color-focus-ring` |
| A specific brand/gray/red/… swatch | `--om-color-{scale}-{25…950}` (palette) |

## Layers

- **Layer 1** `globals.css` — the upstream semantic tokens
  (`--color-text-primary`, `--color-bg-primary`, …) and full palette
  (`--color-{scale}-{step}`) from `@openmetadata/ui-core-components`. Source of truth.
- **Layer 2** `--om-color-*` — project aliases that reference the matching
  Layer 1 token with a raw fallback: semantic aliases + full palette passthrough +
  `--om-legacy-color-*` (exact migrated values). **Components use these.**
- **Components** — `color: var(--om-color-text-primary);`

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
that by referencing `--color-*` directly. Light-mode primitive values remain
unchanged; the approved neutral scale is scoped to `.dark-mode`. **This is the
reason to use semantic tokens** — a palette token like `--om-color-gray-900`
does not communicate whether the caller needs the page, canvas, or surface
role. See
[`../../docs/colors.md`](../../docs/colors.md) for the full dark-mode guide.

### Dark surface hierarchy

| Role | Dark value |
| --- | --- |
| `--om-color-bg-page` | Gray 950 — `#141414` |
| `--om-color-bg-canvas` | Gray 900 — `#191919` |
| `--om-color-bg-surface` | Gray 800 — `#222222` |
| `--om-color-bg-raised` | Gray 700 — `#2e2e2e` |
| `--om-color-bg-overlay-surface` | Gray 800 — `#222222` |

Cards and dividers use the 8% alpha `--om-color-border-subtle`; interactive
controls use `--om-color-border-primary` and `--om-color-border-hover`.
Status surfaces use the shared 16% fill and 35% subtle-border recipes rather
than component-specific banner or chip colors.

## Do / Don't

```less
/* DO */
color: var(--om-color-text-primary);
background: var(--om-color-bg-surface);
border: 1px solid var(--om-color-border-subtle);

/* DON'T — flagged as errors by token-audit */
color: #292a2e;
background: rgba(0, 0, 0, 0.03);
border: 1px solid #eaecf5;
```

## Cross-references

- [Elevation](elevation.md) — shadows use rgba tokens internally.
- [Token reference](../tokens/token-reference.md) — every color token + value.
- [`docs/colors.md`](../../docs/colors.md) — Tailwind `tw:` color usage and dark mode.

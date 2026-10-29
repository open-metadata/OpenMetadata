# Color

Core `globals.css` is the colour source of truth. Use `tw:` utilities in TSX and
their generated `--tw-*` bridge vars in existing `.less`/`.css` and canvas token
strings. Raw hex/rgb/rgba are not allowed in component styles and are flagged as
**errors** by `yarn token-audit`.

> **New or edited colour references in `.less` use the Tailwind bridge vars** —
> `var(--tw-background-color-<token>)`, `var(--tw-text-color-<token>)`,
> `var(--tw-border-color-<token>)`, `var(--tw-color-fg-<token>)`,
> `var(--tw-color-utility-<colour>-<step>)`. Never add `--om-color-*` tokens or
> references. A missing colour role belongs in `globals.css`; non-colour aliases
> remain in `tokens.css` (see [the specs overview](../README.md)).

## Legacy aliases

The table below inventories existing `--om-color-*` aliases for migration; it is
not a list of tokens to use in new styles. Replace an alias when editing its line
with the corresponding Tailwind bridge role from
[`docs/colors.md`](../../docs/colors.md) or the
[Tailwind utility reference](../tokens/tailwind-utility-reference.md).

For a replacement, prefer the most semantic bridge role that fits. Use a utility
colour only when no semantic role expresses the intent; legacy tokens only hold
migrated one-off values until they can be re-expressed.

| Role | Existing alias |
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
| Link | `--tw-text-color-link`, `--tw-text-color-link-hover` (core; `tw:text-link`) |
| Hover / active / selected row | `--om-color-interactive-hover` / `-active` / `-selected` |
| Focus ring | `--om-color-focus-ring` |
| A specific brand/gray/red/… swatch | `--om-color-{scale}-{25…950}` (palette) |

## Layers during migration

- **Layer 1** `globals.css` — the upstream semantic tokens
  (`--color-text-primary`, `--color-bg-primary`, …) and full palette
  (`--color-{scale}-{step}`) from `@openmetadata/ui-core-components`. Source of truth.
- **Layer 2** `--om-color-*` — project aliases that reference the matching
  Layer 1 token with a raw fallback: semantic aliases + full palette passthrough +
  `--om-legacy-color-*` (exact migrated values). **Existing LESS uses these.**
- **Components** — `color: var(--tw-text-color-primary);`. Use the generated
  bridge vars directly; `--om-color-*` aliases remain only for existing references.

## Legacy palette scales

Full 12-step scales (`25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`)
are exposed as `--om-color-<scale>-<step>` for every scale in the upstream
system: `brand`, `error`, `warning`, `success`, `gray`, `gray-blue`,
`gray-cool`, `gray-modern`, `gray-neutral`, `gray-iron`, `gray-true`,
`gray-warm`, `blue`, `blue-dark`, `blue-light`, `indigo`, `violet`, `purple`,
`fuchsia`, `pink`, `rose`, `orange`, `orange-dark`, `yellow`, `teal`, `cyan`,
`green`, `green-light`, `moss`. Plus `--om-color-white`, `--om-color-black`,
`--om-color-transparent`.

## Dark mode

Use the Tailwind bridge roles, which hold light values and are remapped under
`.dark-mode` in `globals.css`. Raw `--color-*` / `--background-color-*` /
`--text-color-*` / `--border-color-*` are self-referential in `@theme static` and
invalid in light mode, so a direct reference can render transparent. Raw palette
tokens do not flip; choose a semantic role or `--tw-color-utility-<colour>-<step>`.
Light-mode primitive values remain unchanged; the approved blue-tinted dark
scale is scoped to `.dark-mode`. See
[`../../docs/colors.md`](../../docs/colors.md) for the full dark-mode guide.

### Dark surface hierarchy

| Role | Dark value |
| --- | --- |
| `--tw-background-color-page` | Gray 950 — `#0c0e12` |
| `--tw-background-color-canvas` | Gray 900 — `#13161b` |
| `--tw-background-color-surface` | Gray 800 — `#22262f` |
| `--tw-background-color-raised` | Gray 700 — `#373a41` |
| `--tw-background-color-overlay-surface` | Gray 800 — `#22262f` |

Cards and dividers use the 8% alpha `--tw-border-color-subtle`; interactive
controls use `--tw-border-color-primary` and `--tw-border-color-hover`.
Status surfaces use the shared 16% fill and 35% subtle-border recipes rather
than component-specific banner or chip colors.

## Do / Don't

```less
/* DO */
color: var(--tw-text-color-primary);
background: var(--tw-background-color-surface);
border: 1px solid var(--tw-border-color-subtle);

/* DON'T — flagged as errors by token-audit */
color: #292a2e;
background: rgba(0, 0, 0, 0.03);
border: 1px solid #eaecf5;
```

## Cross-references

- [Elevation](elevation.md) — shadows use rgba tokens internally.
- [Token reference](../tokens/token-reference.md) — every color token + value.
- [`docs/colors.md`](../../docs/colors.md) — Tailwind `tw:` color usage and dark mode.

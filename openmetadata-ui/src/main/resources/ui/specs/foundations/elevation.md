# Elevation

Box-shadow scale, mirroring the upstream `--shadow-*` tokens. Shadow *colors*
(the rgba parts) are tokenized like any color; the offset geometry is preserved.

## Scale

| Token | Elevation | Use |
| --- | --- | --- |
| `--om-shadow-xs` | 1 | inputs, subtle cards, buttons |
| `--om-shadow-sm` | 2 | cards |
| `--om-shadow-md` | 3 | dropdowns, raised cards |
| `--om-shadow-lg` | 4 | tooltips, sticky bars, hover states |
| `--om-shadow-xl` | 5 | modals |
| `--om-shadow-2xl` | 6 | large modals, dialogs |
| `--om-shadow-3xl` | 7 | full-screen overlays |

Each references the upstream `--shadow-*` (from `globals.css`) with a raw
fallback so it resolves even in isolation.

## Semantic roles

Use semantic elevation for new component work. `card` and `overlay` alias the
existing scale. `raised` is the floating-overlay shadow in both themes
(ADR:2026-11-06-floating-overlays-sit-on-bg-floating).

| Token | Tailwind utility | Scale alias | Use |
| --- | --- | --- | --- |
| `--om-shadow-card` | `tw:shadow-card` | `--shadow-xs` | Cards and contained panels |
| `--om-shadow-raised` | `tw:shadow-raised` | `--shadow-lg` geometry, near-black 14 / 8 / 6% (dark: black 50 / 30 / 30%) | Menus, dropdowns, popovers, selects, date pickers |
| `--om-shadow-overlay` | `tw:shadow-overlay` | `--shadow-xl` | Modals and drawers |

## Bespoke shadows

Some components need one-off shadows (drawer footers, sticky headers, highlight
glows). Their rgba color stops are tokenized to `--om-legacy-color-*`, and the
offset/blur/spread values are kept verbatim:

```less
/* migrated */
box-shadow: 0px -13px 16px -4px var(--om-legacy-color-10-13-18-0-05),
  0px -4px 6px -2px var(--om-legacy-color-10-13-18-0-05);
```

When a bespoke shadow matches a scale step, prefer the token
(`box-shadow: var(--om-shadow-md);`).

## Do / Don't

```less
/* DO */
box-shadow: var(--om-shadow-card);

/* DON'T introduce a raw rgba color in a shadow */
box-shadow: 0px 1px 2px rgba(10, 13, 18, 0.05); /* rgba flagged as a color error */
```

## Cross-references

- [Color](color.md) · [Radius](radius.md) · [Token reference](../tokens/token-reference.md)

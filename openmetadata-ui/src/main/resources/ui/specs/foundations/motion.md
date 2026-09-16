# Motion

Transition/animation durations and easing. Raw durations are flagged as
warnings by `yarn token-audit`.

## Durations

| Token | Value | Use |
| --- | --- | --- |
| `--om-duration-instant` | 100ms | micro-feedback (icon color) |
| `--om-duration-fast` | 150ms | hovers, small state changes |
| `--om-duration-base` | 200ms | **default** transition |
| `--om-duration-slow` | 300ms | drawers, expanding panels |
| `--om-duration-slower` | 500ms | large layout transitions |

Exact durations found in the codebase are preserved as `--om-duration-<ms>`
(e.g. `--om-duration-120`, `--om-duration-240`) in the generated block so no
timing changes during migration. For new work prefer the named steps above.

## Easing

| Token | Value |
| --- | --- |
| `--om-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--om-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--om-ease-out` | `cubic-bezier(0, 0, 0.2, 1)` |

Bespoke `cubic-bezier(...)` curves in transitions are left as-is (not a token
category); prefer the named easings for new work.

## z-index (stacking, documented here for convenience)

Migration preserved exact z-index values as `--om-z-<n>`. For **new** work use
the semantic ladder:

| Token | Value | Layer |
| --- | --- | --- |
| `--om-z-base` | 0 | in-flow |
| `--om-z-raised` | 1 | raised element |
| `--om-z-docked` | 10 | sticky sub-headers |
| `--om-z-sticky` | 100 | sticky headers |
| `--om-z-dropdown` | 1000 | dropdowns, selects |
| `--om-z-overlay` | 1050 | drawers, scrims |
| `--om-z-modal` | 1500 | modals |
| `--om-z-popover` | 2000 | popovers, tooltips |
| `--om-z-toast` | 9000 | toasts |
| `--om-z-max` | 9999 | top-most |

## Do / Don't

```less
/* DO */
transition: all var(--om-duration-base) var(--om-ease-standard);
z-index: var(--om-z-dropdown);

/* DON'T */
transition: all 0.2s ease;
z-index: 1000;
```

## Cross-references

- [Token reference](../tokens/token-reference.md)

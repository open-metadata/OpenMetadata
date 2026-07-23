# Color Usage Handbook

A guide for developers and AI agents on how to use colors safely across OpenMetadata UI with full dark mode support.

---

## 1. Mental Model

OpenMetadata uses **semantic color tokens** — named abstractions that map to specific values in light mode and automatically remap to different values in dark mode. A token like `tw:bg-primary` resolves to `#ffffff` in light mode and `#0c0e12` in dark mode without any extra code.

### How Dark Mode Works

Dark mode is controlled by a `.dark-mode` CSS class applied to a parent element (typically `<body>` or a root wrapper). When `.dark-mode` is present, CSS custom properties defined in `globals.css` remap to their dark-mode equivalents via the `.dark-mode` selector override.

**In most cases you do not need to write `tw:dark:*` prefixes.** Semantic tokens handle both modes automatically. Use `tw:dark:*` only when a specific design decision requires an explicit override that the token system does not express.

```tsx
// ✅ Correct — token handles both modes
<div className="tw:bg-primary tw:text-primary">...</div>

// ✅ Also correct — explicit dark override for a deliberate design decision
<div className="tw:bg-white tw:dark:bg-gray-900">Special surface with custom dark treatment</div>

// ❌ Wrong — redundantly re-implementing what a token already does
<div className="tw:bg-white tw:dark:bg-gray-950 tw:text-gray-900 tw:dark:text-gray-50">...</div>
```

### Rules

- **Prefer semantic tokens over raw palette classes.** Tokens adapt to dark mode automatically and encode intent (e.g. "this is a primary surface") rather than a raw shade.
- **Use `tw:dark:*` for explicit design decisions only** — when the token system does not express what you need, or when a specific component intentionally deviates from the default token mapping.
- **Never hardcode hex values** inline or in style props.
- **Use utility colors** (`tw:bg-utility-brand-*`) for data-bound UI (badges, tags, charts) — these also invert automatically.
- **Use foreground tokens** (`tw:text-fg-*`) for SVG icons, not text tokens.

---

## 2. Token Categories & Usage Rules

### 2.1 Backgrounds

Use background tokens for surfaces, containers, cards, modals, and page-level backgrounds.

| Tailwind Class | CSS Variable | Light | Dark | When to Use |
|---|---|---|---|---|
| `tw:bg-primary` | `--color-bg-primary` | `#ffffff` | `#0c0e12` | Default page, card, modal background |
| `tw:bg-primary_alt` | `--color-bg-primary_alt` | `#ffffff` | `#13161b` (bg-secondary) | Alternate surface; pairs with `bg-primary` for subtle layering |
| `tw:bg-primary_hover` | `--color-bg-primary_hover` | `#fafafa` | `#22262f` | Hover state on primary surface |
| `tw:bg-secondary` | `--color-bg-secondary` | `#fafafa` | `#13161b` | Secondary surface, sidebar, panel |
| `tw:bg-secondary_alt` | `--color-bg-secondary_alt` | `#fafafa` | `#0c0e12` (bg-primary) | Alternate secondary surface |
| `tw:bg-secondary_subtle` | `--color-bg-secondary_subtle` | `#fdfdfd` | `#13161b` | Subtle secondary background |
| `tw:bg-secondary_hover` | `--color-bg-secondary_hover` | `#f5f5f5` | `#22262f` | Hover on secondary surface |
| `tw:bg-tertiary` | `--color-bg-tertiary` | `#f5f5f5` | `#22262f` | Input backgrounds, code blocks, chips |
| `tw:bg-quaternary` | `--color-bg-quaternary` | `#e9eaeb` | `#373a41` | Strongest neutral surface, skeleton loaders |
| `tw:bg-active` | `--color-bg-active` | `#fafafa` | `#22262f` | Selected/active row or nav item |
| `tw:bg-disabled` | `--color-bg-disabled` | `#f5f5f5` | `#22262f` | Disabled input or button surface |
| `tw:bg-disabled_subtle` | `--color-bg-disabled_subtle` | `#fafafa` | `#13161b` | Subtler disabled surface |
| `tw:bg-overlay` | `--color-bg-overlay` | `#0a0d12` | `#22262f` | Modal backdrops, drawer overlays |
| `tw:bg-primary-solid` | `--color-bg-primary-solid` | `#0a0d12` | `#13161b` | High-contrast solid surface (rare) |
| `tw:bg-secondary-solid` | `--color-bg-secondary-solid` | `#535862` | `#535862` | Solid secondary (e.g. dark tooltips) |

**Brand backgrounds:**

| Tailwind Class | CSS Variable | Light | Dark | When to Use |
|---|---|---|---|---|
| `tw:bg-brand-primary` | `--color-bg-brand-primary` | `#eff8ff` | `#2e90fa` | Light brand tint surface |
| `tw:bg-brand-primary_alt` | `--color-bg-brand-primary_alt` | `#eff8ff` | `#13161b` | Alternate brand tint |
| `tw:bg-brand-secondary` | `--color-bg-brand-secondary` | `#d1e9ff` | `#1570ef` | Stronger brand tint |
| `tw:bg-brand-solid` | `--color-bg-brand-solid` | `#1570ef` | `#1570ef` | Primary CTA button fill |
| `tw:bg-brand-solid_hover` | `--color-bg-brand-solid_hover` | `#175cd3` | `#2e90fa` | CTA button hover |
| `tw:bg-brand-section` | `--color-bg-brand-section` | `#1849a9` | `#13161b` | Full-width brand banner section |
| `tw:bg-brand-section_subtle` | `--color-bg-brand-section_subtle` | `#175cd3` | `#0c0e12` | Subtle brand banner section |

**Status backgrounds:**

| Tailwind Class | Light | Dark | When to Use |
|---|---|---|---|
| `tw:bg-error-primary` | `#fef3f2` | `#55160c` | Error/alert container background |
| `tw:bg-error-secondary` | `#fee4e2` | `#d92d20` | Stronger error background |
| `tw:bg-error-solid` | `#d92d20` | `#d92d20` | Solid error badge/button |
| `tw:bg-warning-primary` | `#fffaeb` | `#4e1d09` | Warning container background |
| `tw:bg-warning-secondary` | `#fef0c7` | `#dc6803` | Stronger warning background |
| `tw:bg-warning-solid` | `#dc6803` | `#dc6803` | Solid warning badge |
| `tw:bg-success-primary` | `#ecfdf3` | `#053321` | Success container background |
| `tw:bg-success-secondary` | `#dcfae6` | `#079455` | Stronger success background |
| `tw:bg-success-solid` | `#079455` | `#079455` | Solid success badge |

```tsx
// ✅ Correct
<div className="tw:bg-primary">Page content</div>
<div className="tw:bg-secondary">Sidebar</div>
<div className="tw:bg-error-primary tw:border tw:border-error">Error banner</div>

// ❌ Wrong
<div className="tw:bg-white">...</div>
<div className="tw:bg-gray-50">...</div>
<div style={{ backgroundColor: '#fef3f2' }}>...</div>
```

---

### 2.2 Text

Use text tokens for all text content. Choose the hierarchy level that matches the visual weight of the text.

| Tailwind Class | CSS Variable | Light | Dark | When to Use |
|---|---|---|---|---|
| `tw:text-primary` | `--color-text-primary` | `#181d27` (gray-900) | `#fafafa` (gray-50) | Headings, primary body text |
| `tw:text-secondary` | `--color-text-secondary` | `#414651` (gray-700) | `#d5d7da` (gray-300) | Secondary body, labels |
| `tw:text-secondary_hover` | `--color-text-secondary_hover` | `#252b37` | `#e9eaeb` | Hover state on secondary text |
| `tw:text-tertiary` | `--color-text-tertiary` | `#535862` (gray-600) | `#a4a7ae` (gray-400) | Captions, helper text, timestamps |
| `tw:text-tertiary_hover` | `--color-text-tertiary_hover` | `#414651` | `#d5d7da` | Hover state on tertiary text |
| `tw:text-quaternary` | `--color-text-quaternary` | `#717680` (gray-500) | `#a4a7ae` (gray-400) | Placeholder-level, very muted text |
| `tw:text-disabled` | `--color-text-disabled` | `#717680` | `#717680` | Disabled text |
| `tw:text-placeholder` | `--color-text-placeholder` | `#717680` | `#717680` | Input placeholder text |
| `tw:text-placeholder_subtle` | `--color-text-placeholder_subtle` | `#d5d7da` | `#414651` | Ghosted placeholder |
| `tw:text-white` | `--color-text-white` | `#ffffff` | `#ffffff` | Text on dark/solid backgrounds only |

**Brand text:**

| Tailwind Class | Light | Dark | When to Use |
|---|---|---|---|
| `tw:text-brand-primary` | `#194185` (brand-900) | `#fafafa` | Strong brand text, page titles on brand surface |
| `tw:text-brand-secondary` | `#175cd3` (brand-700) | `#d5d7da` | Brand links, secondary brand text |
| `tw:text-brand-secondary_hover` | `#1849a9` | `#e9eaeb` | Hover on brand links |
| `tw:text-brand-tertiary` | `#1570ef` (brand-600) | `#a4a7ae` | Lighter brand text |
| `tw:text-brand-tertiary_alt` | `#1570ef` | `#fafafa` | Alternate lighter brand text |

**On-brand text** (use inside brand-colored containers like CTAs or dark headers):

| Tailwind Class | Light | Dark | When to Use |
|---|---|---|---|
| `tw:text-primary_on-brand` | `#ffffff` | `#fafafa` | Primary text on brand surface |
| `tw:text-secondary_on-brand` | `#b2ddff` (brand-200) | `#d5d7da` | Secondary text on brand surface |
| `tw:text-tertiary_on-brand` | `#b2ddff` | `#a4a7ae` | Tertiary text on brand surface |
| `tw:text-quaternary_on-brand` | `#84caff` (brand-300) | `#a4a7ae` | Quaternary text on brand surface |

**Status text:**

| Tailwind Class | Light | Dark | When to Use |
|---|---|---|---|
| `tw:text-error-primary` | `#d92d20` (error-600) | `#f97066` (error-400) | Error messages, validation feedback |
| `tw:text-warning-primary` | `#dc6803` (warning-600) | `#fdb022` (warning-400) | Warning messages |
| `tw:text-success-primary` | `#079455` (success-600) | `#47cd89` (success-400) | Success messages |

```tsx
// ✅ Correct
<h1 className="tw:text-primary">Dashboard</h1>
<p className="tw:text-secondary">Last updated 5 minutes ago</p>
<span className="tw:text-tertiary">Optional</span>
<span className="tw:text-error-primary">This field is required</span>

// ❌ Wrong
<h1 className="tw:text-gray-900">...</h1>
<p className="tw:text-gray-700">...</p>
<span className="tw:text-gray-500">...</span>
<span className="tw:text-red-600">...</span>
```

---

### 2.3 Borders

Use border tokens for input outlines, card dividers, separators, and table borders. Apply with `tw:border` + a border-color token.

| Tailwind Class | CSS Variable | Light | Dark | When to Use |
|---|---|---|---|---|
| `tw:border-primary` | `--color-border-primary` | `#d5d7da` (gray-300) | `#373a41` (gray-700) | Default card, input, and divider borders |
| `tw:border-secondary` | `--color-border-secondary` | `#e9eaeb` (gray-200) | `#22262f` (gray-800) | Subtle borders, section separators |
| `tw:border-secondary_alt` | `--color-border-secondary_alt` | `rgba(0,0,0,0.08)` | `#22262f` | Alpha-transparent borders |
| `tw:border-tertiary` | `--color-border-tertiary` | `#f5f5f5` (gray-100) | `#22262f` | Very subtle dividers |
| `tw:border-brand` | `--color-border-brand` | `#2e90fa` (brand-500) | `#53b1fd` (brand-400) | Focused inputs, selected states |
| `tw:border-brand_alt` | `--color-border-brand_alt` | `#1570ef` (brand-600) | `#373a41` | Alternate brand border |
| `tw:border-error` | `--color-border-error` | `#f04438` (error-500) | `#f97066` (error-400) | Error state input/container border |
| `tw:border-error_subtle` | `--color-border-error_subtle` | `#fda29b` (error-300) | `#f04438` (error-500) | Subtle error border |
| `tw:border-disabled` | `--color-border-disabled` | `#d5d7da` | `#373a41` | Disabled input border |
| `tw:border-disabled_subtle` | `--color-border-disabled_subtle` | `#e9eaeb` | `#22262f` | Subtle disabled border |

**Outline tokens** follow the same naming (`tw:outline-primary`, `tw:outline-brand`, …) and
resolve to the same values. **Ring tokens exist but must not be used to draw an edge** — see
§2.3.1.

```tsx
// ✅ Correct
<input className="tw:border tw:border-primary focus:tw:border-brand" />
<div className="tw:border tw:border-error">Invalid input</div>

// ❌ Wrong
<input className="tw:border tw:border-gray-300" />
<div className="tw:border tw:border-red-500">...</div>
```

---

### 2.3.1 Never use `ring-*` to draw a border — use `border` or `outline`

**Rule: `tw:ring-*` is banned for any visible edge.** Use `tw:border-*` where the edge may
occupy layout space, and `tw:outline-*` where it must not.

#### Why

Tailwind's `ring-*` compiles to a `box-shadow`. **WebKit does not pixel-snap box-shadows**,
so a ring used as a border thins out — and at some zoom levels disappears entirely — in
Safari. `border` and `outline` are snapped to whole device pixels and never degrade.

Measured peak border darkness (42 = full strength) across a 50–150% zoom sweep:

| | `border` | `ring` | `outline` |
|---|---|---|---|
| WebKit @1x | 42..42 | **0..42** (vanishes) | 42..42 |
| Chromium @1x | 42..42 | 21..42 (dims ~50%) | 42..42 |
| WebKit @2x | 42..42 | 42..42 | 42..42 |

Chromium degrades rings too — it just never falls far enough to notice, which is why this
reads as a Safari-only bug. Confirmed in real Safari: an inset outline and a real border are
indistinguishable at every zoom; the ring is not.

#### Which one to use

| Situation | Use |
|---|---|
| Edge may take layout space (static container, card) | `tw:border tw:border-<token>` |
| Edge must be layout-neutral, element's `outline` is free | `tw:outline-1 tw:-outline-offset-1 tw:outline-<token>` |
| Element's `outline` is already the focus ring | **`::after` overlay** — see below |

`border` consumes 1px of the box. On controls whose height is content-driven, switching a
ring to a border makes them 2px taller and makes them **grow on focus** (1px → 2px). That is
why controls use `outline`, not `border`.

#### Translating an existing ring

| Ring | Equivalent |
|---|---|
| `tw:ring-1 tw:ring-inset tw:ring-X` | `tw:outline-1 tw:-outline-offset-1 tw:outline-X` |
| `tw:ring-1 tw:ring-X` (no `ring-inset`) | `tw:outline-1 tw:outline-X` — offset **0**, since a non-inset ring draws *outward* |
| `tw:ring-2 …` (focus) | `tw:outline-2 tw:-outline-offset-2 tw:outline-X` |
| `tw:ring-0` (suppressor) | `tw:outline-0` — or `tw:after:outline-0` if the target draws its border on `::after` |

Getting the offset wrong shifts the edge by 1px, so check for `ring-inset` before converting.

#### When the outline is already taken (focusable elements)

An element has **exactly one** outline. Buttons, checkboxes, radios, toggles, tags, tabs and
the slider thumb already use theirs for the focus ring, and they must show the border **and**
the focus ring at once. Draw the border on an `::after` overlay instead — import
`borderAfter` from `@openmetadata/ui-core-components`:

```tsx
import { borderAfter } from '@openmetadata/ui-core-components';

// host needs `tw:relative`; supply the colour with `tw:after:outline-<token>`
<button className={cx('tw:relative', borderAfter, 'tw:after:outline-primary')} />
```

State changes stack the variant: `tw:disabled:after:outline-disabled_subtle`. A 2px variant,
`borderAfter2`, exists for edges that were `ring-2`.

**Overriding a core component's border from a consumer:** match where that component draws
it. `Button`/`ButtonUtility`/`Tab` draw on `::after` → use `tw:after:outline-<token>`.
`Input`/`Select`/`Badge`/`Card` draw on the element → use `tw:outline-<token>`. Using
`tw:outline-*` on a Button sets its **focus** colour, not its border — a silent no-op.

#### Gotchas

- **`tw:outline-hidden` / `outline: none` erases an outline border.** If a component draws
  its border with `outline`, any `outline-hidden` on that element must go. Unlayered LESS
  beats Tailwind utilities regardless of specificity, so a stray `outline: none` in a `.less`
  file will silently kill a border.
- **`tw:transition-shadow` does not animate an outline.** Use
  `tw:transition-[outline-color,outline-width]`. Plain `tw:transition` covers `outline-color`
  but **not** `outline-width`.
- **`tw:shadow-*` is a real drop shadow** — keep it; it is not the ring.
- **`--shadow-skeumorphic`** (`globals.css`) contains an inset `0 0 0 1px` layer and has the
  same Safari fragility as a ring.
- **Suppressors may carry an important modifier — and the two forms are not
  interchangeable.** A `ring-0` written as `tw:!ring-0` is just as dead as a plain one once
  the border is an outline, so it must become `tw:!outline-0`. But when the target draws its
  border on `::after`, the replacement **must use the suffix form**
  `tw:after:outline-0!` — the prefix form `tw:!after:outline-0` (`!` before a variant)
  compiles to **nothing at all**, silently reproducing the bug it was meant to fix. Verify
  any important-modified class actually generates CSS before trusting it.
- **A static `outline-<colour>` leaks into the focus ring.** Core components declare their
  focus indicator as a *base* colour plus `focus-visible:outline-2
  focus-visible:outline-offset-2` — **width and offset only, no colour**. So when a consumer
  sets its own base `outline-<colour>` for a resting border, tailwind-merge makes the consumer
  win and **the focus ring renders in that static colour**. `outline-black/5` becomes a
  5%-opacity focus ring; `outline-brand-600/12` becomes 12% — i.e. no visible focus indicator.
  Whenever you put a static outline colour on a focusable element, either pair it with an
  explicit `tw:focus-visible:outline-<colour>`, or move the static edge to `::after` and leave
  the element's `outline` to focus. `Card`'s outline in particular is reserved for focus.
- **Searching for leftovers: use `[^a-zA-Z]ring-`.** Narrower patterns miss real cases —
  `tw:ring-` misses variant forms (`tw:focus-visible:ring-2`, `tw:has-[&>select]:ring-1`)
  and `:ring` misses important-prefixed ones (`tw:!ring-0`). An ESLint
  `no-restricted-syntax` rule now enforces this in all three UI packages; prefer fixing the
  code over adding to its allow-list.

#### No exceptions

There are **zero** remaining `ring-*` usages, and the ESLint rule has **no allow-list**. Cases
that once looked unconvertible all had an exact equivalent:

- **`ring-offset-*` halos.** The offset gap is filled with `--tw-ring-offset-color`, whose
  default is `#fff`. When the ring colour is *also* white the two merge into a single
  `(ring + offset)`px band — e.g. `ring-2 ring-white ring-offset-2` is exactly
  `outline-4 outline-white`. Where the colours differ, `outline-offset-N` reproduces the
  geometry and leaves the gap transparent (identical over a white backdrop, and avoids a
  hardcoded white gap in dark mode).
- **Consumer focus rings on `Button`.** `Button` already applies
  `outline-brand focus-visible:outline-2 focus-visible:outline-offset-2`. A consumer
  `focus-visible:ring-2 ring-brand ring-offset-2` duplicates it exactly — delete rather than
  convert. If the consumer ring had **no** `ring-offset`, it sat flush against Button's
  outline and read as one `4px` band: use `focus-visible:outline-4 focus-visible:outline-offset-0`.
- **`Avatar` consumers.** `Avatar` draws its contrast border with the element `outline`, so a
  consumer outline would clobber it — but its root has `tw:relative` and no `::after`, so the
  extra edge goes on `::after`. These rings are non-inset, so use **offset 0**; do *not* reuse
  `borderAfter`, which bakes in `-outline-offset-1`.
- **`ring-0` on `Card`.** `Card` uses a real `border` and never had a ring, so the suppressor
  was inert — just delete it.
- **A ring colour with no width class** (e.g. `ring-secondary` alone) is *not* dead when the
  component supplies the width. On a migrated component whose border moved to `::after`, the
  override must become `after:outline-<token>` — deleting it silently leaves the default
  colour.

---

### 2.4 Foreground / Icons

Use foreground tokens for SVG icons and decorative graphic elements. These are distinct from text tokens — `fg` tokens are tuned for icon contrast ratios, which differ slightly from text.

| Tailwind Class | CSS Variable | Light | Dark | When to Use |
|---|---|---|---|---|
| `tw:text-fg-white` | `--color-fg-white` | `#ffffff` | `#ffffff` | Icons on solid dark backgrounds |
| `tw:text-fg-primary` | `--color-fg-primary` | `#181d27` | `#ffffff` | Primary/high-emphasis icons |
| `tw:text-fg-secondary` | `--color-fg-secondary` | `#414651` | `#d5d7da` | Standard UI icons |
| `tw:text-fg-secondary_hover` | `--color-fg-secondary_hover` | `#252b37` | `#e9eaeb` | Icon hover state |
| `tw:text-fg-tertiary` | `--color-fg-tertiary` | `#535862` | `#a4a7ae` | Muted/supporting icons |
| `tw:text-fg-tertiary_hover` | `--color-fg-tertiary_hover` | `#414651` | `#d5d7da` | Hover on muted icons |
| `tw:text-fg-quaternary` | `--color-fg-quaternary` | `#a4a7ae` | `#535862` | Very muted icons, decorative only |
| `tw:text-fg-quaternary_hover` | `--color-fg-quaternary_hover` | `#717680` | `#717680` | Hover on quaternary icons |
| `tw:text-fg-disabled` | `--color-fg-disabled` | `#a4a7ae` | `#717680` | Disabled icon |
| `tw:text-fg-disabled_subtle` | `--color-fg-disabled_subtle` | `#d5d7da` | `#535862` | Subtler disabled icon |
| `tw:text-fg-brand-primary` | `--color-fg-brand-primary` | `#1570ef` | `#2e90fa` | Brand-colored icons |
| `tw:text-fg-brand-primary_alt` | `--color-fg-brand-primary_alt` | `#1570ef` | `#d5d7da` | Alternate brand icon |
| `tw:text-fg-brand-secondary` | `--color-fg-brand-secondary` | `#2e90fa` | `#2e90fa` | Secondary brand icons |
| `tw:text-fg-brand-secondary_hover` | `--color-fg-brand-secondary_hover` | `#1570ef` | `#717680` | Hover on secondary brand icon |
| `tw:text-fg-error-primary` | `--color-fg-error-primary` | `#d92d20` | `#f04438` | Error icons |
| `tw:text-fg-error-secondary` | `--color-fg-error-secondary` | `#f04438` | `#f97066` | Secondary error icons |
| `tw:text-fg-warning-primary` | `--color-fg-warning-primary` | `#dc6803` | `#f79009` | Warning icons |
| `tw:text-fg-warning-secondary` | `--color-fg-warning-secondary` | `#f79009` | `#fdb022` | Secondary warning icons |
| `tw:text-fg-success-primary` | `--color-fg-success-primary` | `#079455` | `#17b26a` | Success icons |
| `tw:text-fg-success-secondary` | `--color-fg-success-secondary` | `#17b26a` | `#47cd89` | Secondary success icons |

```tsx
// ✅ Correct
<SearchIcon className="tw:text-fg-secondary" />
<AlertIcon className="tw:text-fg-error-primary" />
<BrandIcon className="tw:text-fg-brand-primary" />

// ❌ Wrong
<SearchIcon className="tw:text-gray-700" />
<AlertIcon className="tw:text-red-600" />
```

---

### 2.5 Status Colors — Variant Guide

Each status (error, warning, success) has three background variants with different intensities:

| Variant | Background Token | Text Token | Border Token | Use Case |
|---|---|---|---|---|
| `primary` | `tw:bg-error-primary` | `tw:text-error-primary` | `tw:border-error` | Inline alerts, banners |
| `secondary` | `tw:bg-error-secondary` | `tw:text-error-primary` | `tw:border-error_subtle` | Badge backgrounds, row highlights |
| `solid` | `tw:bg-error-solid` | `tw:text-white` | — | Filled badges, notification dots |

The same pattern applies for `warning` and `success`. Always pair background + text + border tokens from the **same status family** — never mix `bg-error-*` with `tw:text-warning-*`.

```tsx
// ✅ Correct — consistent token family
<div className="tw:bg-error-primary tw:border tw:border-error tw:text-error-primary">
  Failed to save
</div>

// ✅ Correct — solid badge
<span className="tw:bg-success-solid tw:text-white tw:rounded-full tw:px-2">
  Active
</span>

// ❌ Wrong — mixing families
<div className="tw:bg-error-primary tw:text-red-700 tw:border-red-400">...</div>
```

---

### 2.6 Brand Colors

Brand tokens are for CTAs, highlighted navigation, brand-accented UI, and section backgrounds.

| Tailwind Class | Light | Dark | When to Use |
|---|---|---|---|
| `tw:bg-brand-solid` | `#1570ef` | `#1570ef` | Primary action button fill |
| `tw:bg-brand-solid_hover` | `#175cd3` | `#2e90fa` | CTA button hover state |
| `tw:bg-brand-primary` | `#eff8ff` | `#2e90fa` | Brand-tinted content area |
| `tw:bg-brand-secondary` | `#d1e9ff` | `#1570ef` | Stronger brand-tinted area |
| `tw:bg-brand-section` | `#1849a9` | `#13161b` | Full-width brand promo section |
| `tw:bg-brand-section_subtle` | `#175cd3` | `#0c0e12` | Subtle brand promo section |
| `tw:text-brand-primary` | `#194185` | `#fafafa` | Strong brand text |
| `tw:text-brand-secondary` | `#175cd3` | `#d5d7da` | Brand links |
| `tw:text-brand-tertiary` | `#1570ef` | `#a4a7ae` | Lighter brand text |
| `tw:border-brand` | `#2e90fa` | `#53b1fd` | Focused/selected border |
| `tw:text-fg-brand-primary` | `#1570ef` | `#2e90fa` | Brand icons |

---

### 2.7 Utility Colors

Utility colors are for data-driven UI elements like badges, tags, category chips, and data visualization where you need a specific hue. All utility tokens automatically invert in dark mode (light shades become dark and vice versa), so you still only need to write one class.

The pattern is: `tw:bg-utility-{family}-{shade}`. The `brand` and `gray` families support shades `50`–`900`; all other families support `50`–`700`.

Available families: `brand`, `gray`, `blue`, `blue-dark`, `blue-light`, `gray-blue`, `error`, `warning`, `success`, `orange`, `orange-dark`, `indigo`, `fuchsia`, `pink`, `purple`, `green`, `yellow`.

**Dark mode inversion rule:** In dark mode, `utility-{family}-50` maps to the `950` raw palette value, `100` maps to `900`, `200` to `800`, and so on. The `500` shade stays fixed. This means light tint backgrounds in light mode become dark tint backgrounds in dark mode automatically.

```tsx
// ✅ Correct — badge with auto dark mode
<span className="tw:bg-utility-success-50 tw:text-utility-success-700 tw:border tw:border-utility-success-200">
  Verified
</span>

// ✅ Correct — category chips
<span className="tw:bg-utility-purple-50 tw:text-utility-purple-700">ML Model</span>
<span className="tw:bg-utility-orange-50 tw:text-utility-orange-700">Pipeline</span>

// ❌ Wrong — raw palette doesn't invert
<span className="tw:bg-green-50 tw:text-green-700">...</span>
<span className="tw:bg-purple-100 tw:text-purple-800">...</span>
```

**Utility color shade guide:**

| Shade | Background Use | Text/Icon Use | Available in |
|---|---|---|---|
| `50` | Badge/chip background (lightest) | — | All families |
| `100` | Slightly stronger badge background | — | All families |
| `200` | Badge border | — | All families |
| `300` | Hover border | — | All families |
| `400` | — | Muted icon inside badge | All families |
| `500` | Medium fill (fixed across modes) | Medium icon | All families |
| `600` | Solid fill | — | All families |
| `700` | — | Default text inside badge | All families |
| `800` | — | Strong/dark text | `brand`, `gray` only |
| `900` | Dark fill (strongest) | — | `brand`, `gray` only |

---

### 2.8 Component Tokens

These tokens are for specific component internals. Use them when building or extending those components — do not use them for general layout.

| Tailwind Class | CSS Variable | Light | Dark | Component |
|---|---|---|---|---|
| `tw:bg-avatar-bg` | `--color-avatar-bg` | `#f5f5f5` | `#22262f` | Avatar fallback background |
| `tw:text-button-primary-icon` | `--color-button-primary-icon` | `#84caff` | `#84caff` | Icon inside primary button |
| `tw:text-button-primary-icon_hover` | `--color-button-primary-icon_hover` | `#b2ddff` | `#b2ddff` | Icon inside primary button (hover) |
| `tw:text-button-destructive-primary-icon` | `--color-button-destructive-primary-icon` | `#fda29b` | `#fda29b` | Icon inside destructive button |
| `tw:ring-focus-ring` | `--color-focus-ring` | `#2e90fa` | `#2e90fa` | Keyboard focus ring |
| `tw:ring-focus-ring-error` | `--color-focus-ring-error` | `#f04438` | `#f04438` | Error-state focus ring |
| `tw:bg-slider-handle-bg` | `--color-slider-handle-bg` | `#ffffff` | `#2e90fa` | Slider thumb background |
| `tw:border-slider-handle-border` | `--color-slider-handle-border` | `#1570ef` | `#0c0e12` | Slider thumb border |
| `tw:border-toggle-border` | `--color-toggle-border` | `#d5d7da` | `transparent` | Toggle track border |
| `tw:text-tooltip-supporting-text` | `--color-tooltip-supporting-text` | `#d5d7da` | `#d5d7da` | Tooltip secondary/supporting text |
| `tw:text-text-editor-icon-fg` | `--color-text-editor-icon-fg` | `#a4a7ae` | `#a4a7ae` | Rich text editor toolbar icons |
| `tw:text-text-editor-icon-fg_active` | `--color-text-editor-icon-fg_active` | `#717680` | `#ffffff` | Active rich text editor icon |
| `tw:text-featured-icon-light-fg-brand` | `--color-featured-icon-light-fg-brand` | `#1570ef` | `#b2ddff` | Brand featured icon |
| `tw:text-featured-icon-light-fg-error` | `--color-featured-icon-light-fg-error` | `#d92d20` | `#fecdca` | Error featured icon |
| `tw:text-featured-icon-light-fg-success` | `--color-featured-icon-light-fg-success` | `#079455` | `#abefc6` | Success featured icon |
| `tw:text-featured-icon-light-fg-warning` | `--color-featured-icon-light-fg-warning` | `#dc6803` | `#fedf89` | Warning featured icon |
| `tw:text-featured-icon-light-fg-gray` | `--color-featured-icon-light-fg-gray` | `#717680` | `#e9eaeb` | Neutral featured icon |
| `tw:text-icon-fg-brand` | `--color-icon-fg-brand` | `#1570ef` | `#a4a7ae` | Generic brand icon |
| `tw:text-icon-fg-brand_on-brand` | `--color-icon-fg-brand_on-brand` | `#b2ddff` | `#a4a7ae` | Brand icon on brand background |

---

## 3. Anti-Pattern Cheat Sheet

Quick reference for the most common mistakes. When reviewing or writing code, scan for these patterns and replace them.

| ❌ Don't use | ✅ Use instead | Why |
|---|---|---|
| `tw:bg-white` | `tw:bg-primary` | Breaks dark mode (stays white) |
| `tw:bg-gray-50` | `tw:bg-secondary` | Hardcoded palette doesn't adapt |
| `tw:bg-gray-100` | `tw:bg-tertiary` | Use semantic token |
| `tw:bg-gray-200` | `tw:bg-quaternary` | Use semantic token |
| `tw:bg-gray-900` or `tw:bg-gray-950` | `tw:bg-overlay` or `tw:bg-primary-solid` | Depends on context |
| `tw:text-gray-900` | `tw:text-primary` | Raw palette, not dark-mode-safe |
| `tw:text-gray-700` | `tw:text-secondary` | Use semantic token |
| `tw:text-gray-600` | `tw:text-tertiary` | Use semantic token |
| `tw:text-gray-500` | `tw:text-quaternary` or `tw:text-placeholder` | Depends on context |
| `tw:text-white` (on non-solid bg) | `tw:text-primary_on-brand` | Only use on brand/dark surfaces |
| `tw:text-blue-600` | `tw:text-fg-brand-primary` or `tw:text-brand-tertiary` | Use brand tokens |
| `tw:text-red-600` | `tw:text-error-primary` or `tw:text-fg-error-primary` | Use error tokens |
| `tw:text-green-600` | `tw:text-success-primary` or `tw:text-fg-success-primary` | Use success tokens |
| `tw:border-gray-300` | `tw:border-primary` | Hardcoded palette |
| `tw:border-gray-200` | `tw:border-secondary` | Hardcoded palette |
| `tw:border-red-500` | `tw:border-error` | Use error token |
| `tw:border-blue-500` | `tw:border-brand` | Use brand token |
| `tw:bg-green-50 tw:text-green-700` | `tw:bg-utility-success-50 tw:text-utility-success-700` | Utility tokens invert in dark mode |
| `tw:bg-purple-100 tw:text-purple-800` | `tw:bg-utility-purple-100 tw:text-utility-purple-700` | Use utility tokens for badges/chips |
| `tw:dark:bg-gray-900` (redundant) | Use `tw:bg-primary` instead | If a token already handles it, the explicit override is noise — only keep `tw:dark:*` when overriding for a deliberate design reason |
| `tw:dark:text-white` (redundant) | Use `tw:text-primary` instead | Same — prefer the token unless the design specifically diverges |
| `style={{ color: '#1570ef' }}` | `tw:text-fg-brand-primary` | Never hardcode hex values |
| `style={{ backgroundColor: '#ffffff' }}` | `tw:bg-primary` | Never hardcode hex values |
| `tw:ring-1 tw:ring-inset tw:ring-primary` | `tw:outline-1 tw:-outline-offset-1 tw:outline-primary` | Rings are box-shadows; WebKit doesn't pixel-snap them, so they thin/vanish in Safari when zoomed. See §2.3.1 |
| `tw:ring-1 tw:ring-secondary` (no `ring-inset`) | `tw:outline-1 tw:outline-secondary` | Same — but offset **0**, because a non-inset ring draws outward |
| `tw:ring-2 tw:ring-brand` (focus) | `tw:outline-2 tw:-outline-offset-2 tw:outline-brand` | Same |
| `tw:ring-0` to suppress a core component's border | `tw:outline-0`, or `tw:after:outline-0` if it draws on `::after` | After the ring→outline migration a `ring-0` is a no-op, so the border reappears |
| `tw:outline-<token>` to recolour a **Button**'s border | `tw:after:outline-<token>` | Button draws its border on `::after`; `outline-*` sets its *focus* colour instead |
| `tw:outline-hidden` on an element whose border is an outline | Remove it | It erases the border, not just the native focus ring |
| `tw:transition-shadow` alongside an outline border | `tw:transition-[outline-color,outline-width]` | `transition-shadow` only animates `box-shadow`, so the transition silently dies |

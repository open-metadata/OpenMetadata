# Core icons and buttons follow the Figma icon sizing spec

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial) · v2 2026-10-23 (three landing-page glyphs at a 1.67 stroke)
- **Deciders:** Rohit Jain
- **Guard:** `openmetadata-ui-core-components/.../components/base/buttons/button.test.tsx`; `normalizeToGrid` in `scripts/generate-icons.mjs` throws on 24-grid sources it cannot rescale
- **Related:** open-metadata/OpenMetadata#35348

## Context
Core-ui icons came from two grids: UntitledUI sources on a 24-unit viewBox and in-house sources on
a 20-unit one, both authored with `stroke-width="1.3"`. Stroke width is in viewBox units, so at the
same rendered size a 24-grid icon drew a 0.87px line and a 20-grid icon a 1.04px one — icons looked
mismatched next to each other. Buttons sized icons by their own ad-hoc scale (20/16/12px boxes),
coloured them gray-400 and brand-300, and used button heights (48/44/40/36/26/22) that matched no
row of the Figma *Icon sizing standards* / *Icons in buttons* spec.

## Decision
**Icons.** Generated core icons use a 20-unit viewBox and a default `size` of 20. The generator's
`normalizeToGrid` plugin rescales 24-grid sources' path geometry by 20/24 and leaves stroke-width
as authored. Every outline icon uses a 1.3 stroke. Other grids (18, 8, 89) are not rescaled;
filled glyphs (`Inherit`'s 0.1 hairline) and custom brand icons keep their own stroke.

**Icon frames.** An icon renders in a frame of glyph + 4px: 20 (16 glyph), 18 (14), 16 (12).
Icons draw in the middle 16 of 20 units, so 18 and 16 frames add 0.25px / 0.5px svg padding to
keep the glyph at frame − 4px.

**Button.** Sizes `xs`–`xl` are 28/32/36/40/44px (Compact, X-Small, Small, Medium, Large); default
`md`. Leading icon frame 20, trailing 18; `xs` uses 18 / 16. Neutral icons are `utility-gray-500`,
`utility-gray-600` on hover; primary icons are white; status and brand variants keep their colour.

**ButtonUtility.** Sizes `xs`–`xl` are 20/24/28/32/36px with icon frames 16/18/18/20/20 and radius
4/6/6/8/8px; default `sm`. `xs` is for tight inline actions and is always borderless: `secondary`
renders as `tertiary`, `secondary-destructive` as `tertiary-destructive`.

## Consequences
Explicit Button sizes render one step smaller than before (`sm` 36→32, `md` 40→36, `lg` 44→40) and
ButtonUtility `sm`/`xs` shrink to 24/20, and its default moves from 32px to `sm` (24px); call sites
that must keep a height move up one name.
Icons rendered without a size are 20px instead of 24px. A new 24-grid icon is converted on
`yarn icons:generate`; one that uses shapes other than `<path>` or transforms fails generation
until it is converted to paths.

## Amendment — v2: three landing-page glyphs at a 1.67 stroke

`LayoutRows`, `LayoutColumns` and `ChevronSelectorVertical02` are the landing page's list, grid and
collapse glyphs from design review Set 4, which draws them with a 2 stroke on a 24 grid. They are
authored at 1.67 on the 20 grid, the same rendered weight, instead of the 1.3 every other outline
icon uses.

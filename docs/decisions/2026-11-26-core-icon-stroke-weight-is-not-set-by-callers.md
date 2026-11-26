# Core icon stroke weight is not set by callers

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `reviewer`
- **Related:** #37311, #34141, ADR:2026-10-13-core-icons-and-buttons-follow-the-figma-icon-spec

## Context
Generated core-ui icons (`openmetadata-ui-core-components/.../src/icons/*.tsx`) write each shape's
designed `strokeWidth` on the shape itself, while caller props spread onto the root `<svg>`. An
attribute on a `<path>` beats a value inherited from its `<svg>`, so `<Check strokeWidth={2.5} />`
draws at the designed 1.3 — the prop type-checks and does nothing. Since the #34141 migration,
~20 call sites in OpenMetadata and core-ui passed `strokeWidth` (plus a `createIconWithStroke`
helper and `getEntityIconWithBg`'s 1.2 default), each believing it changed the weight.

## Decision
A core icon draws at the stroke weight its source SVG was designed with. Callers do not pass
`strokeWidth` to a core icon; every such call site was removed, along with `createIconWithStroke`
and `OntologyStudioIcon`. The icon `Props` type still extends `SVGProps<SVGSVGElement>` and the
generator is unchanged, so the 780+ generated icon files are untouched.

An icon that needs a different weight is redrawn by design and regenerated, as v2, v3 and v6 of
ADR:2026-10-13-core-icons-and-buttons-follow-the-figma-icon-spec did.

## Consequences
- No visual change: every removed prop was already ignored.
- The prop is still accepted by the type, so a new `strokeWidth` on a core icon compiles and is
  caught only in review. Making it a type error (`Omit<SVGProps<SVGSVGElement>, 'strokeWidth'>` in
  `templates/component.cjs`) regenerates every icon file; revisit if call sites reappear.
- Raw `<svg>`/`<path>` elements, chart and lineage edge styles keep their `strokeWidth` — they are
  not core icons.
- The core `Icon` component (`foundations/icon/icon.tsx`) keeps its public `strokeWidth` prop and
  still forwards it (default 1.5) as a root style, where it has the same no-op effect. Removing it
  changes that component's API, so it is left for a follow-up.

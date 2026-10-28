# Settings-modal panels sit on the muted step, and a muted container never nests another

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Rohit Jain
- **Guard:** reviewer; `table.test.tsx` and `field-doc-popover.test.tsx` pin the muted variants
- **Related:** open-metadata/openmetadata-collate#7851, ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only

## Context
The settings modal's panel is `bg-overlay-surface`, which in dark mode is the same gray-800 as
`bg-surface`. Cards, tables, accordions and field-hint popovers built on the default surface
therefore vanished into the modal; a table's 8%-white outline over its own rows landed on the
modal's colour, so the header lost its top edge, and the `bg-secondary` row hover equalled the row.

## Decision
- Every section-level container inside the settings modal uses the muted step (`bg-primary_alt`,
  gray-900 in dark, white in light): `Card variant="muted"`, `TableCard.Root variant="muted"`,
  legacy `TableV2 variant="muted"`, `FieldDocPopover variant="muted"` (`HookForm`
  `fieldDocVariant="muted"`), `AccordionItem variant="muted"`.
- The muted table variants carry their own frame (`border-primary` in dark), outer-table row
  background, a translucent `primary_hover` row hover and the matching clamp-fade colour, all from
  one exported class list (`MUTED_TABLE_SURFACE_CLASSES`); tables nested in an expanded row keep
  the default.
- A muted container never holds another muted Card: a card or skeleton nested inside a muted
  container uses `default`. A legacy `TableV2` is the exception — it paints its own surface from
  LESS, so inside a muted container it also takes `variant="muted"` or it shows a surface-coloured
  block.
- The look is expressed through core variants, not call-site colour classes, so a shared component
  reused on a classic page keeps its default; shared components take a `variant` prop that only the
  modal sets.
- A table that cannot sit in a `TableCard` (a `stickyHeader` table, which `TableCard`'s
  `overflow-hidden` would stop sticking) uses core `Table variant="muted"`, which frames its own
  container the same way.
- Named exception, styled at the call site because it is not a core component: the CodeMirror
  schema editors (`tw:dark:[&_.cm-editor]:bg-primary_alt!`), whose dark background is global LESS.

## Dark-mode overrides

Recorded per the dark-override review in `openmetadata-ui/.../docs/colors.md`. Owner: Rohit Jain;
tracking issue: open-metadata/openmetadata-collate#7851. Verified on the dark settings modal
(`bg-overlay-surface`, gray-800) and the light modal (white). All are permanent, not temporary.

| Override | Component / state | Why no semantic token covers it |
|---|---|---|
| `tw:dark:after:outline-primary`, `tw:dark:border-primary` | Muted `TableCard`, `Table`, `TableV2` frame, at rest | `border-secondary` is 8% white in dark and lands on the modal's own colour; `border-primary` (gray-700) is the header divider already used in dark. No token means "edge on overlay-surface". |
| `tw:dark:[&_table:not(table_table)]:bg-primary_alt` | Muted table rows, at rest | Core `Table` paints `tw:dark:bg-surface` on itself; the muted container must repaint the outermost table only. |
| `tw:dark:[--markdown-clamp-fade-color:…]!` (rest and row hover) | Clamped markdown in muted rows | The fade colour is a CSS variable pinned to `bg-surface` by unlayered LESS on `tbody`; it must track the row (`bg-secondary` = gray-900) and its 6%-white hover. |
| `tw:dark:[&_.cm-editor]:bg-primary_alt!` | Schema editors in the modal, at rest | CodeMirror's dark background is global LESS (`code-mirror.less`); no component prop exists. |

Contrast: none of these colour text, controls, focus or status feedback. The `border-primary` edge
reads about 1.3:1 against the gray-800 modal, up from about 1.05:1 for the old 8%-white edge. It is
a decorative boundary; the muted surface step itself separates the panel. Light mode is unchanged
apart from the frame's gray-200 `secondary` border.

## Consequences
A new settings-modal panel picks a variant instead of inventing a background. In light mode the
surfaces stay white; only the frame shifts from the 8%-black `subtle` to the gray-200 `secondary`
border. Revisit if the modal panel stops being the surface colour in dark mode, at which point
the default step would no longer blend in.

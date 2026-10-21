# A capped Autocomplete stays on one line, and +N opens a checkbox view of the selection

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** UI team
- **Guard:** `autocomplete.test.tsx` ("overflow chips" and "+N checkbox view edge cases")
- **Related:** ADR:2026-10-21-core-dropdown-menus-cap-their-own-height

## Context
`maxVisibleItems` drew that many chips and a `+N` badge for the rest. The badge was not
interactive, so the hidden values could not be seen, and in a narrow field the chips wrapped and
pushed `+N` onto a line of its own. When the row was kept on one line, the chips shrank unevenly,
and a short label collapsed to a single letter.

## Decision
- A field with `maxVisibleItems` keeps its chips, `+N` and the input on one line. Each chip
  truncates with a tooltip, never below about four characters, and labels of five characters or
  fewer do not shrink. `wrapSelectedItems` restores wrapping. The custom-property enum editor
  uses it, because its cap is 20.
- `+N` is a button. It opens the field's own list in a checkbox view: every selected value is a
  checked row, including selections missing from the loaded items. Clicking a row toggles it.
  The view keeps the rows it opened with, so an accidental uncheck can be undone. It reverts to
  the default list, with selected values left out, when the list closes.
- Opening the list any other way keeps the default list.
- `+N` is disabled when the field is disabled or read-only.

## Consequences
The default list is unchanged for every caller. The checkbox state is drawn by `AutocompleteItem`,
while react-aria's option `aria-selected` stays false. Moving the view onto react-aria's own
multiple selection would align them; revisit when ComboBox multiple selection is adopted. A capped
field whose cap does not fit on one line must set `wrapSelectedItems`.

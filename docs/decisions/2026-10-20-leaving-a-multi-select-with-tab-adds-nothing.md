# Leaving a multi-select with Tab adds nothing

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `playwright/browser-tests/multiSelectTab.spec.ts` (real browser), the Tab cases in
  `autocomplete.test.tsx` and `multi-select.test.tsx`
- **Related:** PR #34115, #20504

## Context
react-aria's combobox commits the option the list has focused when Tab leaves the input, the same
way Enter does. In a field that holds several values that adds a value nobody picked: ArrowDown
then Tab, or a pick followed by Tab, which focuses the next option. In advanced search that
changes what a filter means; in an alert's sources it also clears the chosen filters and triggers.
PR #34115 guarded it with a flag cleared in a microtask. A browser runs microtasks between React's
capture and bubble listeners, so the flag was already cleared when react-aria committed in the
bubble listener; jsdom does not, so its test passed while the bug stayed.

## Decision
- In the core `Autocomplete` with `multiple` and in `MultiSelect`, a Tab keydown, in the capture
  phase, clears the list's focused option (`forgetFocusedOptionOnTab`). react-aria's commit then
  finds nothing focused and adds nothing. Only a click or Enter adds a value.
- No guard depends on timing. A test that runs microtasks synchronously, and a real-browser test,
  keep it that way.
- A field that holds one value keeps react-aria's behaviour: Tab accepts the highlighted option.

## Consequences
Keyboard users leave a multi-value field without changing it. Someone who relied on Tab to add the
highlighted option, which only worked by accident, uses Enter instead. A new core component built
on the combobox that holds several values must bind the same handler.

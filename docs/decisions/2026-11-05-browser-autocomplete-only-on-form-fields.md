# Browser autocomplete stays on only for form fields; every other input sets autoComplete="off"

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer; `autocomplete="off"` assertions in `ExploreSearchInput.test.tsx`, `Searchbar.test.tsx`,
  `useListSearchInput.test.tsx`, core `filter-select.test.tsx` and core `page-header.test.tsx`
- **Related:** —

## Context
The browser's saved-entry dropdown opened over the AI-mode Explore search bar and covered the app's
own suggestion popover, so users saw two competing lists. Core `Input` is a react-aria `TextField`,
which gives every input a generated `id`, and browsers key saved entries on `id`/`name`. So any core
`Input` that does not opt out collects and replays history, including search boxes, filters, picker
searches and editor URL fields.

## Decision
Browser autocomplete (`autoComplete` left unset, or set to a token such as `email`,
`current-password`, `new-password`) is allowed only on **form fields whose value the user would
type again in another session**: sign-in, sign-up, profile and password fields.

Every other text input sets `autoComplete="off"`: search boxes, list filters, dropdown and picker
search fields, editor link/embed URL fields, inline cell editors, and any input that drives its own
suggestion popover.

Shared sources carry the opt-out so call sites inherit it: `Searchbar`, `useListSearchInput`'s
`searchInputProps`, and core `DropdownSearchField` and `PageHeader` search. react-aria `ComboBox`
and `Autocomplete` already render `autocomplete="off"`.

## Consequences
New search or filter inputs must add `autoComplete="off"` or reuse a shared source above. Core
`Input` does not default to `off`, because a global default would silently remove autofill from
form fields that do not set the prop, such as a sign-in email field. If an ESLint rule can tell a
search input from a form field (for example `icon={Search…}` or a `search` placeholder), it should
replace the reviewer guard.

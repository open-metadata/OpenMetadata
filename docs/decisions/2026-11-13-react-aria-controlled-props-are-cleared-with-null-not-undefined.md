# React Aria controlled props are cleared with null, not undefined

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** ESLint `openmetadata-ui-patterns/no-undefined-controlled-prop` (error)
- **Related:** #37771, #37772

## Context
React Aria components (and the core components built on them) decide per render whether a value is
controlled: a defined `selectedKey`, `selectedKeys`, `inputValue`, `isOpen`, `isSelected` or
`expandedKeys` is controlled, `undefined` is not. Code that falls back to `undefined` to mean "nothing
selected" (`value ?? undefined`, `cond ? x : undefined`) switches the component to uncontrolled at the
moment the value empties. Its internal state then disagrees with the parent's, each re-render corrects
the other, and React stops with "Maximum update depth exceeded". The async query builder select did
exactly this when its value was cleared with Cmd+Delete (#37771). Where it does not loop, the flip
leaves the component showing a stale selection after a reset.

## Decision
A controlled prop on a React Aria based component is cleared with its empty controlled value — `null`
for `selectedKey`, an empty collection for `selectedKeys` / `expandedKeys`, `''` for `inputValue`,
`false` for `isOpen` / `isSelected` — never `undefined`. A component that should be uncontrolled
passes nothing, from its first render to its last.

## Consequences
The lint rule catches a literal `undefined` fallback in a JSX prop. It cannot see a variable whose type
merely includes `undefined` (`useState<string>()` passed straight through); review those, and prefer
initialising such state to `null`. A component that deliberately flips — `CopyToClipboardButton`
forcing its tooltip open after a copy while leaving hover to React Aria — disables the rule on that
line with the reason beside it.

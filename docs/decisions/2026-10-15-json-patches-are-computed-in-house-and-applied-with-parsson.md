# JSON patches are computed by our own JsonDiff, never with move or copy, and applied with Parsson

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `JsonDiffTest` (diff rules, random edits, wide tables); Maven Enforcer `bannedDependencies` in the root `pom.xml`
- **Related:** #35524; `org.openmetadata.schema.utils.JsonDiff`, `ArrayAlignment`

## Context

The server computed patches with java-json-tools `json-patch`, whose `jackson-coreutils` 2.0 has
CVEs with no fixed release, and the SDK used zjsonpatch. No maintained library fits: the
java-json-tools forks keep `jackson-coreutils`, zjsonpatch's longest common subsequence takes
seconds on a 20,000-column table, Parsson's diff builds an m by n table, and Johnzon breaks on
shrinking arrays. Patches are also an authorization input: `JsonPatchUtils` maps each operation's
`path` to the permission it needs, and `move`/`copy` read a second path that check never sees.

## Decision

- One diff, `JsonDiff.of`, for the server and the SDK; one apply engine, Parsson, through
  `JsonUtils.applyPatch`. No other JSON Patch library is a dependency.
- A patch only uses `add`, `remove` and `replace`.
- Objects compare field by field. Arrays skip their shared start and end. In the rest, elements
  with a unique identity (a string, or the first of `id`, `fullyQualifiedName`, `tagFQN`, `name`
  that all elements carry with no repeats) are paired by identity through a longest increasing
  run, O(n log n); elements between pairs, and arrays without an identity, pair by position.
- The identity pairing is kept only when it has fewer operations than pairing by position, so a
  patch is never longer than the position-by-position one. It only changes the operations of an
  array whose elements shifted, where pairing by position already rewrites an identity field or
  adds or removes an element, so both patches need the same permission.

## Consequences

Diff time stays near linear for any input, and an insert, removal or move anywhere in a list costs
one or two operations instead of a rewrite of every later element. A moved element costs a remove
and an add where a `move` would be one operation; that is the price of keeping every path visible
to authorization. Arrays of objects without an identity keep pairing by position, because pairing
their whole values could turn a field edit into an element replacement that needs `EditAll`.
Revisit if the patch authorization starts reading `from` paths.

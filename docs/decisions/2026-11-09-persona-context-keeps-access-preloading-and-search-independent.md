# Persona context keeps access, preloading and search independent

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `PersonaContextBuilderTest`, `PersonaContextRuleValidationTest`, `PersonaAIContextIT`
- **Related:** [AI persona Context release feedback](https://app.notion.com/p/3d0b4572302480f182a5f2ea4ee3572b)

## Context

A preloaded Table rule added an unrestricted Table clause to the persona's search filter.
The shared context document also exposed selected assets to members denied access to them.
The AI Context Users column excluded people who inherited the persona through a team.

## Decision

Preloading and search rules operate independently. A persona may preload domain B while its
default searches select domain A. Preloaded asset types add no search clauses. Enabled search
rules still combine with OR, and knowledge types retain their existing search passthrough.

Persona membership permits use of the configured context; it does not grant asset access.
REST and MCP share the same materialization boundary. Member documents check the canonical
asset-context `ViewAll` permission and knowledge `ViewBasic` permission before rendering.
Caller-specific documents bypass the persona-wide cache. Admin and bot documents retain that
cache; member documents must never be stored in it.
Materialization version 2 participates in the definition hash so documents compiled under the old
scope-composition rules are rebuilt after upgrade. Invalid active scoped filters fail compilation
and report failed cache state, including filters stored before write-time validation existed.

Rule filters are validated by the configured search engine before a new or changed filter is
persisted, including search-scoped rules. Re-enabling a rule or its context validates active
filters. Unchanged filters are not revalidated when disabling a rule or changing unrelated
settings. Invalid input returns 400; unavailable search returns 503.
The visual editor preserves saved query DSL until the user edits the filter itself. A filter may
use server-supported fields that the builder cannot represent; opening it or disabling its rule
must not replace it with the builder's sanitized output.

The requested `Persona.userCount` is a derived, read-only count of distinct active users with
direct assignments, team inheritance or an effective default persona. Team inheritance excludes
bots, matching `UserRepository`. `Persona.users` continues to mean direct assignments only.

## Consequences

Member requests incur materialization and authorization work rather than reusing an admin's
document. Any future member cache must account for both identity and permission changes.
Counting inherited users does not change assignment forms or persist inherited assignments.

# Custom property values need ViewCustomFields

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Platform team
- **Guard:** `CustomPropertyValueAccessIT`
- **Related:** open-metadata/OpenMetadata#37845, ADR:2026-11-12-a-column-read-leaves-out-fields-the-caller-may-not-view,
  ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read

## Context

An entity's custom property values live in its `extension` field, which `EntityResource` maps to
`ViewBasic` like owners and tags. A caller whose policies deny `ViewCustomFields` on an asset could
still read the values through any read that returns `extension`, and through the change entries
(`extension`, `extension.<property>`) that every read carries in its change description. The UI asks
for `extension` on every entity page load.

## Decision

- Reads keep authorizing `extension` as `ViewBasic`, so a caller who may view the asset still gets
  it. The values, and the change entries that carry them, are left out for each entity whose
  `ViewCustomFields` the caller lacks, as a column read leaves out the fields its caller may not
  view.
- `EntityResource.hideCustomPropertyValues` decides it per entity on GET by id and by name, every
  listing, the versions of an entity and the entity history. `RowDecisionGate` skips the decision
  when no rule of the caller can refuse `ViewCustomFields`. Otherwise a GET decides on the context
  the read was authorized with, and a listing loads its rows once with their authorization fields
  and checks them together, as it does for the rows themselves.
- A version is decided as the entity is now, like the version itself.

## Consequences

- A denied caller keeps every entity page; the Custom Properties tab and its values are empty.
- A PUT from such a caller cannot remove the values it was not shown (a PUT never removes stored
  `extension`), and a PATCH built from the trimmed entity carries no `extension` operation.
- Not yet covered: write responses, glossary term listings with their own helpers, column-level
  values, search hits, CSV export, lineage hydrate, MCP and change events. Each needs the same
  per-entity decision on its own path.

# Custom property values need ViewCustomFields

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Platform team
- **Guard:** `CustomPropertyValueAccessIT`
- **Related:** open-metadata/OpenMetadata#37845, ADR:2026-11-12-a-column-read-leaves-out-fields-the-caller-may-not-view,
  ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read,
  ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view,
  ADR:2026-10-16-a-force-sync-merges-connector-supplied-custom-properties,
  ADR:2026-10-26-service-connection-visibility-follows-edit-permission

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
  view. A caller lacks it when a deny refuses it or when no allow grants it.
- `EntityResource` decides it per entity on GET by id and by name, every listing, the versions of
  an entity, the entity history, and the response of a PUT or PATCH. `RowDecisionGate` skips the
  decision when no rule of the caller can refuse `ViewCustomFields`. Otherwise a GET or a write
  decides on the context it was authorized with, before the entity is trimmed to the requested
  fields (the trim clears fields a rule reads, such as owners), and a listing loads its rows once
  with their authorization fields and checks them together.
- A version is decided as the entity is now, like the version itself.
- Values a caller was not shown are not visible to it, never cleared by it, as a hidden reference
  or a withheld service connection is. A PUT or a PATCH that writes the whole `extension` from such
  a caller is written over the stored values, so the properties it sends win and the others are
  kept, as for a connector's force sync; a PATCH that removes the whole `extension` is dropped. An
  operation on one property (`/extension/<property>`) runs as sent.

## Consequences

- A denied caller keeps every entity page; the Custom Properties tab and its values are empty.
- A custom role granting `ViewBasic` without `ViewCustomFields` no longer receives values; the
  seeded roles grant `ViewAll` and are unaffected.
- Such a caller can still set a property it may edit, but cannot remove values it was not shown
  except one property at a time.
- Not yet covered: bulk and CSV writes, glossary term listings with their own helpers, column-level
  values, search hits, CSV export, lineage hydrate, MCP and change events. Each needs the same
  per-entity decision on its own path.

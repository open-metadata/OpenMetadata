# Glossary terms declare their own properties and values

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `reviewer`
- **Related:** `docs/plans/2026-11-12-glossary-term-properties.md`,
  ADR:2026-10-17-glossaries-do-not-own-ontology-models, ADR:2026-11-03-input-parsing-is-bounded

## Context

Governance teams keep a property set per glossary term, and a nested term inherits some of its
parent's properties and adds its own. A customer also wants a different property set for each list
of terms, such as applications and business processes. Custom properties cannot hold this. A custom
property extends an entity type's schema, applies to every entity of that type, and keeps its values
in `entity_extension`. A term needs properties of its own instance, the way an ontology class has
properties that its subclasses get.

Three designs were dropped before this one.
- A separate `criticalDataElement` entity with its own asset mappings. It duplicated the glossary
  hierarchy, approval, labels and the Assets tab.
- A glossary type that switched term properties on. It added nothing the properties need.
- Glossary term custom properties scoped to glossaries and terms. It made a type-level schema
  extension behave per instance.

## Decision

- A glossary term declares at most 50 properties in `propertyDefinitions` and stores values in
  `propertyValues`, a map from property name to a list of lexical strings. Both live in the term's
  JSON. Only terms declare properties. Custom properties and `extension` do not change.
- A definition (`type/glossaryTermProperty.json`) has a `name` that follows `customPropertyName` and
  never changes, and a `datatype` of `string`, `integer`, `decimal`, `boolean`, `date`, `dateTime`,
  `enum` or `url`, which never changes. `displayName`, `description`, `enumValues`, `unit`, `multiValued` and `inheritable`
  are optional. `inheritable` defaults to true, so child terms get a property unless its definition
  turns inheritance off.
- `effectiveProperties` is computed on read and never stored. It lists the term's own definitions,
  then the inheritable definitions of its ancestors, nearest first. A value comes from the term's
  own entry, else from the nearest entry up to the declaring term. An empty list is an explicit
  absence that the terms below inherit.
- Within any term's effective properties, names are unique ignoring case and nothing is shadowed. A
  clash returns 409.
- Values are checked with Jena's XSD datatypes, and `enum` values against `enumValues`. A value
  holds at most 2,048 characters, a property at most 100 values, an enumeration 2 to 1,000 values,
  and a term at most 256 KiB of serialized definitions and values.
- Deleting a definition, or turning `inheritable` off, removes the values stored for it below the
  declaring term in the same transaction, soft-deleted terms included. Those terms get no new
  version and no change event. Declaring an inheritable property, or turning `inheritable` on,
  first removes stale entries for that name below the declaring term.
- A change to `datatype` returns 400. A change to `enumValues` or `multiValued` that would break a
  stored value returns 409,
  and so does a move that would leave a value without a property. Neither removes a value.
- Editing needs the new `EditGlossaryTermProperties` operation on the term, which `EditAll` and
  `All` include. No default role gains it, and admins grant it through policy rules. Removals below
  the declaring term need it on the declaring term only.
- A PUT follows the rule of `extension`. An omitted field keeps the stored value, a sent value
  replaces it, and a bot's PUT never removes stored definitions or values.
- In v1, search, RDF and CSV leave the fields out, and a GET returns them only when `fields` names
  them.

## Consequences

- Properties version, diff and go through approval with the term. No entity, table, relationship
  type or DDL is added.
- Deleting a property is immediate and final. The declaring term's version records it, and the
  terms below keep their version numbers. The UI confirms the deletion with the count of terms that
  lose a value.
- A server from an earlier release cannot load a term that stores the fields, so a rollback strips
  them first.
- A Data Steward edits term properties only after a policy grants `EditGlossaryTermProperties`, and
  a property cannot be renamed.
- Revisit keeping these on the term, instead of a separate entity, if a governed term needs what a
  glossary term cannot carry, such as control points or a quality rollup.

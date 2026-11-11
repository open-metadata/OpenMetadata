# Custom property names are unique per entity type ignoring case, enforced in the UI

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** UI team (2.1 release testing feedback)
- **Guard:** `AddCustomProperty.test.tsx` — "rejects a name already used on the entity type, ignoring case"
- **Related:** PR #36808

## Context
Release testing created `STRINGF37672B3` next to an existing `stringf37672b3` on Tables. The two
look identical in search, filters and the entity Custom Properties tab. Re-adding an exact
duplicate was worse: `PUT /metadata/types/{id}` treats an existing name as an update and silently
keeps the old definition, yet the form reported "created".

## Decision
The add-property form (classic drawer and AI settings panel, both through
`CustomPropertyFormFields`) rejects a name that matches an existing property of the same entity
type when compared case-insensitively. `TypeRepository.addCustomProperty` still compares names
case-sensitively, so the API, SDKs, ingestion and CSV import can still create case-variant names.

## Consequences
Users of the UI can no longer create look-alike properties, and an exact duplicate no longer shows
a false "created". The UI and the server follow different rules until `TypeRepository` compares
names ignoring case. That server change needs an integration test and a decision on existing
case-variant properties. Once it lands, this record is superseded.

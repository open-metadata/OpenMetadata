# Ontologies reuse each other through release-pinned imports, and a context is an import closure

- **Status:** Proposed
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Pending maintainer review
- **Guard:** reviewer
- **Related:** [domain-scoped and shared ontologies design](../plans/2026-11-12-domain-scoped-and-shared-ontologies-design.md),
  ADR:2026-10-14-ontology-releases-seal-canonical-sql-members,
  ADR:2026-10-15-fuseki-holds-only-the-active-ontology-release

## Context

Customers want domain-owned ontologies, one canonical concept shared across them, and a different
described meaning per department. Native ontologies are closed today: cross-ontology imports were
deferred, and an IRI is unique only within its ontology. Approval, versioning and activation already
run per ontology through sealed releases.

## Decision

- The ontology stays the unit of ownership, review and versioning. Domain scoping is a `domains`
  field on `Ontology`, inherited by its definitions. There is no domain ontology entity type and no
  per-concept domain.
- An ontology reuses another through an import that names an approved release and its version IRI.
  Imports never follow the active release. The import pins are sealed into each release's root
  member, so a sealed release always denotes the same closure.
- Imports form an acyclic graph and point to the same or a more foundational `layer`.
- A context (a domain, a department, a standard, a crosswalk) is an ontology together with its
  pinned import closure. Contextual meaning for an imported IRI is an `OVERLAY` concept row in the
  importing ontology, limited to annotations and owning its own bindings. A logically different
  meaning is a new subclass.
- A new release of an imported ontology reaches dependents only as an upgrade proposal reviewed in
  each dependent's own release.

## Consequences

An approved release keeps meaning exactly what its reviewers approved, even when a canonical
ontology moves on. Propagation costs one review per dependent per upgrade. Closure queries must
read pinned releases that Fuseki no longer holds from SQL members, which the native query path
already does. Release limits and reasoner limits apply to the whole closure.

# Native ontology imports use working drafts

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** NativeOntologyImportPreviewIT, IndependentOntologyWorkingDiffIT, OntologyReleaseProjectionTest
- **Related:** Ontology Studio publication and release contracts

## Context

An RDF file can contain only part of an ontology. Replacing an ontology or activating a release during import would silently discard definitions and bypass Studio review. A working diff must compare one consistent working revision with the active release while edits continue.

## Decision

`GET /v1/ontologies/{id}/working/diff` returns a bounded, revision-bound page of working changes. A cursor from another working or activation revision returns 412. `POST /v1/ontologies/{id}/imports/preview` accepts Turtle, RDF/XML, N-Triples, or JSON-LD and returns a regular `CreateOntologyChangeSet` request. The existing create, lease, apply, validate, capture, and activate paths remain authoritative. Import matches definitions by exact IRI and axioms by semantic content, consumes duplicate equivalent axioms by count, preserves catalog identity and metadata, leaves definitions absent from the file untouched, and refuses RDF that it cannot represent. A source ontology header supplies export scaffolding; it never replaces the chosen target ontology. Capture may require the activation revision observed during review.

The preview parser accepts at most 10 MiB of source, 100,000 RDF statements, 1,000 changed definitions, and 30 seconds of parsing. Native JSON-LD requires inline contexts; identifiers and context strings are limited to 2,048 bytes, and a conservative estimate based on raw nodes and the sum of context identifiers is capped at 64 MiB before expansion. Working snapshots are request scoped and bounded to 10,000 definitions and 64 MiB of serialized member data. These limits keep preview and capture within an interactive request and prevent untrusted input from becoming an unbounded in-memory job.

## Consequences

Import is reviewable and retryable through the existing draft workflow. Unsupported statements fail the whole preview instead of disappearing. Larger files require an explicit future bulk-import design with its own storage and execution model.

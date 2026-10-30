# Native ontology imports use working drafts

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial) · v2 2026-10-19 (native library preview) · v3 2026-10-19 (library installation and retry identity) · v4 2026-10-22 (durable library installation) · v5 2026-10-23 (complete visible catalogue) · v6 2026-10-22 (format detection, native CSV, dry-run counts, target-free preview, import into a new ontology) · v7 2026-10-23 (validate bundled installation plans)
- **Deciders:** OpenMetadata maintainers
- **Guard:** NativeOntologyImportPreviewIT, NativeOntologyImportIntoNewOntologyIT, IndependentOntologyWorkingDiffIT, OntologyReleaseProjectionTest, OntologyFormatDetectorTest, NativeOntologyCsvCodecTest, OntologyPackInstallationsTest, NativeOntologyPackInstallStateIT
- **Related:** Ontology Studio publication and release contracts

## Context

An RDF file can contain only part of an ontology. Replacing an ontology or activating a release during import would silently discard definitions and bypass Studio review. A working diff must compare one consistent working revision with the active release while edits continue.

## Decision

`GET /v1/ontologies/{id}/working/diff` returns a bounded, revision-bound page of working changes. A cursor from another working or activation revision returns 412. `POST /v1/ontologies/{id}/imports/preview` accepts Turtle, RDF/XML, N-Triples, or JSON-LD and returns a regular `CreateOntologyChangeSet` request. The existing create, lease, apply, validate, capture, and activate paths remain authoritative. Import matches definitions by exact IRI and axioms by semantic content, consumes duplicate equivalent axioms by count, preserves catalog identity and metadata, leaves definitions absent from the file untouched, and refuses RDF that it cannot represent. A source ontology header supplies export scaffolding; it never replaces the chosen target ontology. Capture may require the activation revision observed during review.

The preview parser accepts at most 10 MiB of source, 100,000 RDF statements, 1,000 changed definitions, and 30 seconds of parsing. Native JSON-LD requires inline contexts; identifiers and context strings are limited to 2,048 bytes, and a conservative estimate based on raw nodes and the sum of context identifiers is capped at 64 MiB before expansion. Working snapshots are request scoped and bounded to 10,000 definitions and 64 MiB of serialized member data. These limits keep preview and capture within an interactive request and prevent untrusted input from becoming an unbounded in-memory job.

## Consequences

Import is reviewable and retryable through the existing draft workflow. Unsupported statements fail the whole preview instead of disappearing. Larger files require an explicit future bulk-import design with its own storage and execution model.

## Amendment

Native library preview at `POST /v1/ontologies/{id}/library/{packId}/preview` accepts selected module IDs, verifies the existing catalog's licenses, dependencies and checksums, and feeds its content through the same native preview/apply path. It does not create glossary terms or activate a release. `NativeOntologyLibraryPreviewIT` guards this behavior.

Plain `skos:prefLabel` and `skos:definition` project onto native display names and descriptions. Canonical export uses `rdfs:label` and `rdfs:comment`; conflicting annotations fail preview. SKOS relation predicates retain their exact IRIs as object-property assertions. In particular, `skos:broader` is not an OWL subclass and does not confer property inheritance.

## Amendment

Library installation defaults to a new native ontology with a unique pack-prefixed name and `urn:openmetadata:ontology:<uuid>` identity. Its namespace appends a colon, its display name comes from the pack, and the current user owns it. An existing target requires explicit selection. Source concept IRIs remain unchanged.

One install action resolves the target, checks its edit permission, previews the selected modules, and applies the resulting working draft under its lease. The client freezes the target request and draft plan for retries. A lost target-create response is resolved by name and exact IRI. Every returned draft must match the frozen name, native owner, working revision, operations, and active undo cursor; an omitted preview cursor means all operations, matching server normalization. The client reads and validates the draft again under its acquired lease immediately before applying. Changed drafts cannot be applied or reported as this installation's completion. Draft lookup streams at most 100 pages of 100 records to bound recovery work. A failed, repeated, or incomplete cursor lookup cannot justify another create. Confirmed absence permits retrying the same unique identity. An unchanged already-applied draft completes without another apply. A no-op preview creates no draft.

Completion returns to the catalog. Installed state retains the actual target and module selection for the mounted library session, bounded by the verified catalog. Closing during a mutation is disabled. Closing after a settled error preserves server objects, and browser reload recovery is outside this session-scoped contract. `OntologyLibrary.native.test.tsx`, `useOntologyChangeSetApply.test.tsx`, and `OntologyNativeOperations.spec.ts` guard these transitions.

## Amendment

Installed state is durable on the target ontology. It replaces the mounted-session installed state of the previous amendment, so a reload and every other user see the same marks. Completion returns to the catalog, which reads installed state from the server again.

The library preview stamps `sourcePack` on the change-set request it returns: the pack ID, its catalog version, and the selected module IDs with their dependencies, in catalog order. Creating a change set accepts `sourcePack` only for a native scope and only when it matches the verified catalog, and the stamp cannot change afterwards. Applying a change set with `sourcePack` records an `ontologyPackInstallation` in the ontology's `installedPacks` in the same transaction as its operations. The write goes through the ontology's versioned updater, so the root version advances and a write that read the ontology before the install fails with 412 instead of dropping the record. The server stamps the module checksums, license, and source from the catalog, and the time and user from the apply. An apply whose `sourcePack` version the catalog no longer serves returns 412 before any operation runs. A failed or rolled-back apply records nothing. A no-op preview creates no draft, so it records nothing either.

The ontology keeps one entry per pack ID. A later install of the same version adds its modules to the entry. An install of another version replaces it. Clients cannot write `installedPacks`: create starts it empty, PUT keeps the stored value, and a PATCH that changes it returns 400. `sourcePack` is provenance that the client carries from the preview. The record states what an editor of that ontology installed. It does not prove that the ontology's definitions still match the pack.

`GET /v1/ontologyPacks` lists, for each pack, the non-deleted ontologies with an entry that the caller may view under the same check as `GET /v1/ontologies/{id}`. One catalog read considers at most 1,000 such ontologies, which keeps it an interactive request. `GET /v1/ontologyPacks/{packId}/sample` returns at most 60 concepts, starting from the top of the hierarchy, and the relations among them, from the selected verified modules and with no target ontology. Packs carry an `industry` for the catalog filter and the `layer` at which the client creates a new target. `NativeOntologyPackInstallStateIT` and `NativeOntologyLibraryPreviewIT` guard this behavior.

## Amendment

The catalogue's total 1,000-ontology cap in the durable-installation amendment is replaced by keyset pages of at most 1,000 raw installed ontologies. Each page batch-loads the fields used by authorization, and the scan advances by its final raw ID even when the caller cannot view any row on that page. The response contains every visible installation; a hidden or later row cannot make a pack appear uninstalled. Response size and scan time grow with installations. If that cost becomes too large for an interactive request, the API and client need explicit pagination rather than a silent total cap.

## Amendment

Import accepts a fifth format, the native CSV defined in `docs/native-ontology-csv.md`, and `format` becomes optional on `PreviewNativeOntologyImport`. When omitted, `OntologyFormatDetector` decides from the first 65,536 characters: content signatures first (JSON-LD, RDF/XML, the native CSV header, N-Triples, Turtle), the file extension only when the content has none. A detected N-Triples source parses with the Turtle grammar, because detection sees a window and every N-Triples file is valid Turtle. `POST /v1/ontologies/imports/detect` exposes the same detector, so the browser never re-encodes its rules.

`POST /v1/ontologies/{id}/imports/preview` now returns `{summary, changeSet}`. The summary names the format the server parsed with and counts, from the same classification that produces the operations, new and updated concepts and properties, new relations (axioms), new mappings, skipped definitions identical to the stored ones, and skipped relations. `POST /v1/ontologies/imports/preview` classifies against an empty target, requires `Create` on ontologies, and returns the summary without a change set. Neither writes. CSV rows count toward the 1,000 changed-definition limit, parsing is strict, and the first malformed row fails the whole preview with its row and column.

Import into a new ontology has no endpoint. The client uses the library installation flow above: create the target with a unique name from the file's label and a `urn:openmetadata:ontology:<uuid>` identity, preview against it, then apply the change set under its lease with the same retry identity. Source definition IRIs stay unchanged. `NativeOntologyImportIntoNewOntologyIT` guards the create, preview, apply, and lost-create-response paths.

## Amendment

Applying a stamped library draft recomputes the selected bundled import against the locked working revision before any definition or installation write. The complete, nonempty active plan must match that import. Comparison ignores only independently generated operation IDs and new definition IDs. Target IDs, base versions, payloads, attribution, operation multiplicity, and ordered property chains remain significant. Empty, altered, or partially undone stamped plans return 412. Restoring the unchanged full plan restores eligibility. Ordinary unstamped drafts retain their existing behavior.

Preparation runs within the bounded snapshot read. Application runs after that read returns, under the same outer transaction and ontology lock, so definition writes do not consume the snapshot's read deadline. Valid partial reinstalls retain the existing same-version module union. No-op previews still create no draft, and an already applied draft remains a client recovery read rather than another application.

# The Ontology Studio UI ships only in Collate; OSS keeps the ontology APIs and shared pieces

- **Status:** Accepted
- **Revisions:** v1 2026-11-15 (initial) · v2 2026-11-16 (OpenMetadata serves the read-only Ontology Explorer again) · v3 2026-11-16 (the empty Ontology RDF Playwright project is removed) · v4 2026-11-16 (Studio-only code the shared explorer and task screens carried moves too)
- **Deciders:** Product, UI team
- **Guard:** reviewer
- **Supersedes:** ADR:2026-10-19-ontology-studio-opens-native-models-by-default (for OpenMetadata; the rule now governs Collate's route)
- **Related:** ADR:2026-10-30-studio-created-ontologies-take-onto-iris; the Studio records amended on 2026-11-15 now govern Collate code

## Context

Ontology Studio, the authoring workspace at `/governance/ontology` (library, concept and property
editors, releases and review, data bindings, query console), was built in this repository. Product
decided the Studio is a Collate feature. The backend it runs on (schemas, `/v1/ontologies*`, RDF and
SPARQL, release and review tasks) stays open source, as does the ontology graph that the Glossary and
Glossary Term pages embed.

## Decision

- The Studio page and the components, hooks and utilities only it reaches move to the Collate UI,
  with their Jest tests and their Playwright specs (including every `@ontology-rdf` spec and
  `ontology-rdf.setup.ts`). Collate registers the route, the Govern sidebar item and the Classic
  tour step itself.
- OSS keeps everything another OSS surface imports: `OntologyExplorer` and its graph (the Glossary
  "Relations graph" tab), `ExportGraphPanel` (Knowledge Graph), `OntologyReviewPanel` (task
  detail), the common, task and comment components, `rest/ontologyAPI.ts`, generated types,
  i18n keys, `ROUTES.ONTOLOGY_EXPLORER` and the Playwright helpers the Glossary specs share
  (`utils/ontologyStudio.ts`, `OntologyStudioDataClass`). Collate imports these from the mirror.
- Which files moved was decided by the import graph: a file moves only if the Studio page reaches it
  and no remaining OSS module does. A file nothing imports stays.
- OSS no longer routes `/governance/ontology`. The read-only Ontology Explorer returns to that route
  in a follow-up; until then the "View all" button in the Glossary graph and the table page's linked
  concepts point at a route OSS does not serve.

## Consequences

- A change to the Studio is a Collate PR. A change to a shared piece listed above is an OSS PR that
  Collate picks up through the submodule, so it must not break the Collate imports.
- Collate CI builds against OSS `main`, so the Collate copy lands before OSS deletes its own.
- The OSS `Ontology RDF` Playwright project stays, empty, until the `rdf` lane in
  `playwright-e2e-reusable.yml` stops listing it; `Knowledge Graph` keeps that lane.

## Amendment

v2 (2026-11-16): OpenMetadata serves the read-only **Ontology Explorer** at `/governance/ontology`
again (`pages/governance/ontology/OntologyExplorerPage`): the existing `OntologyExplorer` at
`scope="global"`, with no authoring, under Govern in both modes. Collate's route, sidebar item and
AI-mode Govern module replace it with Ontology Studio. The "View all" and linked-concept links no
longer point at an unserved route.

v3 (2026-11-16): the empty `Ontology RDF` and `ontology-rdf-setup` Playwright projects are removed,
with the `rdf` lane's `--project="Ontology RDF"` and its `Ontology*Rdf.spec.ts` path filter. No
OpenMetadata spec is tagged `@ontology-rdf` and `Knowledge Graph` never depended on the setup; the
`rdf` lane runs `Knowledge Graph` alone.

v4 (2026-11-16): a file stays in OpenMetadata only if an OpenMetadata surface uses it. Code that
only the Studio uses moves to Collate even when a shared component reached it:

- `OntologyExplorer` is read-only. Its authoring props (`isAuthoringMode`, `isEditMode`,
  `surface`, `showHealth`, concept drafts, AI proposals) and the panels only they show (draft
  inspector, term editor, tree views, health panel, delete impact) moved into Collate's
  `OntologyStudioCanvas`, a copy of the authoring explorer. Everything the Ontology Explorer shows
  stays here, including the concept inspector it opens read-only (`OntologyAuthoringInspector`, its
  data assets, picker, IRI and draft-guard helpers), the graph, `OntologyRelationDetailsPanel`,
  `OntologyNodeRelationsContent` and `useOntologyExplorer`; the canvas imports them, and their edit
  paths run only there.
- `OntologyReviewPanel` and the release and publication helpers behind it moved to Collate. `OntologyExplorerClassBase` now has only `getReviewPanel()`; it returns `null` in
  OpenMetadata, where an ontology review task shows the generic task view and Approve and Reject
  do not wait for a panel. `getAiProposalsHook()` and `getConceptLiveDataExtension()` are removed:
  the canvas that called them lives in Collate.
- The bulk-authoring components nothing imported are deleted.
- `OntologyStudio.utils` and `OntologyStudio.constants` moved; the explorer keeps the term label
  and health count in `OntologyExplorer/utils/ontologyHealth.ts`.
- Translation keys stay in OpenMetadata's locale files, which Collate loads.

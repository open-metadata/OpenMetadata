# Domain-scoped ontologies, shared concepts, validation and lifecycle

**Status:** Proposed design for review. Nothing here is implemented.
**Date:** 2026-11-12. **Baseline:** `2e5b050e944`.
**Builds on:** [organizational ontology design](2026-10-14-organizational-ontology-design.md),
[Fuseki native reasoning](2026-10-07-fuseki-native-reasoning.md),
ADR:2026-10-19-native-concept-bindings-remain-operational-metadata,
ADR:2026-10-23-native-ontology-release-validation-binds-captured-targets.
**Decision record:** ADR:2026-11-12-ontologies-reuse-each-other-through-release-pinned-imports.

## Why

A customer review of Ontology Studio (healthcare: HL7, FHIR, clinical records) asked five groups of
questions. They want domain-owned ontologies with their own approvals and versions, one canonical
concept with a different meaning per department, deep OWL axiom authoring tied to technical assets
in bulk, consistency checking and crosswalk validation, and version diff, deprecation and branching.

This document answers each question against the code as it is, then proposes one design that closes
the gaps. The central idea is small. **The ontology stays the unit of ownership, review and
versioning.** A domain owns ontologies. Ontologies reuse each other through imports pinned to
approved releases. A context (a department, a domain, a standard) is an ontology plus its import
closure. Shared concepts, contextual meaning, crosswalks and reasoning scope all follow from that.

## Answers at a glance

| Question | Today (baseline) | Proposed |
|---|---|---|
| Can a concept belong to a domain? | No. `Ontology` has no `domains` field; concepts have none either | Yes, through its ontology. An ontology carries `domains`; its concepts inherit it. Projected as an annotation, so OWL semantics are untouched (D1) |
| Is a domain ontology first-class, with its own approvals, versions and lifecycle? | Approvals, semantic versions, activation and rollback already run per ontology. A `layer` (L1/L2/L3) exists. Nothing ties an ontology to a governance domain | Domain assignment plus domain-scoped policies turn every ontology into a domain ontology. No new entity type (D1) |
| Does changing a shared concept propagate? | No. Each ontology is closed; native cross-ontology imports are deferred | A domain ontology imports the canonical one at a pinned release. A new canonical release produces an upgrade proposal in each dependent, reviewed through the dependent's own release (D2, D4) |
| Contextual meaning ("clinical record means X to marketing, Y to finance") | Not representable without copying the concept | A context overlay: the domain ontology annotates the canonical IRI (definition, labels, synonyms, asset bindings) without minting a new IRI. A logically different meaning becomes a subclass (D3) |
| How deep is axiom and datatype-property authoring? | Most of OWL 2 DL class and property axioms, see the coverage table | Close the listed gaps: complement, datatype facets, keys, disjoint union, equivalent properties, individual identity (D5) |
| Associate concepts with technical assets in bulk | One asset or column at a time through the bindings API and Studio; caps of 100 assets and 500 assignments per concept | Bindings CSV, rule-based binding proposals, and axiom-derived data-quality checks on bound columns (D6) |
| Consistency checks on publish | Structure, OWL 2 DL profile and SHACL run on every release. `logicalCheck` is always `NOT_RUN` | The reasoner `CHECK` job runs on capture over the import closure. A per-ontology gate can block approval (D7) |
| Crosswalk validation (HL7 to FHIR) | `conceptMappings` (SKOS match types) on a concept, checked only for IRI shape | Crosswalks live in an alignment ontology that imports both sides, gets reviewed and versioned, and is validated structurally, by SKOS integrity rules and by the reasoner (D8) |
| Reasoner (Pellet, HermiT, ELK) | Planned in the Fuseki image: HermiT for OWL 2 DL, ELK for EL. Pellet and Openllet are AGPL and excluded | Unchanged engine choice; this design consumes `CHECK` and `EXPLAIN` (D7) |
| Side-by-side version diff | API compares any two sealed releases of one ontology (`GET /v1/ontologyReleases/{id}/diff?baseReleaseId=`). Studio only compares against the captured base | Studio picker for any two releases, plus a working-copy-to-release diff (D9) |
| Deprecation with successor | Yes: `deprecated` and `replacedBy` on concepts and properties, same ontology only | Allow a successor in an imported ontology; offer to re-point bindings on activation (D9) |
| Branch and merge | One working copy per ontology. Change sets already act as reviewable proposals | Promote change sets to named proposals with three-way rebase and per-definition conflicts. No full-model branches (D9) |

## What exists today

The [organizational ontology design](2026-10-14-organizational-ontology-design.md) and its records
define the model this document extends.

- **Entities.** `ontology`, `ontologyConcept`, `ontologyProperty`, `ontologyAxiom` and
  `ontologyRelease` have their own tables. An IRI is unique per ontology (`(ontologyId, iriHash)`),
  not globally. `ontology_reference` indexes every IRI a definition uses.
- **Lifecycle unit.** The release. Capture seals canonical members; one `RequestApproval` task
  reviews the whole release; activation and rollback move a pointer; Fuseki holds each ontology's
  active release in `graph/ontology/{id}`. Releases carry semantic versions and notes.
- **Proposals.** `ontologyChangeSet` holds typed operations against a `baseWorkingRevision`, with a
  lease, a review task and atomic application. Imports, library packs and AI suggestions all
  arrive as change sets.
- **Validation.** Capture runs structure checks and the release-scoped `OwlProfileGuard`.
  `GET /v1/ontologyReleases/{id}/validation` adds native SHACL findings and the impact of newly
  deprecated definitions. `logicalCheck` has one value, `NOT_RUN`.
- **Assets.** Concept bindings are operational rows outside the release: up to 100 assets and 500
  property-to-column assignments per concept. SQL generation from bindings exists; live data
  execution is a Collate extension.
- **Roles.** `OntologyAuthor` and `OntologyReviewer` are seeded. Domain policies (`hasDomain`,
  domain-only access) exist platform-wide but cannot apply, because ontologies have no domain.

## D1. Domain-scoped ontologies

**Add `domains` to `Ontology`.** It uses the standard `EntityInterface` domain field, as `glossary`
and `glossaryTerm` do. Concepts, properties, axioms and releases inherit it from their ontology and
cannot set their own. The existing `hasDomain()` rule and the domain-only access filter then apply to
ontology resources with no new policy code. A drug-domain steward can author the Drug ontology and
cannot touch the Medical one.

**A concept's domain is its ontology's domain.** The customer example (pharmacist in the drug
domain, doctor in the medical domain) becomes two domain ontologies, each importing a shared core
that declares `HealthcareProfessional`:

```
core:HealthcareProfessional          (Enterprise Core, layer L1, domain: none)
  drug:Pharmacist  ⊑ core:HealthcareProfessional   (Drug ontology, L2, domain: Drug)
  med:Physician    ⊑ core:HealthcareProfessional   (Medical ontology, L2, domain: Medical)
```

We reject a per-concept `domains` field. It would give a concept two owners (the ontology's
reviewers and the domain's), split one release across several approval authorities, and let a
release contain definitions its reviewers may not govern.

**The OWL answer for the team.** OWL 2 has no notion of a class belonging to a governance domain,
and nothing in OWL forbids recording one. Annotation assertions carry no logical semantics in
OWL 2 DL, so `om:governanceDomain` on the ontology header (and, derived, on each class) changes no
entailment and passes every profile check. The constraint people half-remember is a naming clash.
`rdfs:domain` is about properties: `rdfs:domain Patient` on `hasMRN` means anything with an MRN
**is inferred to be** a Patient. Studio must label the governance field "Data domain" and the
property field "Applies to (rdfs:domain)" so the two never read as the same thing.

**Layers become enforced.** `layer` exists but nothing checks it. With imports (D2), an ontology may
import only ontologies of the same or a more foundational layer (L1 is the most foundational). This
keeps the enterprise core free of dependencies on departmental models.

Per-domain approvals, versioning and lifecycle need no new machinery, because each runs per ontology
already. A "DomainOntology" type would duplicate `Ontology` with one extra field.

## D2. Imports pinned to approved releases

This is the primitive that native cross-ontology imports (deferred in the October design) were
waiting for.

```json
"imports": [
  { "ontology": {"id": "…", "type": "ontology"},
    "releaseId": "…",
    "versionIri": "https://open-metadata.org/onto/core/1.4.0" }
]
```

- **Pinned.** An import names an approved release, never "whatever is active". It projects as
  `owl:imports <versionIri>`. Every release of the importer seals the import pins as part of its
  root member, so a sealed release always means the same closure.
- **Governed.** Adding, removing or raising an import is a working edit to the root. It enters the
  next release and its review like any other change.
- **Checked.** The import graph must be acyclic and respect layers. A working definition may
  reference an IRI declared in the closure of its pinned imports; capture fails when a referenced
  IRI is undeclared there, as it fails today for undeclared local IRIs. The closure is bounded by the
  reasoning limit `maxImports` and by the existing 50,000-member release cap applied to the sum of
  members across the closure.
- **Projection.** Unchanged in shape. Each ontology's active release stays in its own named graph.
  A context query (`POST /v1/ontologies/{id}/query?scope=closure`) runs over the union of the
  ontology's graph and the graphs of its pinned releases. Fuseki holds only active releases, so a
  pin older than the imported ontology's active release is served from SQL by the existing native
  query path that already builds the asserted model from sealed members.
- **Permissions.** Reading an importer's closure requires view access to every imported release,
  checked per member as the native query path does now.

**Rejected: follow the active release.** A floating import would let the core team change the
meaning of an approved Finance release without Finance's review. That breaks the guarantee that an
approved release is what its reviewers approved. Pinning plus upgrade proposals (D4) gives
propagation without that loss.

## D3. Shared concepts and contextual overlays

The canonical concept lives in one ontology: `core:ClinicalRecord` in the enterprise core. Other
ontologies use it through imports. There are two ways to contextualize it, and the rule for
choosing is whether the meaning differs logically.

**Overlay: same thing, described differently.** Finance and Marketing both mean the same record but
describe it, name it and bind it differently. Each adds an overlay in its own ontology:

```json
{ "kind": "OVERLAY", "iri": "https://…/core#ClinicalRecord",
  "displayName": "Billable encounter record",
  "description": "In Finance, the record that supports a claim…",
  "synonyms": ["claim record"], "conceptMappings": [] }
```

An overlay is an `ontologyConcept` row whose IRI belongs to an imported ontology. The existing
`(ontologyId, iriHash)` uniqueness already allows the same IRI in two ontologies. A new field
`definitionKind: DECLARATION | OVERLAY` (default `DECLARATION`) distinguishes them. An overlay:

- may carry only annotation content: labels, description, synonyms, concept mappings, definition
  source. It cannot carry `conceptType`, `abstract`, or deprecation, because those belong to the
  owner of the IRI;
- has its own UUID, so it has its own asset bindings. Finance's clinical record binds to
  `finance.claims.encounter`; Clinical Ops binds the canonical concept to `ehr.encounter`;
- projects as annotation triples in the overlay ontology's graph (`skos:prefLabel`,
  `skos:definition`, `skos:altLabel`), plus `om:overlays <ontologyIri>`. Querying Finance's closure
  sees the core declaration plus Finance's annotations. Querying the whole store sees every
  context's annotations, each in its own named graph, which is the disambiguation the customer
  described: one IRI, many described senses, each attributed to its context;
- is reviewed and versioned by the overlaying ontology, not by the core.

**Specialization: a different thing.** If Finance's clinical record has different identity or
constraints (only billable encounters, exactly one claim), it is a different class:
`fin:BillableClinicalRecord ⊑ core:ClinicalRecord` plus its restrictions. This is plain OWL that
D2 already supports. Studio offers "Specialize" next to "Overlay" and explains the difference.

**Extension axioms.** An importing ontology may state a logical axiom about an imported IRI, for
example `core:ClinicalRecord ⊑ ∃fin:hasCostCenter.fin:CostCenter`. OWL allows this, and it holds
only inside the importer's closure. We allow it, label it in Studio as "adds a rule to a shared
concept in this context", and list it in the import's impact report so the core team can see who
extends their concept.

**Why not a separate overlay entity.** An `ontologyConcept` row already has the identity, history,
bindings, release membership, CSV and change-set operations an overlay needs. A new entity would
duplicate each of those paths. The cost is a field and a validation rule on which fields an overlay
may set.

## D4. Propagating a canonical change

When the core activates a new release:

1. A listener computes, for every ontology that imports any earlier core release, an **upstream
   impact report** from the existing release diff: definitions it references that changed, were
   removed or were deprecated (with their successors), and overlays or extension axioms that sit on
   those IRIs.
2. It creates one native change set per dependent, `UPDATE_IMPORT` from the old pin to the new one,
   with the report attached. It notifies the dependent's owners through the existing activity feed.
   A dependent with an open upgrade proposal for the same import gets that proposal replaced, so
   repeated core releases do not pile up.
3. The dependent's authors apply the proposal like any change set, fix what broke, capture and
   review. Their release review shows the import change and its impact.

Nothing changes in a dependent until its own reviewers approve. Bulk propagation (a core team
upgrading 20 dependents) stays a sequence of owned decisions; the owners can approve quickly when
the report is empty.

## D5. OWL coverage and the axiom authoring gaps

What the native model represents today, checked against the schemas and `OwlProfileGuard`:

| OWL 2 DL construct | Native today | Proposed |
|---|---|---|
| Class, object, data and annotation property declarations | Yes | |
| `rdfs:domain`, `rdfs:range` (classes and datatypes) | Yes | |
| Property characteristics (functional, inverse functional, transitive, symmetric, asymmetric, reflexive, irreflexive) | Yes | |
| Inverse, property chains, disjoint properties, sub-properties | Yes | |
| Equivalent properties | No | Add `equivalentProperties` field, same pattern as `superProperties` |
| `SubClassOf`, `EquivalentClasses`, `DisjointClasses` | Yes, with recursive expressions | |
| `DisjointUnion` | No | Add axiom type |
| Intersection, union, enumeration (`oneOf`) | Yes | |
| Complement (`ObjectComplementOf`) | No | Add expression kind `COMPLEMENT` |
| Existential, universal, has-value, min/max/exact cardinality, qualified by a filler | Yes | |
| `ObjectHasSelf` | No | Add restriction kind `SELF` |
| Data ranges: named datatypes, their intersection/union, data enumerations | Yes | |
| Datatype facets (`xsd:minInclusive`, `xsd:pattern`, `xsd:maxLength`) | No, deliberately unavailable in the editor | Add `DATATYPE_RESTRICTION` with the OWL 2 facet list |
| `HasKey` | No. `isIdentifier` is an annotation and deliberately asserts no key | Add axiom type; Studio offers it next to `isIdentifier` with an explanation |
| Class and property assertions on individuals | Yes | |
| `SameIndividual`, `DifferentIndividuals`, negative property assertions | No | Add axiom types |
| SKOS concepts, schemes and match mappings | Yes, kept separate from OWL equivalence | |
| SWRL rules | No | Out of scope. Not OWL 2 DL, and HermiT supports only DL-safe rules |

Each addition follows the existing path: schema enum or field, `OwlProfileGuard` rule, RDF
projection, CSV column or cell syntax, release diff, expression editor, and an OWLAPI round-trip test.
The answer to "full OWL feature surface or a subset" is therefore: a large subset today, all of
OWL 2 DL except SWRL after D5.

## D6. Assets in bulk, and axioms that validate data

The customer's real need behind "author axioms so something can be validated" is that a concept's
rules reach the data its assets hold.

**Bindings CSV.** Import and export of concept bindings, one row per binding:

```
conceptIri,assetType,assetFqn,columnPath,propertyIri,context
https://…/core#ClinicalRecord,table,ehr.prod.clinical.encounter,,,
https://…/core#ClinicalRecord,table,ehr.prod.clinical.encounter,encounter_id,https://…/core#recordId,
```

`context` names an overlaying ontology when the binding belongs to an overlay. Import authorizes each
row as the bindings API does today (concept `EditAll`, target `ViewBasic`), reports per-row results,
and is idempotent. The per-concept caps rise to values measured against the binding scan, recorded
in an amendment to ADR:2026-10-19-native-concept-bindings-remain-operational-metadata.

**Binding rules.** A binding rule on a concept selects candidate assets by a search query (service,
schema, tag, glossary term, column name pattern). Running a rule produces a binding proposal the
concept's editors accept or reject in bulk. Rules propose; they never bind silently, because a
wrong binding misleads every downstream consumer.

**Axiom-derived checks.** For a data property bound to a column, the ontology already says what
valid data looks like. Compile it into data-quality test case suggestions on that column:

| Ontology statement | Suggested test |
|---|---|
| Range `xsd:integer`, `xsd:dateTime`, … | Column type compatibility (static check, no test run) |
| Data enumeration (`enumValues`) | `columnValuesToBeInSet` |
| Datatype facet `minInclusive`/`maxInclusive` | `columnValuesToBeBetween` |
| Facet `pattern` | `columnValuesToMatchRegex` |
| `min 1` or `exact 1` on the property for the bound class | `columnValuesToBeNotNull` |
| `HasKey` or functional plus inverse functional | `columnValuesToBeUnique` |

Suggestions go through the existing test case creation and carry a link to the axiom that produced
them. When the ontology's active release changes, suggestions whose source axiom changed are marked
stale. This turns ontology authoring into enforceable checks without inventing a second validation
engine.

## D7. Consistency checking on publish

The reasoner plan already provides the engine: a `CHECK` job in a worker JVM of the Fuseki image,
HermiT for OWL 2 DL and ELK for ontologies in the EL profile, with mandatory limits and `EXPLAIN`
for justifications. This design consumes it.

- **When.** Capture submits a `CHECK` job for the release's full import closure. The job reads
  sealed members, so the result is bound to the release digest and never goes stale.
- **Result.** `logicalCheck` grows from `NOT_RUN` to `PENDING`, `CONSISTENT`, `INCOHERENT` (the
  ontology is consistent but named classes are unsatisfiable), `INCONSISTENT`, `INCOMPLETE` (a
  limit was hit; the reason is recorded) and `NOT_AVAILABLE` (the store reports `CHECK` as
  `NOT_IMPLEMENTED` or not ready). The validation report lists unsatisfiable classes and, on
  request, their `EXPLAIN` justifications.
- **Gate.** A per-ontology setting `logicalCheckGate: OFF | WARN | BLOCK` (default `WARN`). `BLOCK`
  refuses approval votes unless the result is `CONSISTENT`. `INCOMPLETE` and `NOT_AVAILABLE` never
  pass a `BLOCK` gate: a check that did not finish proves nothing.
- **Reasoner choice.** No user-facing choice of engine. The worker picks ELK when the closure is in
  OWL 2 EL and HermiT otherwise, and reports which ran. Pellet and Openllet are excluded on license
  (AGPL); see the reasoning plan's engine section.

## D8. Crosswalks as alignment ontologies

A crosswalk between two standards (HL7 `clinical_record` to FHIR `Encounter`) is itself governed
knowledge with owners, reviews and versions. It is an ontology with `purpose: ALIGNMENT` that imports
both sides at pinned releases and contains only mapping statements:

- SKOS mappings, stored as `conceptMappings` on overlays of the source IRIs. This reuses D3 and
  keeps SKOS matches distinct from OWL equivalence, as the existing editor rules require;
- OWL bridge axioms (`EquivalentClasses`, `SubClassOf`, `EquivalentProperties`) when the team means
  a logical claim.

Validation runs at three levels, all on the alignment's release:

1. **Structural.** Every mapped IRI is declared in the pinned closure and is not deprecated. A
   deprecated target reports its successor.
2. **SKOS integrity.** Rules from the SKOS reference: `exactMatch` and `broadMatch`/`narrowMatch`
   between the same pair conflict; `exactMatch` is transitive, so a chain that maps two distinct
   concepts of one scheme together is an error; one-to-many `exactMatch` is a warning. These run as
   SHACL shapes in the existing release validation.
3. **Logical.** For bridge axioms only, the `CHECK` job runs over the alignment's closure. A class
   that is satisfiable in each source alone but unsatisfiable with the bridge points to a wrong
   mapping; `EXPLAIN` names the axioms involved. A typical case: FHIR declares `Encounter` disjoint
   with `EpisodeOfCare` while HL7 maps both to one record class.

Concept mappings to unmanaged external IRIs (a public vocabulary not installed in the catalog) stay
on the concept as today and get only structural checks.

## D9. Version diff, deprecation and proposals

**Diff.** The API already compares any two sealed releases of one ontology. Add the Studio picker
for any pair, a grouped side-by-side view per definition, and a working-copy-to-release diff that
reuses `GET /v1/ontologies/{id}/working/diff`. Comparing across ontologies (Core vs. a fork) is out
of scope; there is no shared member identity to align.

**Deprecation.** Keep `deprecated` and `replacedBy`. Allow `replacedBy` to name an IRI in the
import closure, so a domain concept can be retired in favor of a core one. On activation of a
release that deprecates a bound concept, the impact report (already computed for newly deprecated
definitions) gains an action: re-point its bindings to the successor in one confirmed operation.
D4 carries deprecations to dependents.

**Branch and merge.** The working copy plus change sets already form trunk-and-proposal
development. A full-model branch would need a second working state, branch-aware references,
leases and a model merge, for a workflow change sets already cover. Instead:

- Name a change set a **proposal**. It can be submitted for review before application, which
  already exists for suggesters.
- When the working revision has moved since the proposal's `baseWorkingRevision`, applying it runs a
  **three-way rebase** per definition: base (the definition at the base revision), ours (current
  working), theirs (the operation). Non-overlapping field changes merge. The same field changed both
  ways is a conflict the author resolves in the proposal before it applies. Today a stale base
  simply fails.
- Large proposals can be captured into a **preview release** (not activatable, excluded from version
  allocation) so reviewers see a real release diff and validation report, including the logical
  check, before the proposal touches the working copy.

## Data shape changes

| Schema | Change |
|---|---|
| `entity/data/ontology.json` | `domains` (standard); `imports` (array of `{ontology, releaseId, versionIri}`); `purpose: DOMAIN \| ALIGNMENT` (default `DOMAIN`); `logicalCheckGate` |
| `entity/data/ontologyConcept.json` | `definitionKind: DECLARATION \| OVERLAY` |
| `entity/data/ontologyProperty.json` | `equivalentProperties` |
| `entity/data/ontologyAxiom.json` | Axiom types `DISJOINT_UNION`, `HAS_KEY`, `SAME_INDIVIDUAL`, `DIFFERENT_INDIVIDUALS`, `NEGATIVE_OBJECT_PROPERTY_ASSERTION`, `NEGATIVE_DATA_PROPERTY_ASSERTION` |
| `type/ontologyExpression.json` | Kind `COMPLEMENT`, `DATATYPE_RESTRICTION` with `facets`; restriction kind `SELF` |
| `entity/data/ontologyRelease.json` | `logicalCheck` values per D7; `preview` flag; sealed import pins are part of the root member |
| `entity/data/ontologyChangeSet.json` | Operation `UPDATE_IMPORT`; optional `upstreamImpact` |
| New `type/ontologyBindingRule.json` | Search-based candidate selection for D6 |

All DDL stays in native 2.1.0 while it is unreleased (see the October design for the migration
runner constraint); once 2.1.0 ships, a new version directory. `imports` is JSON in the entity;
the reference index gains role `IMPORT` so reverse lookups (who imports me) are indexed.

## Delivery order

Each step ends in a state that is useful and testable on its own.

1. **Domains on ontologies** (D1). Field, inheritance, policy coverage, Studio label fix. Smallest
   change, answers the first question, unblocks domain-only access.
2. **Imports and closure** (D2). Pins, layer and cycle checks, closure-aware capture, closure query.
3. **Overlays and upgrade proposals** (D3, D4).
4. **OWL coverage** (D5), split per construct family; each is independent.
5. **Bindings CSV and rules** (D6 first half). Independent of 2 to 4; can run in parallel.
6. **Logical check on capture and gate** (D7). Depends on the reasoner plan's `CHECK` reaching
   `AVAILABLE`.
7. **Alignment ontologies** (D8). Structural and SKOS levels after step 3; logical level after 6.
8. **Axiom-derived test suggestions** (D6 second half). After 4 (facets, keys).
9. **Diff picker, cross-closure successors, proposals with rebase** (D9).

## Open questions for the team

1. **Overlay scope.** May an overlay carry extra `skos:broader` links in its context, or only
   annotations? Allowing it lets Marketing place the shared concept in its own hierarchy but makes
   the SKOS hierarchy context-dependent.
2. **Default gate.** `WARN` keeps releases flowing while the reasoner rolls out. Should regulated
   customers get `BLOCK` from a deployment-level default?
3. **Upgrade proposal fan-out.** One proposal per dependent per core release (replacing older ones)
   assumes dependents upgrade one release at a time. Is skipping versions acceptable when the
   report is clean?
4. **Binding caps.** What target sizes do customers need per concept (hundreds or tens of
   thousands of tables)? The answer decides whether bindings need their own paging index.
5. **Licensing.** HermiT's LGPL sign-off is a phase-1 gate in the reasoning plan. D7 and the logical
   level of D8 depend on it.

## Alternatives considered

| Alternative | Why not |
|---|---|
| A `DomainOntology` entity type | Duplicates `Ontology`; per-ontology lifecycle already exists |
| `domains` on each concept | Two approval authorities over one release; definitions outside their reviewers' remit |
| Floating imports that follow the active release | Changes the meaning of approved releases without their reviewers |
| A canonical concept copied into each ontology, kept in sync | Divergent copies; propagation becomes a sync job with conflicts |
| Contextual meaning through named-graph quads per context on one concept | Contexts would not be ontologies, so they would lack owners, review and versions |
| Git-style branches of the whole model | Second working state, branch-aware leases and references, model merge, for what proposals already cover |
| A user-selectable reasoner | Engine fit is decidable from the profile; a choice adds support burden without a user benefit |

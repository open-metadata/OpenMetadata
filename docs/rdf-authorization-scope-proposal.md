# Proposal: deleted-entity scope and containment references for the sanitized model

- **Status:** non-deleted scope implemented and verified in the test-only experiment; this supporting query-scope work is closed for this PR. It is not strictly RBAC and is not an approved production query contract. Containment semantics remain proposed. Further deletion/restoration, snapshot and lifecycle-consistency work is deferred outside this PR.
- **Date / base:** 2026-09-15, on top of `ab8bc7e745`.
- **Context:** [`rdf-authorization-experiment.md`](rdf-authorization-experiment.md) Findings 10–11. Every other deferred fact stays fail-closed: `om:joins`, `om:childrenCount`, domain membership (`om:has`), domain and edge lineage, tag-application attributes, and lineage details.

## 1. Non-deleted scope

**Proposed baseline.** A model covers non-deleted catalog entities only. Candidates are loaded from the database with `Include.NON_DELETED`; RDF and the authorizer are not the source of deletion state. This matches default REST reads: `EntityResource.java:353` defaults to `NON_DELETED`, `ListFilter()` does too, and lineage reads default to `includeDeleted=false`.

### Why the database, not RDF or the authorizer

- **A soft delete keeps the RDF projection.** `postDelete` removes RDF only on a hard delete (`EntityRepository.java:4708–4712`), and relationship rows are cleaned only on a hard delete (`:4824–4829`). The knowledge graph therefore still holds soft-deleted entities, their `om:isDeleted true` and `prov:invalidatedAtTime`, and edges to them.
- **The authorizer does not enforce deletion.** A REST-shaped `ResourceContext` swallows `EntityNotFoundException` for a deleted id and leaves the entity null (`ResourceContext.resolveEntity`). `hasDomain()` then returns true for a null entity (`RuleEvaluator.java:170–174`). REST returns 404 from the read that follows authorization, not from authorization itself.
- **Containment cascades.** A non-recursive delete with `CONTAINS`/`PARENT_OF` children is refused (`EntityRepository.java:4937`), and a recursive soft delete cascades. A non-deleted table therefore normally has non-deleted containers.

### Deletion checks by kind of RDF object

A deletion check applies only to catalog entities.

| Object | Deletion check |
| --- | --- |
| Literal | None. |
| Vocabulary term (`rdf:type` object) | None. It must be on the approved vocabulary list. |
| Owned structure (column, extension, extension property) | No deletion state of its own. It must be claimed by a candidate owner, as the ownership check already requires. |
| Catalog entity IRI (`entity/<type>/<id>`) that is a candidate | Already non-deleted by selection. |
| Catalog entity IRI that is not a candidate | Resolved in one bounded database lookup that includes deleted rows. Soft-deleted: excluded by the scope rule. Non-deleted: see "Absence is not denial". Missing: consistency failure. Exceeding the bound: failure, never truncation. |
| Any other IRI | No mapping: the build fails, as today. |

**Absence is not denial.** A non-deleted entity that is not a candidate is not assumed hidden. It is dropped as hidden only if a REST-shaped permission check denies it. If it is permitted, the candidate list was incomplete for this query, which is a scope error, not a hidden object.

### Candidate facts

- `om:isDeleted` is admitted only as `false` on a candidate.
- `om:isDeleted true` or `prov:invalidatedAtTime` on a candidate is a **consistency failure**. So is any other disagreement between the database and RDF listed in this proposal. It is reported as such, with no promise that retrying resolves it: the projection may be lagging, but it may also be wrong.

### Nothing about excluded references reaches a caller

- No count, list or flag of excluded or deleted references is returned. It would reveal relationships involving assets the caller cannot see.
- **Production requirement, not built here:** a caller-facing error must be translated to a generic reason (for example "consistency failure" or "unsupported fact") without IRIs, types or counts. There is no caller-facing endpoint yet. The experiment builder keeps its detailed messages (for example "Object … is neither a catalog resource …", "Ownership conflict for …", "Consistency failure: …"), because they are the test diagnostics. No public error layer is added in this work.

### Deletion or restoration while a model is built

| Event during the build | Effect | Detected by |
| --- | --- | --- |
| Deleted after the candidate load, RDF not yet updated | Answered as of the candidate load. Permission was checked on the non-deleted entity, as with a REST read racing a delete. | Not detected. |
| Deleted after the candidate load, RDF already updated | `om:isDeleted true` on a candidate. | Consistency failure. |
| Restored after the candidate load | Not a candidate. A reference to it resolves as non-deleted and permitted, which is a scope error. | Failure. |
| Hard-deleted during retrieval | RDF removes its incoming and outgoing triples (`RdfRepository.java:917`); a database lookup finds nothing. | Failure, or the edge is simply absent. |
| Changed between retrieval waves | Waves may read different RDF states. | Only field changes that bump the entity version, and only if versions are compared. |

**Existing mechanisms:**
- One cluster-wide live RDF writer keeps mutations in order (`RdfUpdater.initialize` warning), but it is asynchronous, so RDF lags the database.
- `EntityUpdater` bumps the entity version when fields change (`EntityRepository.java:10222–10236`). The version is projected as `dcat:version` and `dct:hasVersion`.
- A REST-shaped context loads the entity from the database for each check, without the repository cache.

**Remaining gaps:**
- No snapshot spans the candidate load, the permission checks and the reference lookups. The rename-cascade notes describe READ COMMITTED reads (`EntityRepository.java:3296–3320`).
- No snapshot spans the SPARQL retrieval waves (ADR F8).
- Lineage and other relationship-only writes do not update the entity (`LineageRepository` calls `RdfUpdater.addRelationship` directly), so a version comparison cannot see them.

**Hypothesis, not a consistency guarantee:** comparing each candidate's database version with its projected version after retrieval might detect some field changes made during a build, using existing data and no new infrastructure. It is unverified:
- whether every relevant change, including a soft delete, bumps the version;
- whether the projected version is always current;
- how large the remaining windows are.

Even if it holds, relationship-only changes stay undetected. The non-deleted scope does not depend on this comparison, and the local slice does not implement it.

## 2. Containment references

### Actual permissions of the fixture's containers

**Verified on 2026-09-16.** In a guarded integration run, the fixture user could read the service, database and schema in all six phases, through REST and through a fresh-request in-process check alike — including the phase where an unconditional deny hid every table. They are therefore **readable containers (category 1), not identity-only**, and this fixture does not exercise identity-only exposure. That matches the code:
- `DatabaseServiceTestFactory.createPostgres` and `DatabaseSchemaTestFactory.createSimple` set no domains or owners.
- `DomainOnlyAccessPolicy` denies on `!hasDomain()`, and `hasDomain()` returns true for a resource without domains (`RuleEvaluator.java:206–211`). Its allow rule therefore matches.
- `OrganizationPolicy` allows `ViewAll` on all resources, and `DataConsumer` is resolved as a default role (`TeamRepository.java:1268`); `DataConsumerPolicy` allows `ViewAll` on all resources.
- The explicit-deny phase denies table resources only.

Still unverified, though no longer material to the classification: that the inherited role seen at runtime (`82448a31…`) is `DataConsumer`, and that no container inherits a domain. Testing identity-only exposure needs a fixture whose containers the caller cannot read.

### Three separate categories

1. **Readable container resource.** The caller holds `VIEW_BASIC` on the container. It must be a full candidate whose own facts are mapped, which is not done yet, so this category fails closed today.
   - The container node also carries `rdfs:label` and `om:fullyQualifiedName` copies written from every referencing table's stored reference (`RdfPropertyMapper.addEntityReference`, `:471–495`), hidden tables included.
   - Admitting the node's label or FQN therefore requires equality with the container's own database values. Otherwise it is a consistency failure.
2. **Reference exposed through a readable table, target not independently readable.** Here the proposal is identity-only exposure. It is a **query-contract change that needs approval**, not a field mapping.
3. **Deleted, missing or inconsistent container target.** This differs from an ordinary relationship target. A lineage edge or a domain membership pointing at a soft-deleted asset is excluded by the non-deleted scope, together with the edge. A container is different: a non-recursive delete of a container with children is refused, and a recursive one cascades to the children. A non-deleted table whose own container is deleted therefore contradicts the catalog's invariants. Each case below is a consistency failure:
   - a non-deleted readable table referencing a deleted or missing container;
   - an RDF link whose id differs from the database reference;
   - an RDF link missing while the database reference exists;
   - two readable tables giving different name or FQN for the same container id.

   None is treated as hidden or omitted.

### Identity-only exposure (category 2): proposed dataset scope

**Proposed dataset `D`** for a caller and query:
- all admitted facts of candidates;
- plus each readable table's container link facts (`om:belongsToService`, `om:belongsToDatabase`, `om:belongsToSchema`), checked against the table's database reference;
- plus, for each category-2 container, exactly three identity facts: `rdf:type`, `rdfs:label`, `om:fullyQualifiedName`;
- no other fact with a category-2 container as subject.

**Where the identity facts come from: the authorized table read, not the shared RDF node.**
- Build them from the reference in the database-loaded table the caller was authorized to read (`TableRepository.setDefaultFields`, `:363–404`):
  - `rdf:type` from `RdfUtils.getRdfType(reference.type)`, the same function the projection uses;
  - `rdfs:label` from `name`;
  - `om:fullyQualifiedName` from `fullyQualifiedName`.
- Never read the container's RDF node for category 2. Its label and FQN copies, possibly from hidden tables, and all of its own facts, such as `om:contains`, never enter the model.
- **Provenance:** a stored reference is a snapshot taken by `getEntityReference()` when the table was written. `setDefaultFields` falls back to relationship lookups for legacy rows.
- **Staleness:** whether renaming a container rewrites the references stored in child tables is unverified. Only search reindexing was found.
- **Conflicts:** two readable tables giving different name or FQN for the same container id is a consistency failure. No value is chosen.
- **Consistency:** the RDF link must name the same id as the database reference.

**What `D` permits.** Identifying, grouping and counting the containers of readable tables, without access to those containers' own facts.

**How arbitrary supported queries behave.** Answers are exact for `D`, not for the full knowledge graph. The contract must say so; stricter omission does not by itself make answers complete.
- Patterns with a category-2 container as subject match only the three identity predicates, and `?p` enumerations list only those three.
- `OPTIONAL`, `EXISTS`, `NOT EXISTS` and `MINUS` over any other predicate of that container evaluate as absent. For example, `NOT EXISTS { <schema> om:contains ?t }` is true in `D`.
- `?x a <container type>` finds readable containers plus containers referenced by at least one readable table. `COUNT(DISTINCT ?schema)` counts those, not all containers.
- Tables-per-container counts include readable tables only. Container-owned facts are excluded, so they do not reveal hidden tables.
- A path continuing through a container-owned predicate stops at a category-2 node. For example, `om:belongsToSchema/om:belongsToDatabase` stops there, while the table's direct `om:belongsToDatabase` still matches.

**Differences from REST references** (`entityReference.json`, `EntityInterface.getEntityReference`):

| REST reference field | In `D` |
| --- | --- |
| `id`, `type` | Encoded in the IRI. `rdf:type` is an RDF vocabulary term (for example `database` → `dcat:Catalog`), not the REST type string. |
| `name` | `rdfs:label` |
| `fullyQualifiedName` | `om:fullyQualifiedName` |
| `description` | Omitted |
| `displayName` | Omitted |
| `deleted` | Omitted. Always non-deleted in scope. |
| `inherited`, `href` | Omitted |
| One reference per table response | Merged by IRI across tables. Conflicting copies fail instead of both appearing. |

## Decisions we can make independently

1. The non-deleted scope with database-backed `NON_DELETED` candidate selection.
2. No caller-visible counts, identities or diagnostics about excluded, deleted or hidden references; generic failure reasons only.
3. The deletion check table by object kind, including "absence is not denial".
4. Explicit consistency failures, with no retry promise. The version comparison stays a hypothesis to evaluate, not part of the decision.
5. Readable containers (category 1) as full candidates that stay fail-closed until their facts are mapped.

These need a product or contract decision:

6. Whether identity-only exposure (category 2) and dataset `D` become the query contract.
7. If they do, whether identity facts come from the authorized table read, as proposed.

## Source-backed findings versus unverified assumptions

**Source-backed:**
- Soft delete keeps RDF triples and relationship rows; only a hard delete removes them.
- The authorizer passes a deleted id to policies with a null entity, and `hasDomain()` returns true for that null entity.
- Deletes refuse non-recursive removal with children and cascade recursively.
- REST reads default to non-deleted.
- A table GET always includes container references and authorizes only the table.
- References carry id, type, name, FQN, description, display name, deleted and href.
- The projection writes container label and FQN copies from every referencing table.
- Live RDF writes are ordered and asynchronous, and lineage writes do not bump the entity version.
- The experiment builder's messages include IRIs.
- The fixture creates containers without domains or owners, and the relevant policies allow `ViewAll`.

**Unverified:**
- The runtime inherited role is `DataConsumer`.
- A soft delete bumps the entity version.
- Container renames update the references stored in child tables.
- Stale label or FQN copies from hidden tables actually occur.
- The size of the race windows listed above.

## Completed non-deleted experiment

**Non-deleted scope only** (decisions 1–4), in the local sanitized-model tests, with no Docker run:
- Project a soft-deleted table E, with an edge from visible A to E.
- Give the catalog a bounded lookup that reports E as deleted.

The tests would assert:
- E's facts are never retrieved, and the edge to E is excluded, with no caller-visible trace.
- An unknown catalog IRI fails as a consistency failure.
- A non-deleted, permitted, non-candidate IRI fails as a scope error, not as hidden.
- `om:isDeleted false` on a candidate is admitted, while `om:isDeleted true` or `prov:invalidatedAtTime` on a candidate fails.

**Local verification (2026-09-15), followed by live verification below:** implemented in the experiment builder, fixture and tests. `mvn -pl openmetadata-integration-tests -am package -Dtest=SanitizedModelExperimentTest …` reported `SanitizedModelExperimentTest` 72 tests, 0 failures, 0 errors, 0 skipped, and the integration-test module compiled; scoped spotless check passed. The tests cover:
- the lookup limit: 1,000 distinct references succeed, 1,001 fail before any lookup, and repeated references use one slot;
- each stale-projection signal on its own;
- invalid reference identity, which fails before any lookup;
- an inconsistent catalog answer.

The integration test's database adapter makes one batched read per entity type and classifies omitted ids as missing. A guarded integration run on 2026-09-16 confirmed the live behaviour: 2 tests, 0 failures, 0 errors, 0 skipped. A soft-deleted table upstream of a visible one kept its lineage edge projected, the batch API reported explicit deleted flags (`true` and `false`), the adapter classified them as deleted and live, and no violation named the deleted table. It is an experiment, not the production contract. See the experiment doc's Finding 12 for what is not covered. Caller-facing error translation is recorded as a production requirement instead of a test.

**Runtime check of the containers (completed):** REST and fresh-request in-process checks recorded readable service, database and schema resources in all six phases. This fixture does not exercise identity-only exposure. The next task is containment permission semantics, not further deletion-scope work; decision 6 remains open.

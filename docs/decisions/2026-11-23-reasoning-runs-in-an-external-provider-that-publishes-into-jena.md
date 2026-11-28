# Reasoning runs in an external provider that publishes its results into Jena

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** reviewer, until the `ReasoningProvider` interface and its contract tests land
- **Related:** supersedes the [Fuseki-native reasoning plan](../plans/2026-10-07-fuseki-native-reasoning.md);
  amends ADR:2026-10-11-rdf-reasoning-job-requests-carry-the-fields-their-operation-needs,
  ADR:2026-10-14-rdf-reasoning-capabilities-list-each-operation-and-the-limits-it-enforces,
  ADR:2026-10-15-reasoning-memory-budget-defaults, ADR:2026-10-14-fuseki-image-of-record and
  ADR:2026-11-04-ontology-sparql-runs-in-a-bounded-worker;
  [#37808](https://github.com/open-metadata/OpenMetadata/pull/37808),
  [open-metadata/jena#17](https://github.com/open-metadata/jena/pull/17),
  [open-metadata/jena#18](https://github.com/open-metadata/jena/pull/18)

## Context

The [Fuseki-native reasoning plan](../plans/2026-10-07-fuseki-native-reasoning.md) put all
reasoning in the `openmetadata/fuseki` image. Reasoner worker JVMs, launched by the Fuseki
module, ran governance rules and OWL classification and published snapshots that Fuseki then
answered queries from. The plan rejected a reasoner sidecar because it would add a deployable
to every installation.

Building it showed the costs of that placement. The worker shares the Fuseki container's memory
limit and page cache, so a deployment that enabled reasoning had to size one container for both
(ADR:2026-10-15-reasoning-memory-budget-defaults). The image carried a maintained HermiT build
whose licence and ownership were still open decisions in the plan. Snapshot queries made Fuseki
answer reads from a second copy of the graph beside the one it already serves. Inside
OpenMetadata, `InferenceMaterializer` still evaluates rules in the server, and
`OntologySparqlQueryService` still offers the incomplete OWL Mini reasoner.

## Decision

**Reasoning leaves the Fuseki image and the OpenMetadata server.** Governance-rule refresh, OWL
classification of ontology releases, CHECK before activation, and EXPLAIN run in a reasoning
provider. The open-metadata/jena fork keeps the `openmetadata/fuseki` image packaging and the
operational extension: the bounded Graph Store upload, `GuardedUpdate`, the free-space write
guard and the storage report. The reasoner leaves the fork, and the Fuseki-side reasoning pull
requests (open-metadata/jena#17 and #18) are closed.

**OpenMetadata defines a `ReasoningProvider` interface**, loaded with `ServiceLoader` as
`SearchRepositoryProvider` is. OSS ships no provider. The default reports capability readiness
`DISABLED`, so reasoning is a Collate capability. Collate provides an implementation that
delegates to its sidecar over HTTP, authenticated with the bot JWT.

**The provider keeps OpenMetadata's typed reasoning contract**: the `rdfReasoning*.json` schemas
and #37808's release naming, inline rules and upload by digest. Three things change.

- QUERY is reported `NOT_IMPLEMENTED`. Fuseki answers reads.
- The snapshot becomes a generation record that the pointer graph holds. It carries the generation,
  `computedAt`, the captured live-write watermark, the rule-bundle digest, the active releases
  and the per-rule counts.
- REFRESH names its target dataset, so a refresh can write a blue-green rebuild target
  (`openmetadata_a` or `openmetadata_b`).

**The provider writes each generation of derived facts into its own graphs under the inferred
prefix, and a pointer names the current one.** A generation writes one graph per rule and one
entailment graph per active ontology release, each under `<base>graph/inferred/<generation>/`.
Publishing it replaces the triples of one pointer graph, also under the inferred prefix, in a
single small update. Old generations stay until OpenMetadata's maintenance drops them, inside the
write pause it already takes for a compaction. Provenance for EXPLAIN
stays in the provider's own store. OpenMetadata no longer writes inferred graphs.

A spike measured the alternative, MOVE into fixed graph names. With 2.57 million derived facts at
200,000 tables, one update with a MOVE per rule was atomic, but it held Fuseki's only writer for
96 to 133 s. Every live write waited that long, and the request ran far past the 50 s write
deadline. The pointer update took 0.2 to 0.4 s, no reader saw a mix of two generations, and
reading through the pointer cost no measurable latency.

**Jena evaluates the rules.** The provider runs each rule's WHERE pattern as a SELECT on Fuseki,
scoped to the asserted graphs. Later passes bind the previous pass's new facts with VALUES. The
provider builds the conclusions and their witnesses in Python. At 200,000 tables (29 million
triples) a refresh staged its 2.57 million facts in 183 s beside a serving load. Its process
peaked at 0.5 GB. Evaluating in process on pyoxigraph was 50 s faster, but it needed 3.7 GB and
it differs from Jena. It rewrites literal datatypes on load and has no `fn:` functions, so it
matched OpenMetadata's materializer on 20 of 22 rule bundles, against 22 for Jena.

**Freshness is a full recompute, daily by default and on demand.** `RdfInferenceApp` schedules it,
and its schedule is configurable. The on-demand triggers are the admin "refresh now", ontology
activation (CHECK before, REFRESH after) and a blue-green promotion. There is no change feed and
no incremental maintenance. Every answer carries `computedAt`, and `ReasoningFreshness` labels it
`CURRENT` or `STALE` by comparing the live-write watermark. This is deliberately simple and will
be tuned later.

**OSS removes in-process reasoning.** `InferenceMaterializer` execution and the OWL Mini reasoner
in `OntologySparqlQueryService` are removed. The rule store, its CRUD API and the rule validator
stay, because the provider reads the rules from OpenMetadata. `rdf.materializedInferenceEnabled`
becomes an ignored, deprecated key.

**Agents get three MCP tools in 2.2**: `inferred_facts`, `explain_inference` and
`check_ontology_change`. They are admin-only until graph results are filtered per asset, and
hidden when no provider is available.

**The OWL engine is Konclude.** Classification must stay complete for OWL 2 DL, and no pure-Python
or wheel-packaged OWL 2 DL reasoner installs on Python 3.12 for both amd64 and arm64. A spike ran
the fork's 53 OWL conformance fixtures against three engines. Konclude, a C++ OWL 2 DL reasoner,
answered every reasoning fixture correctly. Across 200 DL releases its engine time was 15.7 s,
against 97.4 s for HermiT, and both gave identical reports. It failed only the 7 fixtures whose
input lies outside OWL 2 DL, because it has no profile check. OpenMetadata's profile guard
already checks for those constructs when an axiom is written or imported: illegal punning,
irregular property chains, non-simple properties where OWL 2 DL requires simple ones, undeclared
classes and unsupported datatypes. The provider therefore receives only OWL 2 DL, and a contract
test (below) holds the guard to each of the 7 cases. Konclude has no explanation
command, so EXPLAIN for an OWL entailment computes its justification black-box, with one
consistency check per step. The provider pins a Konclude commit and runs the conformance fixtures
against every build.

**Live read latency during a refresh depends on an image fix.** The gate is a read p95 within 2x
of the quiet baseline. Both rule engines first missed it at 200,000 tables, at 2.6x and 2.9x, and
the evaluator was not the cause. Fuseki's 5 MiB Jetty output buffer made the JVM run explicit
stop-the-world full collections, even at rest. On a 6.2.0 image with a 32 KiB pooled buffer, the
refresh ran at 1.3x and 1.8x of baseline, one run each, and passed. The image ships Fuseki 6.3.0
instead, which pools its own 2 MiB buffer (ADR:2026-10-15-reasoning-memory-budget-defaults, v3).
The gate has not been re-measured on 6.3.0.

This ships in 2.2.

## Consequences

- An installation sizes Fuseki for serving alone. The worker half of the memory budget is gone,
  and the Fuseki direct-buffer cap stays.
- The fork's release work shrinks to image packaging and the operational extension. The image pin
  and its environment contract (ADR:2026-10-14-fuseki-image-of-record) are unchanged.
- Asserted-only reads do not change. Every generation graph and the pointer graph start with
  `<base>graph/inferred/`, so those reads already leave them out
  (ADR:2026-10-11-asserted-only-rdf-reads-name-every-non-inferred-graph).
- OpenMetadata's two readers of inferred facts, the explanation service and the MCP neighborhood
  tool, change. Today they filter on the inferred prefix, which would match every generation still
  stored. They resolve the pointer in the same query and filter on the current generation's
  prefix, so a reader sees one whole generation, never a mix of two.
- A query on the union default graph that names no graph sees every stored generation, including
  one not yet published. That widens what such a query already sees today, which is every
  inferred graph. A read that must exclude derived facts uses the asserted-only reads.
- TDB2 does not reuse freed space. At 200,000 tables each generation added 7.7 to 7.9 GB until
  the database was compacted. OpenMetadata's existing maintenance compaction reclaims it (see
  "Compaction and disk growth" in `docs/rdf-production-setup.md`). Compacting after each daily
  cycle returned the database to 11.7 to 12.3 GB, its size before the first generation. The
  volume's headroom must cover the new generation and the compacted copy: the peak was 34 GB for
  a 22 GB database.
- At 200,000 tables a compaction blocked every writer for 250 to 362 s. A Graph Store upload sent
  during it failed with 408. OpenMetadata already pauses its own writes and queues them in SQL
  for a compaction, and its maintenance never overlaps an inference run. The same exclusion
  covers a provider REFRESH: `RdfInferenceApp` holds it from submit until the job ends.
- Dropping an old generation also blocks writers, for up to 16 s per rule graph at 200,000
  tables. The provider therefore never drops one. OpenMetadata's maintenance drops every
  generation the pointer does not name, inside its write pause and before it compacts. That also
  removes generations a failed refresh left behind.
- While a compaction switched files, some reads waited until their 120 s client timeout, 2 to 6
  per compaction at 200,000 tables. In one 20,000-table run the compaction never got the
  exclusive lock it waits for, and it did not finish. This also affects OpenMetadata's scheduled
  compaction today, and it is not yet explained.
- Inferred answers can be up to a day old between refreshes. The freshness label says so, and an
  admin can refresh at once.
- OSS no longer runs materialized rules. An OSS installation that ran them keeps its last
  `graph/inferred/*` graphs until they are cleared, so the 2.2 upgrade notes must say how.
- The `rdfReasoning*.json` schemas stay the boundary between OpenMetadata and any provider. A
  change to them follows the earlier records' rules. The copy of the schemas that the fork's
  reasoning tests used leaves open-metadata/jena with the reasoner.
- The provider relies on OpenMetadata's profile guard for OWL 2 DL admission. A contract test
  feeds the 7 non-DL fixture shapes through the guard and expects each to be rejected, so a gap
  in the guard fails a build instead of silently producing an incomplete classification.
- Konclude has one maintainer and is still fixing soundness bugs that fuzzing finds. The pinned
  commit and the fixture run on every build are the guard. EXPLAIN for OWL entailments costs up
  to about 26 s at the fork's limit of 1,000 checks, so it runs as an asynchronous job.
- Revisit if Konclude's pinned build fails the fixtures with no upstream fix, if Jena's rule
  evaluation nears the 30-minute budget (its slowest query took 14 s of the 50 s query timeout at
  200,000 tables), or if daily staleness proves too slow for governance and needs a change feed.

## Alternatives considered

| Alternative | Assessment |
|---|---|
| Worker JVMs inside the Fuseki container (the plan, and the status quo) | One image and no new service, but every image ships the reasoner and the HermiT build, a deployment that enables reasoning sizes the Fuseki container for the worker too, and Fuseki serves snapshot reads from a second copy of the graph. Rejected. |
| The existing worker as a JVM subprocess of the sidecar | Reuses the worker code, but keeps a second JVM and its heap budget for rule evaluation that Jena or the provider can do directly. Rejected for the whole workload. |
| The fork's OWL code (OWL API, HermiT, ELK) as a Java CLI, for OWL only | Passed all 53 fixtures and already has explanation code. It puts a JVM in the provider's image (+77 MB), and HermiT's engine time on 200 DL releases was about six times Konclude's. Rejected in favour of a native engine. |
| A Rust OWL 2 DL reasoner binary (Kobayashi-MaRust) | The smallest (+19.5 MB) and fastest engine measured, with its own profile checks and explanations. It is six months old with one author, and in the spike it crashed on valid input and rejected valid OWL 2 DL. Rejected for now; worth rerunning the fixtures against later. |
| Publish by MOVE into fixed graph names, in one update | Atomic, and readers keep their graph names. At 200,000 tables it held the only writer for 96 to 133 s and ran past the 50 s write deadline. A DROP, INSERT WHERE, DROP swap took as long. Rejected. |
| Evaluate the rules in process on pyoxigraph | 50 s faster at 200,000 tables. It needs 3.7 GB, fetches the whole graph for a rule with a variable predicate, and differs from Jena on literal datatypes and `fn:` functions. It does not relieve the live load either, because both engines write the same facts into Fuseki. Rejected; kept as the fallback if Jena's evaluation time nears the budget. |
| A FaCT++ Python binding (pyfactxx) | No Python 3.12 or arm64 wheel, its source build fails, and it has had no release since 2022. Rejected. |
| Precompute on every change | Freshest answers, but needs a change feed and incremental truth maintenance, which the plan already deferred. Rejected for now. |
| Evaluate at question time | No stored results, but puts rule and OWL cost on the request path, where neither has a bound that fits a query deadline. Rejected. |
| Daily full recompute plus on-demand triggers | Simplest to build and to reason about. Staleness is bounded by the schedule and visible through `ReasoningFreshness`. **Chosen.** |
| The sidecar answers QUERY from object-store snapshots | Keeps reasoning reads off Fuseki, but adds a second query engine and a second copy of the graph, and an answer could mix snapshot conclusions with newer asserted data from Fuseki. Rejected. Fuseki answers every read. |

The plan's reason for rejecting a sidecar, a deployable in every installation, no longer holds.
OSS ships no provider, so only an installation that uses reasoning runs one.

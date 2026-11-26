# Ontology SPARQL runs in a disposable JVM with bounded query memory

- **Status:** Proposed
- **Revisions:** v1 2026-11-04 (initial) · v2 2026-11-04 (input-proportional heap and loading refusals) · v3 2026-11-05 (prefix fidelity and bounded admission wait) · v4 2026-11-10 (an active release too large for the worker is answered from its served graph)
- **Deciders:** Pending maintainer review
- **Guard:** OntologySparqlQueryServiceTest, OntologySparqlServedGraphTest, OntologyReleaseQueryTest, RdfLibraryPackActivationIT and reviewer
- **Related:** [#37088](https://github.com/open-metadata/OpenMetadata/issues/37088), ANT-2026-J4XIPJA4

## Context

LIMIT and query deadlines do not bound Jena's allocation. Expression evaluation, optimizer
constant folding, inference, grouping, sorting and graph construction can exhaust the server
heap before any result is serialized. A bounded output stream alone cannot prevent this.

## Decision

Both glossary and native ontology queries use one shared, disposable child JVM. The parent
retains authorization and SQL-backed source-model materialization. All inference, optimization,
evaluation, derived graph construction and result serialization run in the child.

One global admission permit is acquired before materialization and held until the child has
actually terminated. Contention returns the existing capacity refusal. Each child has a 64 MiB
heap, 64 MiB metaspace, 16 MiB direct-buffer budget, 32 MiB code cache, 512 KiB thread stacks,
SerialGC and one active processor. JVM environment overrides are removed. A recognized HotSpot
out-of-memory exit or explicit transport/output limit is a typed caller error.

Private temporary files bound request transport to 32 MiB and complete output to 10 MiB. The
asserted model is streamed as RDF 1.2 N-Triples. Serializers reject writes exceeding the output
budget before forwarding them. A small typed status distinguishes complete results, expected
refusals and server faults. No partial result is returned. The request deadline includes input
serialization, child startup and execution. Timeout or interruption kills and reaps the child
before another query can enter. Known files are removed on every exit path.

## Consequences

Ordinary SELECT, ASK, CONSTRUCT and DESCRIBE queries, matching formats and NONE/RDFS/OWL Mini
inference retain their semantics within the budget. Expensive legitimate queries may be refused.
The child adds startup latency and requires a writable private temporary directory and the same
Java runtime/classpath as the server. There is no worker pool, external service or configuration.

The boundary isolates query-driven Java heap exhaustion. It does not bound pre-existing source
catalog materialization in the parent or total process RSS. Deployments must reserve memory
beyond the server heap for the child's explicit caps and measured native overhead. A host or
container OOM can still kill the parent. An OS memory boundary would be a separate deployment
decision rather than an implied guarantee of this JVM limit.

## Amendment: input-proportional heap and loading refusals (v2)

The fixed 64 MiB heap above is replaced by a 64 MiB base plus 24 times the serialized request
bytes, rounded up to MiB, with a hard ceiling of 256 MiB. The global concurrency and other JVM
caps remain unchanged. Deployments must budget for the larger maximum child heap.

A 3.16 MiB graph with 80,000 distinct subjects, predicates and objects exhausted the original
heap while loading, although a 7.55 MiB glossary with 12,000 concepts and repeated vocabulary
loaded successfully. Serialized length alone is not a safe admission threshold. Measurements
over five fresh JVM runs per case with Java 21 and Jena 6.2 found about 14 times the input bytes
retained for the distinct-node model, and about 18 times for the glossary after OWL Mini
inference, excluding the baseline heap. The 24-times allowance adds margin above these
observations; it is not a universal expansion bound. The regression tests execute both models
and exercise NONE, RDFS and OWL.

The 32 MiB limit remains a transport ceiling. Ontologies that exceed the maximum worker heap
are refused. A private zero-byte loading marker survives a hard out-of-memory exit, so the
parent distinguishes an ontology too large to parse from query/inference memory exhaustion.
It removes the marker with the other temporary files before releasing admission. A real worker
with a deliberately smaller heap checks parsing exhaustion and its classification without
depending on whether GC thrashing reaches the normal request deadline first.

Inference can grow far beyond the source graph: OWL Mini on the distinct-predicate fixture
exhausted even a 512 MiB profiling JVM. Neither the byte allowance nor a lower transport cap
can guarantee arbitrary inference fits. The disposable worker and its fixed ceiling remain
the containment boundary.

## Amendment: prefix fidelity and bounded admission wait (v3)

The private request now includes the model's prefix map before the N-Triples, inside the same
32 MiB transport bound. The worker restores it before parsing so CONSTRUCT and DESCRIBE retain
source prefixes. N-Triples remains the transport because Turtle abbreviation would change the
serialized-byte heap calibration for the same graph. Prefix text uses bounded UTF-8 lengths,
including the empty default prefix and namespaces longer than Java's modified-UTF limit.

Validation precedes worker admission, within the existing global and per-principal execution
guard. The single worker permit now queues fairly for up to five seconds or the request's
remaining budget. The deadline starts before waiting and is not renewed after admission.
Saturation returns HTTP 429 with `Retry-After: 1`; deadline expiry or interruption remains a
timeout. The permit is still held through materialization and child cleanup, preserving the
one-worker memory bound. Configurable worker concurrency is outside this amendment.

## Amendment: an active release too large for the worker is answered from its served graph (v4)

Bundled library packs are installed whole, and the full FHIR R5 release serializes to more than
the 32 MiB transport bound; anything above roughly 8 MiB of N-Triples already reaches the 256 MiB
heap ceiling. Raising either limit would undo this record's containment, so an active native
ontology release that the worker refuses for its own size (`OntologyTooLargeException`: the input
bound, or exhausting the heap while loading) is answered by the triplestore instead. A query that
exhausts memory after loading is still refused, so a costly query is never retried elsewhere.

The fallback runs only after the parent has materialized and authorized every member, so the
caller is already cleared to view the whole release. It needs RDF enabled and the ontology's
served graph (`OntologyActiveGraph.graph`) to hold this release, checked by asking for the
ontology IRI's `owl:versionIRI`; a graph that is still loading returns HTTP 429 with
`Retry-After: 1`. The version check and the query share the caller's one timeout, counted from
when the request arrived: each gets only what the steps before it left, and a spent budget is a
timeout (HTTP 503) before the store is read, so the fallback never stretches a request past the
time it asked for. A refusal for size holds for the release's lifetime, because releases are
immutable, so each server remembers the refused release IDs (at most 1,000) and sends later
queries over them straight to the served graph after authorizing every member, without taking
the worker's permit or building the projection. The query keeps the endpoint's validation (read-only, no `FROM`, no `SERVICE`,
result limit, timeout) and names the served graph as both `FROM` and `FROM NAMED`, because the
store's default graph is the union of the dataset's named graphs
(ADR:2026-10-11-asserted-only-rdf-reads-name-every-non-inferred-graph). Results stream through the
worker's own serializers into the same 10 MiB response bound.

Two differences follow from serving the store's graph rather than the worker's model. The served
graph carries asserted statements without their statement sources, which stay in SQL and in
exports. RDFS and OWL inference run only in memory, so they are refused for such a release.
Fuseki's streaming read counts only an unreachable or unavailable store toward its circuit breaker,
so slow caller queries cannot open it for every other RDF read. Glossary queries and draft-scope
queries are unchanged.

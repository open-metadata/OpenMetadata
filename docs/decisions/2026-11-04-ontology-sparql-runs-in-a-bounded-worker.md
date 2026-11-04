# Ontology SPARQL runs in a disposable JVM with bounded query memory

- **Status:** Proposed
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** Pending maintainer review
- **Guard:** OntologySparqlQueryServiceTest and reviewer
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

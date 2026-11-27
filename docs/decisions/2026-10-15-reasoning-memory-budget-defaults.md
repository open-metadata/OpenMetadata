# The reasoning memory budget keeps its 1 GiB / 512 MiB off-heap defaults, with Fuseki's direct buffers capped

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial) · v2 2026-11-23 (the worker half is withdrawn; the
  Fuseki direct-buffer cap stays) · v3 2026-11-24 (Fuseki 6.3.0 pools its output buffer, so
  responses stop filling the cap) · v4 2026-11-25 (the pin carries the image's cap, so the
  deployment files set only the heap)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** the open-metadata/jena image smoke test's "direct buffers are capped" and "responses
  neither force System.gc() nor pile up direct buffers" checks. The worker tests that guarded the
  reasoning half left the fork with it (v2).
- **Related:** [Fuseki-native reasoning plan](../plans/2026-10-07-fuseki-native-reasoning.md)
  (phase 1, task 6; "Packaging and sizing"), [rdf-scale-validation.md](../rdf-scale-validation.md),
  ADR:2026-10-14-fuseki-image-of-record

## Context

The memory budget `container limit ≥ (H_f + O_f + H_w + O_w + C_min) / 0.9` used provisional
values: Fuseki off-heap `O_f` 1 GiB (1.5 GiB from an 8 GiB heap), worker off-heap `O_w` 512 MiB,
worker heap `H_w` 2 GiB, and admission limits proportional to the worker heap. Phase 1 measured
them with Native Memory Tracking on the published `openmetadata/fuseki:6.2.0-600514c` image
(Apple M4 Max, `linux/arm64` container limited to 4 CPUs and 16 GiB):

- Fuseki, 4 GiB heap, OpenMetadata rebuilding and querying a 20,000-table / 200,000-edge catalog:
  direct buffers reached 1.5 GiB, because Fuseki allocates about 5 MiB of them per HTTP request and
  frees them at the next collection, and the JVM's default direct limit is the whole heap.
  Everything else outside the heap stayed under 300 MiB (291 MiB). With a 256 MiB direct limit the
  same workload peaked at 254 MiB of direct buffers, without errors.
- Worker, 2 GiB heap: at most 200 MiB outside the heap on every conformance fixture and on
  catalog-shaped closures of 10,000 to 50,000 individuals. The 50,000-individual closure peaked at
  0.65 GiB after collection and classified in a 1 GiB heap.
- The worker sized its default limits from `Runtime.maxMemory()`, 1.92 GiB of a 2 GiB parallel-GC
  heap, so it admitted 47,925 individuals instead of the documented 50,000.

## Decision

- Fuseki runs with `-XX:MaxDirectMemorySize=256m` unless `JVM_ARGS` sets the flag, and
  `O_f = direct limit + 768 MiB` (+ 1.25 GiB from an 8 GiB heap), which keeps the defaults at
  1 GiB and 1.5 GiB. A larger limit, or `0` (the heap), raises `O_f` with it. The image applies
  the flag itself from open-metadata/jena#6. The pinned `6.2.0-600514c` predates it, so until the
  pin moves the Compose files and the Kubernetes example set the flag in `JVM_ARGS`.
- `O_w` stays 512 MiB, its floor; `H_w` stays 2 GiB.
- Admission limits scale with the configured `-Xmx`, keeping 150,000 closure triples, 100,000
  logical axioms and 25,000 individuals per GiB: a 2 GiB worker admits 300,000 triples, 200,000
  axioms and 50,000 individuals, about 40,000 individuals of the measured catalog shape.

## Consequences

- The budget's premise that every JVM region is capped now holds for Fuseki too; without the cap,
  an idle 2 GiB Fuseki held 1.2 GiB of direct buffers and readiness would refuse every step as
  "off-heap has outgrown O_f".
- The axiom limit is roughly 2.5 times below what the measured assertion-heavy closure needs, by
  design: terminological axioms cost the engines more, and no terminology-heavy fixture has been
  measured. Raise it only from such a measurement (phase 8).
- These are one machine's numbers on synthetic shapes. Phase 8 replaces them with measurements on
  production-shaped catalogs under concurrent serving traffic, on amd64 as well.

## Amendment: the worker half is withdrawn (v2, 2026-11-23)

Reasoning moved out of the `openmetadata/fuseki` image into a `ReasoningProvider`
(ADR:2026-11-23-reasoning-runs-in-an-external-provider-that-publishes-into-jena), so no reasoner worker runs in the Fuseki container. The worker terms of the budget
(`H_w`, `O_w`), the worker's admission limits and its guards (`ReasoningSettingsTest`,
`ReadinessTest`, `LimitsTest`, `WorkerProcessIT`) are withdrawn. The Fuseki decision stays.
Fuseki runs with `-XX:MaxDirectMemorySize=256m` unless `JVM_ARGS` sets the flag, and
`O_f = direct limit + 768 MiB`. The image smoke test's "direct buffers are capped" check remains
its guard, and the container is sized for Fuseki's heap, `O_f` and the page cache alone.

## Amendment: responses no longer fill the direct-buffer cap (v3, 2026-11-24)

The 5 MiB a request that the context measured is Fuseki's Jetty output buffer. Fuseki 6.2.0 sets
it to 5 MiB, and Jetty takes it for every response that has a body, even a five-byte result.
Jetty 12.1's pool keeps no buffer above 64 KiB, so every response allocates a new one, and only a
collection frees it. "The JVM collects at the cap" therefore meant one `System.gc()` about every
51st response, and G1 runs that as a stop-the-world full collection. A Java Flight Recorder trace
showed 220 of 222 explicit collections in 60 s on that path (`HttpOutput.write`,
`ArrayByteBufferPool.acquire`, `ByteBuffer.allocateDirect`, `Bits.reserveMemory`). The published
`6.2.0-91a23ac` image does the same with no reasoning running: 3.5 full collections a second, and
9% of wall time.

Fuseki 6.3.0 fixes this upstream. It hands Jetty a buffer pool sized to its output buffer, which is
now 2 MiB (apache/jena GH-4084), so responses reuse their buffers. The image moves to 6.3.0
(open-metadata/jena#23). A 6.2.0 image that instead set a 32 KiB output buffer, Jetty's default, in a
`jetty.xml` (open-metadata/jena#21, closed) produced the measurements below; it is not shipped. The
smoke test's check "responses neither force System.gc() nor pile up direct buffers" sends 600
queries. It fails on any `System.gc()` collection or on more than 64 MiB of direct buffers in use.
It fails on `6.2.0-f88e5ad` and passes on 6.3.0, which ends at 5.7 MB of direct buffers. The
256 MiB cap and `O_f` stay.

| Window | Full collections a second | Time in GC | Read p95 |
|---|---|---|---|
| 200,000 tables, at rest, before | 2.6 | 12.9% | 50 ms |
| 200,000 tables, at rest, after | 0 | 0.1% | 8.2 ms |
| 200,000 tables, rule refresh, before | 2.0 to 2.4 | 26 to 27% | 100 to 126 ms |
| 200,000 tables, rule refresh, after | 0 | 0.4 to 0.6% | 10.8 and 15.0 ms |

These are one run a side at 200,000 tables on a shared arm64 host, with the 32 KiB `jetty.xml`
image, where direct buffers peaked at 3.9 MiB. They have not been repeated on 6.3.0, whose pooled
buffer is 2 MiB.

## Amendment: the pin carries the image's cap (v4, 2026-11-25)

The pin has carried the image's own cap since `6.2.0-91a23ac`: its entrypoint adds
`-XX:MaxDirectMemorySize=256m` whenever `JVM_ARGS` does not set the flag. The Compose files and
the Kubernetes example therefore set only `FUSEKI_HEAP`, and the resulting JVM flags are the ones
they set before.

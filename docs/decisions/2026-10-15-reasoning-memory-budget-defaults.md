# The reasoning memory budget keeps its 1 GiB / 512 MiB off-heap defaults, with Fuseki's direct buffers capped

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** open-metadata/jena `ReasoningSettingsTest`, `ReadinessTest`, `LimitsTest`,
  `WorkerProcessIT` and the image smoke test's "direct buffers are capped" check
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
  1 GiB and 1.5 GiB. A larger limit, or `0` (the heap), raises `O_f` with it.
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

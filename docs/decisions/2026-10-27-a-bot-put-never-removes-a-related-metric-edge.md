# A bot PUT never removes a related-metric edge

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** ulixius9
- **Guard:** `MetricResourceIT` (`put_reingestingRelatedMetricsIsANoOp` fails if re-ingestion
  versions either end again; `put_byBotNeverRemovesRelatedMetric` fails if a bot PUT or a bulk
  force-sync drops an edge;
  `put_byUserReplacesRelatedMetrics` fails if the merge leaks into user PUTs)
- **Related:** #34920

## Context
`relatedMetrics` is one undirected `RELATED_TO` edge, read from both ends (`findBoth`) and stored
with the smaller UUID first, so the server cannot tell which metric declared it. Ingestion (dbt,
Looker, Tableau, Power BI) PUTs each metric with only the metrics it references, and the referenced
metric with `[]`. Diffing that request against the undirected read deleted the edge on the
referenced metric's PUT and re-added it on the referencing metric's PUT. Every re-ingestion of
unchanged metrics created a new version and a change event on both ends of every edge.

## Decision
- A bot PUT merges the requested `relatedMetrics` with the stored edges. It adds edges and never
  removes one. This includes a bulk PUT with `overrideMetadata=true` (force-sync).
- A PUT by a user and any PATCH replace the list, as before.

## Consequences
Re-ingesting unchanged metrics is a no-op. The cost is that when the source drops a reference,
re-ingestion keeps the edge until a user removes it.

Force-sync is not exempt, unlike the other bot-PUT guards. The bulk PUT loads every original before
it runs the first updater. In a batch `[B([]), A([B])]`, a replace would let B's `[]` delete the
edge, and A's update, which diffs against the stale `[B]` snapshot, would never re-add it. The
request would lose an edge it explicitly asserts.

Do not narrow this to "remove only the edges this metric declared" without first storing who
declared each edge. Today an edge carries no provenance, so that rule cannot be evaluated. Once it
does, a bot PUT can delete exactly its own dropped edges, and this record is superseded.

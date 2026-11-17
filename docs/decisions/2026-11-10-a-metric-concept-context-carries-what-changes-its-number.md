# A metric's concept context carries what changes or reads its number, and nothing else

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** Tomas Montiel
- **Guard:** `ConceptContextBuilderTest`, `ConceptContextMarkdownTest.rendersWhatDefinesAMetricsNumber`
- **Related:** #37476, open-metadata/openmetadata-collate#8310, open-metadata/ai-platform#2155

## Context

`GET /metrics/name/{fqn}/context` returns a `conceptContext` that the AI platform reads to compute a
metric. It carried only the metric's expression and bindings. A metric defined as "fee revenue
where `fee_category = 'ATM Fee'`, in dollars, per month" reached the agent as the bare `SUM(...)`,
so Chat reported a different number, or the right number in the wrong unit. The agent reads these
fields from the JSON payload and renders them itself, so the field names and meanings are a
contract between this server and ai-platform.

## Decision

A metric's `conceptContext` carries, beside `definition` (the expression):

- **`filters`**: every non-blank `where` of the metric's filters, as stored. They all apply
  together with the definition, so a renderer joins them as one conjunction (each condition
  parenthesised, joined with `AND`) and never as a bare list. The field is omitted when there is
  none.
- **`granularity`**: the `granularity` enum value (`DAY`, `MONTH`, ...).
- **`unit`**: the custom unit when `unitOfMeasurement` is `OTHER` and a custom unit is given;
  otherwise the `unitOfMeasurement` value.

Metric type, dimensions, measures and the variant hierarchy stay out. They describe the metric, but
none of them changes the number or how it is read, and every extra field is prompt tokens on every
turn that grounds the metric.

## Consequences

- An agent computes a metric under its defining conditions and states it in its unit without a
  second fetch.
- A renderer that lists the filters one per line lets a model read them as alternatives. Both this
  server's markdown and ai-platform's text render them as one `AND` conjunction.
- Adding another metric attribute here needs the same test: it changes the number or how it is read.
  Otherwise it belongs on the metric's own page, not in the context.

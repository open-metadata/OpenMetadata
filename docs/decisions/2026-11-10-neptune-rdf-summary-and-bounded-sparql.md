# Neptune RDF discovery uses summaries and bounded SPARQL

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** venkat22
- **Guard:** `ingestion/tests/unit/topology/database/test_neptune_rdf.py`
- **Related:** #37456

## Context
Neptune supports both openCypher property graphs and RDF graphs queried with SPARQL. RDF graph-summary APIs expose classes without scanning the graph, while property discovery still needs to inspect class instances. Unbounded scans and statistics recomputation would make ingestion expensive and require write permissions.

## Decision
- Keep the existing Neptune service and default its `graphModel` to `propertyGraph`; RDF is an opt-in model so existing configurations retain their behavior.
- For RDF, read `get_rdf_graph_summary` and then run one SPARQL query per selected class. Each query samples at most the configured number of subjects (default 1,000; maximum 10,000), selects at most the configured predicate limit plus one sentinel, and sets Neptune's per-query `queryTimeout` hint. Defaults are 100 classes, 100 predicates per class, 1,000 sampled subjects, and a 30-second timeout; schema bounds cap these settings.
- Map classes to tables in the `classes` schema and predicates to columns. Convert the final `/`, `#`, or `:` IRI segment to a lowercase name, replace runs outside `[a-zA-Z0-9_]` with `_`, use `iri` for an empty name, and prefix names that do not start with a letter or `_` with `iri_`. Always append `_` and the full lowercase SHA-256 digest of the IRI so names do not change when the selected class/predicate set changes; truncate the sanitized segment to keep the result within OpenMetadata's 256-character name limit. Preserve full class and predicate IRIs in descriptions. Infer a column type only when all sampled values use one supported RDF datatype; otherwise use `UNKNOWN`. Report class/predicate truncation in ingestion status.
- If Neptune reports `StatisticsNotAvailableException`, fail with guidance about engine version and instance types. Do not trigger statistics recomputation. RDF test-connection checks perform only the graph summary and a `SELECT ... LIMIT 1`.

## Consequences
RDF discovery requires `neptune-db:GetGraphSummary` and `neptune-db:ReadDataViaQuery`, plus engine 1.2.1.0 or later and available DFE statistics. The default limits can omit classes or predicates from very large ontologies, but status warnings and configurable limits make that truncation visible. The 100-class default bounds the number of per-class SPARQL requests; increase limits only with care because each additional class incurs another request.

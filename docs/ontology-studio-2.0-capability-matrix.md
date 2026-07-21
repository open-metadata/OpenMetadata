# Ontology Studio 2.0 capability matrix

This matrix states only capabilities implemented and tested on the Ontology Studio 2.0 branch. Requirements 4.2 and 4.6–4.8 were not defined in the supplied RFP extract and are therefore not inferred here.

| Requirement | 2.0 status | Shipped evidence and boundary |
| --- | --- | --- |
| 4.1 RDF, SHACL, and SPARQL core | Full with deployment dependency | Fuseki/TDB2, authorization-safe named graphs, typed RDF health, SPARQL, 18 SHACL NodeShapes, bounded queries, and an RDF-enabled acceptance shard. RDF remains off by default. QLever is not complete. |
| 4.2 | Not assessed | Requirement wording was not supplied. |
| 4.3 OWL axioms and DL modeling | Full for the supported profile | Typed recursive axioms, restrictions, individuals, property characteristics/chains, authored annex, structural guardrails, and reasoner explanations. Unsupported imported OWL is preserved losslessly; a general-purpose OWL API and raw triple editor are not included. |
| 4.4 SKOS | Partial | Deterministic polyhierarchy, mappings, synonyms, canonical labels, parent/additional-broader preservation, and SKOS round trip are shipped. Multilingual pref/alt/hidden-label authoring is explicitly deferred. |
| 4.5 IRIs and namespaces | Full for authenticated use | Governed base IRIs, prefix registry, minting patterns and preview, persisted term IRIs, deprecation mapping, and feature-flagged authenticated 303 LOD redirects. Anonymous public LOD is deferred. The field is `iri`, not `ciri`. |
| 4.6 | Not assessed | Requirement wording was not supplied. |
| 4.7 | Not assessed | Requirement wording was not supplied. |
| 4.8 | Not assessed | Requirement wording was not supplied. |
| 4.9 Reasoning and validation | Full for bounded/materialized operation | Durable per-rule Fuseki materialization, dirty-state invalidation, asserted/inferred controls, explanations, the 100,000-triple in-process guardrail, and `OFF`, `REPORT`, `ENFORCE_IMPORTS` SHACL modes. Relational writes remain authoritative and are not synchronously blocked by projection validation. |
| 4.10 RDF interchange | Full for supported serializations | Deterministic dry-run/commit import and lossless export for Turtle, RDF/XML, N-Triples, and safe JSON-LD; annex-backed round trip and OWL-aware diff. OWL-XML requires external conversion. |
| 4.11 bulk template editing | Full | Typed QTT-style CSV template, create/update/retype/find-replace validation, dry-run results, atomic change sets, and background jobs above 500 rows. |
| 4.12 hierarchy visualization | Full | Graph and keyboard-accessible tree surfaces, polyhierarchy, lazy expansion, model/data modes, bounded slices, search/dim, and data-asset pagination. |
| 4.13 search and SPARQL | Full | Scoped console, server-backed saved/sample queries, typed visual builder with visible SPARQL, table/subgraph results, semantic search, and admin-only full-KG escape hatch. |
| 4.14 collaboration and RBAC | Full | Existing glossary permissions/workflows plus scoped query datasets, route visibility, cross-glossary authorization, database edit leases, draft/approval status, and read-only inference. |
| 4.15 versioning and provenance | Full | Stable relationship identity, entity versions, field changes, ChangeEvents, creator/time/provenance, immutable annex revisions, pack provenance, OWL-aware RDF diff, and structural diff/merge. |
| 4.16 API and SPARQL endpoint | Full on merge | Generated public contracts, Java SDK services, ontology REST groups, scoped and admin SPARQL, ontology ChangeEvents, and the five knowledge-graph MCP tools. These are branch-local until this work is merged into the release branch. |
| 4.17 L1–L3 layering | Full | Persisted glossary modules, cycle-free same/foundational imports, L1→L3 rejection, prefixes/base IRIs, side-by-side models, subsets, patterns, and structural merge. |
| NFR-5 round-trip conformance | Full for the pinned corpus | Deterministic blank-node canonicalization, construct-level fidelity accounting, idempotent re-import, annex preservation, RDF-disabled behavior, and PostgreSQL + Fuseki Playwright coverage. External-tool certification is not claimed. |

## Release conditions

“Full” assumes the 2.0 database migration has completed. RDF-dependent rows also assume the Fuseki deployment profile is enabled, healthy, and rebuilt after upgrade. Manual modeling, governance, import/export, versioning, packs, and bulk authoring do not require Fuseki.

The optional AI layer is outside requirements 4.1–4.17. It is shipped behind `RDF_ASK_COLLATE_ENABLED=false` by default and can only produce typed proposals or draft changes.

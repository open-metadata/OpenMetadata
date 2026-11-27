# Symmetric RDF inverse partners remain separate relationship types

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** GlossaryRdfImportIT#importKeepsNamedPartnerEdgesWhenInverseIsSymmetric and GlossaryRdfImporterTest#symmetricPropertyKeepsSelfInverseEvenWhenNamedInverseIsDeclared
- **Related:** #38042, #38069, #38147; ADR:2026-10-21-native-relations-instantiate-registry-relationship-types

## Context

For symmetric A, `A owl:inverseOf B` implies that A and B have the same extension in OWL. OpenMetadata preserves the authored relationship type as a governed registry identity. Linking B to self-inverse A makes UUID canonicalization return A for some edges authored as B.

## Decision

Glossary RDF import keeps every explicitly symmetric type self-inverse. When only A is declared symmetric, B remains a separate registered type with no inverse; the importer neither marks B symmetric nor aliases its identity to A. Edges authored as B therefore read as B from both ends. This expected shape produces no conflict message. Previously imported relationship definitions are not rewritten.

## Consequences

Both authored predicate names remain stable across UUID orderings without inventing a new symmetry characteristic or replacing a governed type. This chooses identity preservation over materializing OWL equivalence as a registry alias. A future equivalence/alias model would need an explicit representation before this decision can change.

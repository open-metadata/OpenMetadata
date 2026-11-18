# RDF import preserves governed predicates and validates inverse components before registration

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** GlossaryRdfImportIT#importReusesTheGovernedNameOfAnAuthoredPredicate; GlossaryRdfImportIT#importSkipsInvalidInversePairWithoutSavingEitherHalf; GlossaryRdfImportIT#importDoesNotRejectAValidPairForAnUnwiredInvalidDeclaration; GlossaryRdfImportConcurrencyIT
- **Related:** #38042, #38069, #38147; ADR:2026-11-18-rdf-import-symmetric-inverse-partners-stay-unlinked

## Context

A predicate can already have a governed name different from its IRI local name, or appear in multiple slots of one import. Saving definitions individually before validating their partners can leave a half-saved pair. Existing definitions may also change while the import is planned.

## Decision

Use RDF predicate identity for both authored edges and inverse targets. Reuse the governing registry type or an already planned type with that predicate; do not create an alias from another local name. Edges use the resolved governed name.

Validate every new definition before saving any. Dry runs use the same read-only preparation and accepted-name set. A validation failure skips all new members actually connected by wired inverse references, cancels their pending existing-partner updates, and names every skipped member in messages. A rejected inverse declaration is not a connection to an otherwise valid component. Other valid definitions can import. The import returns HTTP 200 with skips and accurate counts rather than failing the whole import with HTTP 400.

Refresh existing partners before publishing new types and before completing a partner. Keep a concurrent claim or edit that wins the version comparison, and clear the new type’s inverse before adding its edges. A partner-completion validation failure likewise clears the new inverse and reports the skipped update. Use EntityRepository.updateIfCurrent on an unchanged original and a copy so a stale update cannot overwrite a newer version.

## Consequences

Governed identities and definitions survive import, while invalid or losing pairs cannot publish the observed dangling/asymmetric references. This is not a transaction over all definitions. A same-user PATCH consolidated in-session can keep its version, so the repository’s version comparison does not detect every such edit. Previously stored definitions are not deleted when an imported component is rejected. No migration or schema change is required.

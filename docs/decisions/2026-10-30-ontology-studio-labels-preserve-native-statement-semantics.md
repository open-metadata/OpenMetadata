# Ontology Studio labels preserve native statement semantics

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Ontology Studio maintainers, following the requested native authoring and publication scope
- **Guard:** OntologyAxiomEditor tests, OntologyAuthoringSafety.spec.ts, reviewer
- **Related:** ADR:2026-10-14-ontology-releases-seal-canonical-sql-members; ADR:2026-10-17-glossaries-do-not-own-ontology-models

## Context

The v7 prototype is a visual and interaction reference. Its constraint names do not all
mean the same thing as the native OWL statements already stored by OpenMetadata.
Treating every prototype difference as a required feature would change saved meaning
and the independent release approval contract.

## Decision

Studio describes the six existing statement types directly: subclass, equivalent
class, disjoint classes, class membership, object-property fact and data-property
fact. Class restrictions remain expressions within class statements. A data-property
fact describes an individual; disjointness declares that classes share no instances.
Neither is relabeled as a universal property constraint or conflict resolution.
Existing records keep their API types and semantics. SKOS mappings remain separate
from OWL class equivalence.

The editor shows structural profile validation as structural validation. It does not
claim logical consistency or source-data validity. Publication continues to capture
immutable SQL releases and require independent review before activation.

Classic and AI-mode layouts share these controls in OpenMetadata. Collate owns AI
activation and integrations. UI layout is not an authorization or publication boundary.

Local IRI suggestions search the already bounded Studio model, display at most 50
matching options to keep the menu usable, and retain raw IRI entry for external
references. Filtering searches the whole loaded model before limiting the menu.

## Consequences

The UI can improve wording, spacing, previews and edit protection without rewriting
stored meaning or importing prototype-only lifecycle rules. New reasoning, datatype
facets, quick-rule languages and semantic mappings require their own supported native
contracts. The v7 gap disposition is recorded with the consolidated implementation plan.

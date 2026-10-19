# Memories become Draft glossary terms through the AI provider

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `MemoryGlossaryDerivationQueueTest`, `MemoryGlossaryDerivationJobHandlerTest`, `GlossaryTermAutomationDraftIT`, `GlossaryAiGeneratedTerm.spec.ts`
- **Related:** ADR:2026-10-17-glossaries-do-not-own-ontology-models, ADR:2026-10-16-ontology-ai-proposal-review-is-a-collate-extension

## Context

Deriving glossary content from Context Center memories ran in OpenMetadata as an Ontology AI
feature: an LLM gateway proposed Ontology Studio change sets, gated by RDF AI, the LLM switch and
`llmConfiguration.ontologyMemoryDerivationEnabled`. Ontologies now have their own native model, so
a memory no longer feeds ontology modeling; it defines business vocabulary. The agent that does
this well runs in Collate's AI platform, not in OpenMetadata.

## Decision

OpenMetadata derives nothing itself. `AiProvider.memoryGlossaryDeriver()` returns a
`MemoryGlossaryDeriver` only when the configured provider ships one (Collate's does; the built-in
one does not), and that is the whole gate: there is no configuration flag. When a memory becomes
published (Approved and shared with an entity or the public) and has no derived glossary term,
OpenMetadata queues a `MEMORY_GLOSSARY_DERIVATION` job, batching memories of one source for 30
seconds, and the job hands the still-eligible memories to the deriver.

A derived term has the `automation` provider and a `glossaryTerm -DERIVED_FROM-> contextMemory`
relationship, which the memory reads back as `derivedEntities` and Context Center shows as its
Derived Term. The term gains no field. An automation-provided term starts in Draft, and because a
bot's write never starts the approval workflow, people decide it directly: its reviewers when it
has any, otherwise anyone who can edit it. Until it is approved the glossary UI marks it as AI
generated.

## Consequences

The Ontology AI memory endpoints, the proposal-status schema and the derivation flag are gone, and
leftover `ONTOLOGY_MEMORY_DERIVATION` jobs are deleted by the 2.1.0 migration. Collate must keep
its copy of the job type enum in step with this one. A person editing an AI draft without
approving it still triggers the glossary workflow, which approves it when the glossary has no
reviewers, as for any other Draft term. Bringing derivation back to OpenMetadata means giving the
built-in provider a deriver, not a new switch.

Context Center no longer links memory-sourced Studio drafts (`?draft=`); native memory drafts are
reviewed from Ontology Studio's memory review panel. This revises that part of
ADR:2026-10-16-native-ontologies-share-studio-and-memory-review.

# Memories become Draft glossary terms through the AI provider

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial); v2 2026-10-20 (only memories every reader may see; only bots mark automation terms and never decide them)
- **Deciders:** Pere Miquel Brull
- **Guard:** `MemoryGlossaryDerivationQueueTest`, `MemoryGlossaryDerivationJobHandlerTest`, `MemoryDerivationsTest`, `GlossaryTermAutomationDraftIT`, `MemoryDerivationIT`, `GlossaryAiGeneratedTerm.spec.ts`
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
seconds, and the job hands the deriver the still-eligible memories that every glossary reader may
see: unanchored, or anchored to a file shared with the whole organization. Every reader sees a
derived term and the agent's reasons quote the memory, so a memory anchored to an asset or to a
file shared with only some people defines no term.

A derived term has the `automation` provider and a `glossaryTerm -DERIVED_FROM-> contextMemory`
relationship, which the memory reads back as `derivedEntities` and Context Center shows as its
Derived Term. The term gains no field: the deriver writes the link through
`MemoryDerivations.record`, which keeps the agent's evidence (its name, confidence, up to three
reasons and when it derived the term) as the relationship's JSON, the `derivationEvidence` of
`entity/context/memoryDerivation.json`. `GET /v1/contextCenter/memories/derivations` reads it
back for at most 100 entities at a time, and only through memories the caller may see, because the
reasons quote the memory.

An automation-provided term starts in Draft, and because a bot's write never starts the approval
workflow, people decide it directly: its reviewers when it has any, otherwise anyone who can edit
it. A bot never decides one, and the workflow still moves one that a person's edit sends to review.
Only a bot can say an automation provides a term: a person's create that asks for it is written as
theirs, and a person's PATCH that changes it is refused. The glossary pages review it like any proposal: the terms table marks AI and people proposals
(Draft or In Review terms) apart, a Pending review panel heads the right column of the Terms and
Overview tabs with the agent's evidence and Approve, Edit and Reject, and the left list counts the
proposals of each glossary. A person's proposal is decided through its approval request, as
before.

## Consequences

The Pending review panel is a page widget (`KnowledgePanel.PendingReview`) in the default glossary
and term layouts, so a persona that saved its own layout before this change does not show it until
the layout adds it from the widget list. Editing an AI draft runs the glossary workflow like any
edit of a Draft term: it approves the term when the editor is a reviewer or the glossary has no
reviewers, so the panel's Edit acts as edit-and-approve for whoever may decide, and otherwise sends
the term to its reviewers with an approval request.

The Ontology AI memory endpoints, the proposal-status schema and the derivation flag are gone, and
leftover `ONTOLOGY_MEMORY_DERIVATION` jobs are deleted by the 2.1.0 migration. Collate must keep
its copy of the job type enum in step with this one. Bringing derivation back to OpenMetadata
means giving the built-in provider a deriver, not a new switch.

Context Center no longer links memory-sourced Studio drafts (`?draft=`); native memory drafts are
reviewed from Ontology Studio's memory review panel. This revises that part of
ADR:2026-10-16-native-ontologies-share-studio-and-memory-review.

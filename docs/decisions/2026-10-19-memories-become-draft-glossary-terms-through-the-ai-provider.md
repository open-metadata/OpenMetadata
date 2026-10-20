# Memories become Draft glossary terms through the AI provider

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial); v2 2026-10-20 (organization-wide sharing; only bots mark automation terms and never decide them); v3 2026-10-20 (publishing vocabulary gives it independent access; discard stale proposals); v4 2026-10-20 (memory extraction's switches gate derivation; article anchors publish; the review queue pages on the server)
- **Deciders:** Pere Miquel Brull
- **Guard:** `MemoryGlossaryDerivationQueueTest`, `MemoryGlossaryDerivationJobHandlerTest`, `MemoryDerivationsTest`, `ContextMemoryDerivationIT`, `GlossaryTermAutomationDraftIT`, `MemoryDerivationIT`, `useGlossaryProposals.test.tsx`, `PendingReviewPanel.test.tsx`, `GlossaryAiGeneratedTerm.spec.ts`
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
one does not). Derivation has no flag of its own: it runs while memory extraction does, so the
switches that turn extraction off (`LLM_ENABLED`, `LLM_MEMORY_EXTRACTION_ENABLED`) turn it off too,
and nothing is queued meanwhile. When a memory becomes
published (Approved and shared with an entity or the public) and has no derived glossary term,
OpenMetadata queues a `MEMORY_GLOSSARY_DERIVATION` job, batching memories of one source for 30
seconds, and the job hands the deriver memories whose sharing still permits organization-wide
publication: unanchored, anchored to a Context Center article that still exists, which has no
sharing of its own, or anchored to a file shared with the whole organization. A memory anchored to
an asset or to a file shared with only some people defines no term.

Publishing an approved, organization-wide memory also publishes its business vocabulary. A
derived glossary definition has its own glossary permissions from Draft onward; it does not
inherit policies that restrict the source memory. This is an intentional publication boundary,
not an extension of access to the memory itself. The original memory and the agent's evidence
continue to require the caller's memory permissions, including policy checks. A change to the
memory's content, status or sharing while the agent is working invalidates that proposed result.

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
before. The Terms tab shows how many terms wait for review as a purple count after its own.

The panel reads its queue a page at a time rather than loading every pending term:
`GET /v1/glossaryTerms/search` filters by `provider` or `excludeProvider` (an unknown provider is a
bad request) and returns exact totals, so a page holds AI proposals first, then people's. A listed
term carries the reviewers it inherits, as a single read of it does, so the panel knows who decides
it, and a change of stage drops the cached listing totals, so the counts follow each decision.
The page's approval requests use `GET /v1/tasks?aboutEntityIds=...`, which matches entity UUIDs
exactly. FQN prefix filters would also read descendants' requests and confuse names containing
commas with a list of names.

## Consequences

The Pending review panel is a page widget (`KnowledgePanel.PendingReview`) in the default glossary
and term layouts, so a persona that saved its own layout before this change does not show it until
the layout adds it from the widget list. Editing an AI draft runs the glossary workflow like any
edit of a Draft term: it approves the term when the editor is a reviewer or the glossary has no
reviewers, so the panel's Edit acts as edit-and-approve for whoever may decide, and otherwise sends
the term to its reviewers with an approval request.

Switching memory extraction off also stops derivation from memories people write themselves; a
deployment that wants terms from curated memories keeps extraction on.

The Ontology AI memory endpoints, the proposal-status schema and the derivation flag are gone.
The former job type was never released, so replacing it requires no data migration. Collate must
keep its copy of the job type enum in step with this one. Bringing derivation back to OpenMetadata
means giving the built-in provider a deriver, not a new switch.

Context Center no longer links memory-sourced Studio drafts (`?draft=`); native memory drafts are
reviewed from Ontology Studio's memory review panel. This revises that part of
ADR:2026-10-16-native-ontologies-share-studio-and-memory-review.

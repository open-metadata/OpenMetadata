# Only Approved glossary terms and metrics reach AI context as governed knowledge

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `GovernedDefinitionTest`
- **Related:** ADR:2026-10-19-memories-become-draft-glossary-terms-through-the-ai-provider

## Context

Release testing saw Chat answer from an In Review glossary term and call it "the governed glossary
definition". AI context already dropped unapproved glossary terms from attached knowledge and from
search-found context, but let metrics of any stage through, and built concept context for any term
or metric. The AI platform renders all three as governed definitions, and their payloads carry no
stage it could check.

## Decision

A glossary term or metric is governed knowledge only when its `entityStatus` is Approved or unset
(no review workflow applies). Attached knowledge (`PersonaContextBuilder.fullKnowledgeItem`),
search-found context (`AIContextFinder.isApprovedForContext`), column glossary terms, the metrics
applied or related to an anchor (`AIContextBuilder.metricKnowledgeItem`), and concept context with
the metric definition built from it (`AIContextBuilder.hasConceptContext`) skip any other stage;
articles keep their existing rule.

"Unset" is the entity's stage, never a search hit's. Vector chunk docs carry no `entityStatus`, so
search-found context reads the stage of a term or metric hit that has none from the entity, once per
entity per request, and drops the hit when the entity cannot be read.

## Consequences

A Draft, In Review, Rejected, Deprecated or Archived definition never reaches AI context as
governed knowledge; asking about one anchored gets no concept context or metric definition. Entity details still return it, with its stage, for an answer that names it. A concept read of
an unapproved term or metric returns its description without concept context and without a stage;
the AI platform reads the stage itself and keeps such a concept unresolved (its record
an-unapproved-definition-is-named-as-a-proposal). Attached knowledge now admits
a term with no stage, as the other paths already did.

Search pays one cached entity read per term or metric whose hit carries no stage. Stamping the
stage on chunk docs instead would bump `CHUNK_DOC_VERSION`, restamping every chunk set in the
catalog on the next reindex, and the restamp check would have to track a stage the fingerprint does
not cover; until that backfill ran, the read would be needed anyway.

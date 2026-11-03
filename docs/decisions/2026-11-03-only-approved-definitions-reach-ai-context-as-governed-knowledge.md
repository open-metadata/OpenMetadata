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
search-found context (`AIContextFinder.isApprovedForContext`), column glossary terms, and concept
context with the metric definition built from it (`AIContextBuilder.hasConceptContext`) skip any
other stage; articles keep their existing rule.

## Consequences

A Draft, In Review, Rejected, Deprecated or Archived definition never reaches AI context as
governed knowledge; asking about one anchored gets no concept context or metric definition. Entity
details still return it, with its stage, for an answer that names it. Attached knowledge now admits
a term with no stage, as the other paths already did.

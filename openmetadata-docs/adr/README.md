# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the OpenMetadata project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## When to Create an ADR?

Create an ADR when making significant architectural decisions such as:

- Adding new services or components
- Choosing between architectural patterns
- Selecting core technologies or frameworks
- Changing fundamental system design
- Making security or performance trade-offs
- Establishing development standards

## ADR Format

Each ADR should follow this structure:

1. **Title**: Brief description of the decision (e.g., "Use React for Frontend")
2. **Date**: When the decision was made
3. **Status**: Proposed, Accepted, Deprecated, Superseded
4. **Context**: What is the issue we're addressing?
5. **Decision**: What decision are we making?
6. **Consequences**: What are the positive and negative outcomes?
7. **Alternatives Considered**: What other options were evaluated?

## Naming Convention

ADRs are numbered sequentially:
- `ADR-0001-description.md`
- `ADR-0002-description.md`
- etc.

## Creating a New ADR

1. Copy the most recent ADR as a template
2. Increment the number
3. Update the title, date, and content
4. Submit as part of your PR
5. Request review from architecture team

## ADR Lifecycle

- **Proposed**: Initial draft, under discussion
- **Accepted**: Decision approved and being implemented
- **Deprecated**: No longer applies, but kept for historical reference
- **Superseded**: Replaced by a newer ADR (link to the new one)

## Existing ADRs

- [ADR-0001: ThirdEye Analytics Service as Internal Microservice](./ADR-0001-thirdeye-service.md)

---

For more information on ADRs, see:
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub Organization](https://adr.github.io/)


# Ontology AI proposal review is a Collate extension of the Studio canvas

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Anuj Kumar Yadav, Karan Hotchandani
- **Guard:** `OntologyExplorer.test.tsx` ("OntologyExplorer AI proposals extension"), reviewer
- **Related:** #35655, #35656, Collate `OntologyExplorerClassCollate`

## Context

Ontology AI (Ask Collate memories and governance agents) writes proposed concepts and relationships
as DRAFT ontology change sets. Reviewing them on the Ontology Studio canvas — the purple proposed
nodes and edges, the proposal bar, the AI proposals drawer and its Ontology health entry — was first
built in OSS, but the AI that produces the proposals runs only in Collate.

## Decision

OSS ships no proposal review. `OntologyExplorer` asks `OntologyExplorerClassBase.getAiProposalsHook()`
for a hook that returns the proposed nodes and edges to draw, the proposal under review, a canvas
overlay, a drawer and an Ontology health entry; the OSS hook returns none of them. Collate's
`OntologyExplorerClassCollate` returns the real hook, with the proposal logic, components and
strings living in Collate.

OSS keeps only what any extension needs: the `proposal` reference on graph nodes and edges, their
canvas styling, routing a click on a proposal to `openProposal`, refusing a relationship drawn to a
proposed concept, and keying a proposed edge by its operation so it never collides with a live one.
The hook's types live in `OntologyExplorerClassBase.interface.ts`, because Collate's build swaps
every `*ClassBase` import for its override.

## Consequences

Proposal UI, its strings and its tests are added in Collate, not here. The hook's contract —
one stable `(OntologyAiProposalsOptions) => OntologyAiProposals` — is shared by both repositories,
so changing either interface needs a paired Collate change, and the OSS change merges before the
Collate override that depends on it. Bringing review back to OSS would mean making the AI that
produces proposals available in OSS first.

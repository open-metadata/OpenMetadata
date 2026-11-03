# Relations Graph nodes that truncate their label grow to fit it, up to 200px

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#36053

## Context

The Relations Graph (Ontology Explorer) capped every model-view node at `MODEL_NODE_MAX_WIDTH`
(150px), so common two-word glossary terms such as "Churned Customer" rendered as
"Churned Custo…". Ontology Studio uses the same constant as its fixed node width, and its layout
(`STUDIO_NODE_WIDTH`) spaces nodes on that assumption, so raising the shared cap would have
overlapped Studio nodes.

## Decision

- Nodes that size to their label (model view, and data-view nodes that are not assets) grow to fit
  the label up to `MODEL_NODE_MAX_LABEL_WIDTH` = **200px**, then truncate.
- Ontology Studio nodes keep the fixed `MODEL_NODE_MAX_WIDTH` (150px).
- Layouts that place these nodes space them by the widest node actually present
  (`getMaxNodeWidth` in `useOntologyGraph.ts`, `computeTermLabelHSpacing` for grouped terms), never
  by the base `NODE_WIDTH`, so wider labels do not overlap.

200px fits typical two- and three-word business terms at the graph's label size while keeping a
dense graph readable; longer names still truncate.

## Consequences

- Changing either constant must keep the layouts width-aware: any new row, grid or ring placement
  in the explorer must read node widths rather than assume `NODE_WIDTH`.
- Studio and the explorer can show the same term at different widths; that is intended.

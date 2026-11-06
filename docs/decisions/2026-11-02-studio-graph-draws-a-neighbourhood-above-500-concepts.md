# The Studio graph draws a neighbourhood above 500 concepts

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Ontology Studio program
- **Guard:** `studioFocusedGraph.test.ts`, `OntologyGraphView.test.tsx` ("above the node limit"), `OntologyLargeGraph.spec.ts`
- **Related:** ADR:2026-10-24-ontology-studio-bounds-tree-windows-and-count-workers

## Context
The Studio graph drew a 400-concept ontology as a blank canvas. On the QA stack the four-ary
hierarchy laid out as one column, with node y coordinates from 400 to 43,689 px, and **Fit** scaled
it to a sliver. The same ontology listed all 400 concepts in Tree in under 100 ms. The layout now
folds crowded ranks to the viewport's shape and fits on load, so 400 concepts render and fit. The
perf check for that change measured 400 concepts only, against two limits: the first visible node
within 3 seconds, and a zoom frame p95 under 50 ms. Its report says both passed and does not keep
the measured values.

Past some size, **Fit** shrinks every label below legibility, whatever the layout does. Nothing
measured where that size is, so the three numbers below are judgment calls. 500 sits above 400,
the largest size measured to render and fit. The cap of 120 concepts and the depth of two hops have
no measurement behind them either.

## Decision
These constants live in `OntologyExplorer.constants.ts`, and `buildStudioGraphScope` in
`utils/studioFocusedGraph.ts` applies them to the loaded graph.

- `STUDIO_GRAPH_NODE_LIMIT = 500`. At 500 concepts or fewer, the graph draws the whole ontology.
- Above 500, the graph is focused. Its seeds are the selected concept and the Find matches, which
  `rankConceptMatches` caps at `CONCEPT_SEARCH_RESULT_LIMIT = 8`.
- The scope takes the seeds, then follows relations in both directions for
  `STUDIO_FOCUS_DEPTH = 2` hops, visiting neighbours in label order. It stops adding concepts at
  `STUDIO_FOCUS_NODE_CAP = 120`. It draws only the relations whose two ends are both in the scope.
- With no seed, the canvas is not mounted. The graph area shows only the message "This ontology
  has {{total}} concepts, too many to draw at once. Select a concept in Tree, or use Find, to see
  it with its neighbours." (`message.ontology-graph-too-large`). When the page offers Tree
  (`onRequestTreeSurface`), the message carries an **Open Tree** button.
- With seeds, the canvas draws the scope under the notice "Showing {{shown}} of {{total}}
  concepts around your selection. Open Tree to browse all of them, or use Find to look at another
  concept." (`message.ontology-graph-focused`) and the same button.
- Tree does not use these numbers. Its window is 2,048 placements
  (ADR:2026-10-24-ontology-studio-bounds-tree-windows-and-count-workers).

## Consequences
A user who opens an ontology of 501 concepts or more sees no graph until they select a concept or
search for one. Tree and Find reach every concept. **Fit** and zoom work on the scope only.
`OntologyLargeGraph.spec.ts` hard-codes `NODE_LIMIT = 500` and a drawn count of at most 120, so a
change to either constant changes that spec in the same commit. Revisit the numbers when label
size after **Fit** is measured at 500, 1,000 and 2,000 concepts, or when the layout changes.

# Native Studio: one consolidated correctness and usability PR

User direction, 2026-10-30: deliver one OpenMetadata PR, not the v7 PR stack.
Use the prototype for styling, alignment and interaction guidance; native ontology
building and publishing determine functionality. Shared classic and AI-mode UI
belongs in OpenMetadata. Collate enables AI mode and owns AI-specific integrations.

This supersedes the execution order and blanket prototype-parity recommendations
in the saved v7 gap analysis; its evidence remains useful. No automatic remapping
of saved axioms, approval bypass, new reasoner, release mutation, or glossary model.

## Scope and implementation

1. Retain and reverify the existing CI fixes (owner references, server-default
   reconciliation, class axiom payloads and reliable Playwright interactions).
2. Correct authoring semantics and feedback in `OntologyAxiomEditor`, its utilities
   and `OntologyExpressionEditor`: truthful labels/help, preserved compatible
   expressions when switching type, readable previews in both modes, concept and
   property selection, correctly scoped validation state. Preserve individual
   assertions and existing expression payloads; never reinterpret SKOS mappings as
   OWL equivalence. Unsupported datatype facets remain unavailable.
3. Protect edits across native Studio selections and navigation. Reuse existing
   form state and confirmation primitives in the concept/property/axiom/settings
   editors, new-class flow and their workspace/page boundaries. Confirm asset
   unlinking before writing and retain revision checks and failure feedback.
4. Complete the existing publication workflow in both modes: reviewer configuration,
   approval state, rejection reason/task navigation, honest structural-versus-logical
   validation, release comparison and consistent export access. Reuse release APIs
   and components. A captured release remains immutable; approval is independent.
5. Apply core component spacing, headings, muted help/preview cards, visible action
   states and responsive layout to these workflows. Exercise classic and AI mode.
6. Run affected Jest, type/lint/build checks and real Playwright authoring/publication
   flows. Review the final diff, prepare one PR with verification and UI recording.

## Gap dispositions

“Address” below refers to the native need, not every bundled prototype detail.

| Gaps | Native disposition |
| --- | --- |
| AUTH-1 | A second quick-rule editor is optional; make the existing typed editor understandable. |
| AUTH-2, AUTH-4, AUTH-5, AUTH-9 | Address selection, property-aware entry, explanation, preview and compatible type transitions; no unsupported facets. |
| AUTH-3 | Preserve supported expression shapes and nesting; do not impose prototype-only limits. |
| AUTH-6, AUTH-7, AUTH-11, AUTH-12, AUTH-22 | Address accurate validation feedback; structural checks are not logical consistency. No speculative publish gate based on a partial reasoner. |
| AUTH-8 | Keep stable generated identity, avoid requiring users to understand it; retain meaningful names/descriptions. |
| AUTH-10 | Preserve edit/import round trips and statement kinds; changing their meaning is unacceptable. |
| AUTH-13 | Preserve native reference/retention semantics and explicit deletion confirmation; no automatic reparenting/cascading from the prototype. |
| AUTH-14, AUTH-15, AUTH-16 | Preserve existing native canvas/relation operations and checks; exact gesture/layout parity is not a correctness requirement. |
| AUTH-17 | Reuse native typed properties; do not silently change property domains to implement reuse. |
| AUTH-18, AUTH-20 | Address loss of unsaved edits and destructive confirmation; undo must not bypass revisions. |
| AUTH-19 | Preserve the class creation flow and separate concept-kind support; do not replace it with the smaller prototype form. |
| AUTH-21 | Tour is optional product work. |
| AUTH-23 | Preserve multiple inheritance; no conversion to the prototype's single-parent model. |
| LIFE-1, LIFE-10, LIFE-11 | Preserve release export, immutable decided releases and independent review. Improve the existing workflow's explanation and controls. |
| LIFE-2, LIFE-5, LIFE-6, LIFE-9 | Address usable release inspection/comparison and export access through existing contracts. |
| LIFE-3, LIFE-4 | Surface honest validation in the publication workflow; no invented “healthy” status or generic conflict gate. A new dashboard is optional. |
| LIFE-7, LIFE-8 | Keep revision-bound change review and explicit version choice; no unproven automatic breaking-change classification. |
| LIFE-12, LIFE-13 | Protect unsaved settings; new duplication/deletion/picker features are not implied by prototype parity. |
| LIFE-14 | Keep validated native import; per-item selection is a separate product capability, not a correctness fix. |
| LIFE-15–LIFE-19 | Keep stable IDs, native navigation and health layout; align styling where these workflows are edited. |
| QD-1–QD-6, QD-8, QD-9 | Keep native Data overview and operational metadata bindings; a focus lens, suggestions and new link filters are optional capabilities. |
| QD-7 | Address confirmation before unlinking. |
| QD-10–QD-14 | Retain current query breadth, pagination and active-release semantics; productivity additions are not required by the prototype. |
| QD-15 | Verify changed AI-mode surfaces in dark theme. |

## Verification targets

UI root: `openmetadata-ui/src/main/resources/ui/`.

- `yarn test OntologyAxiomEditor OntologyExpressionEditor OntologyConceptEditor OntologyConceptAssets OntologyReleasePanel --runInBand`
- Extend navigation and publication regression tests for the changed boundaries.
- Run the existing CI recovery suites plus native authoring, Studio and publication Playwright specs with zero retries.
- Run changed-file UI checkstyle, `yarn tsc:check`, `yarn tsc:playwright`, and `PW_E2E_BUNDLE=true yarn build`.
- Record unresolved checks explicitly. The prior whole-app type error in unchanged
  `IngestionWorkflowForm.tsx` is not evidence about a new final tree.

## Progress

- [x] Confirm user scope and repository ownership.
- [x] Reconcile key gap claims against current native code and accepted contracts.
- [x] Implement the scoped changes; final browser verification and review continue below.
- [x] Review all 57 dispositions against the native contracts and record remaining product enhancements.
- [ ] Open the consolidated PR with fresh evidence.

## Implementation evidence

The consolidated change keeps all six native statement kinds and their payloads.
It adds translated type explanations, recursive expression previews in both layouts,
local class/property selection with external IRI entry, and validation feedback tied
to the exact current form. Empty literal values remain valid. The new-class changes
also correct owner references, class-axiom payloads and server-default reconciliation
that the reported Playwright failures exposed.

Dirty concept, property, axiom, settings and new-class forms register with the page's
confirmation provider. Selection, mode/surface changes, internal links and browser
Back/Forward preserve the draft until discard is confirmed. Closing one surface does
not clear protection for another mounted form. Asset unlink confirmation captures the
binding revision, and failed writes retain feedback. The shared publication UI now
exposes reviewer configuration, rejection details/task navigation and stage actions
in AI mode as well as classic mode.

The dispositions above account for all 23 AUTH, 19 LIFE and 15 QD entries. “Preserve”
means the existing native behavior is intentional or already present; it does not mean
this PR implements every bundled acceptance check in the historical prototype plan.
The retained export and comparison flows use sealed releases and their captured base.
Quick rules, reasoner-backed conflict gates, facets, a data focus lens, tours, arbitrary
release comparison and extra import/lifecycle operations remain product work.

Local verification before the final review: 153 Jest suites / 1,580 tests passed;
11 core browser tests passed with zero retries. Later guard regressions add coverage
for nested surfaces, modified clicks and query-parameter history navigation. A stale
CI distribution lacked PR16 export code, so release/export verification was moved to
a locally built backend at `370b7162a533731e4b63d3b173b29384816d77b2`.
The PR description records the final counts, reviewed commit and recording evidence.
The whole-app type check still reports the existing RJSF validator mismatch in
`IngestionWorkflowForm.tsx:413`; the Playwright type check passes.

# Binding a table's columns shows each suggested property, and keeps every binding the step does not show

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OntologyColumnMappingStep.test.tsx`; `OntologyBindingSuggestion.utils.test.ts`; `dataColumnLayout.test.ts`; `OntologyNativeDataMode.spec.ts` ("Binding a table suggests a property for each of its columns"); `OntologyNativeDataColumns.spec.ts`
- **Related:** PR #36868, ADR:2026-10-30-data-mode-asset-rows-are-styled-at-the-call-site-until-core-ships-a-list-row-button

## Context
The v7 prototype asks Data mode to suggest a property when a column is bound. It builds a "Bind
columns to <concept>'s properties" step for that, but the step sits behind `if (false)` in the
prototype's source and never shows. The prototype's live path is its column picker, which binds each
picked column to the property its name suggests, with no review. A wrong guess is then saved
without the user seeing it.

A table's column bindings are written with one revision-checked `replaceAsset`, which replaces the
asset's whole column list. A save that builds that list only from the rows on screen deletes every
binding the screen does not show.

## Decision
- Linking a table, or pressing **Bind columns** on a table already linked, opens a step that lists
  the table's columns. Each row has a checkbox and a property select, pre-filled by
  `suggestPropertyForColumn` and marked "Suggested". A column already bound shows its binding. The
  user can change or uncheck any row, or skip the step. Nothing is bound without being shown.
- A save writes each table's existing bindings, minus the one binding each visible row shows (a
  column's first resolved binding), plus each checked row. Unresolved bindings, a column's second
  and later bindings, and bindings on columns the step does not list are written back unchanged.
- A table whose columns failed to load is never written. The step shows the error with Retry.
- The step lists up to 1000 columns per table and says so when it cuts a list.
- The Data canvas draws a table's bound columns as nodes only after its column toggle is opened, as
  the prototype does. It shows 5 per table, then a "Show N more" node. The prototype has no cap.
  5 keeps a 100-asset canvas readable.

## Consequences
Binding takes one more screen than the prototype's picker, and **Skip** keeps the link-only path.
A column's extra bindings show as a count on its row and are edited elsewhere. A new caller of
`replaceAsset` that edits part of a table's bindings must start from the existing list in the same
way.

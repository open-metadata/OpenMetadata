# Downstream builds add an action to a failed test connection or agent run

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Ayush Shah
- **Guard:** `TestConnectionModal.test.tsx` (failure action describe block),
  `RunHistoryDrawer.test.tsx` (run action describe block),
  `ConnectionServiceDetailsPage.test.tsx` (`SERVICE_DETAILS_TEST_CONNECTION_ACTIONS` describe block)
- **Related:** open-metadata/ai-platform#1085

## Context
Collate adds a "Diagnose with AI" button to a test connection that did not pass and to a failed
agent run. The button opens Collate's chat drawer, and that drawer is mounted only on the
connection details page, by its `SERVICE_DETAILS_FOOTER` contribution. `TestConnection`,
`MetadataAgentsView` and `RunHistoryDrawer` also render on the classic service page and in the
add and edit service forms, where nothing would open. A contribution every consumer reads would
show a button there that does nothing.

## Decision
- Test connection: the extension point id is `service-details.test-connection.actions`
  (`EXTENSION_POINTS.SERVICE_DETAILS_TEST_CONNECTION_ACTIONS`). A contribution is a
  `TestConnectionActionContribution`: `key` and a `component` that receives
  `TestConnectionActionProps`, the page context plus `failure` and `onClose`.
- Only `ConnectionServiceDetailsPage` reads that point. It hands the contributions to
  `TestConnection` as `renderFailureAction`; other callers of `TestConnection` pass nothing.
- `TestConnectionModal` renders the action whenever the test finished and did not fully pass: the
  connection gate failed, a required check failed, only optional checks failed, or the test timed
  out. Never while testing or after a full pass.
- `failure` is the raw log the "Copy log" button copies. When the test produced no step log
  (a timeout, or an API error before any step ran), it is the error or timeout text the dialog
  shows instead.
- `onClose` closes the test connection dialog, so a plugin can open its own overlay without it
  stacking behind the dialog.
- Agent runs: no extension point. A caller that owns the view passes
  `renderRunAction(agent, run, onClose)` to `MetadataAgentsView`, which hands it to
  `RunHistoryDrawer`. The drawer renders it beside the selected run's status badge when the run
  is `failed` or `partial`. The classic `Ingestion` page passes nothing.

## Consequences
A plugin can attach an action to a failure without OSS knowing what the action does, and only
where the plugin's own UI can respond to it. Showing the action on the classic page or in the
service forms means having those consumers read the point too, and the plugin must then work
without the connection page's footer. Renaming the id or changing what `failure` carries breaks
downstream builds silently, so change them only with the consumers.

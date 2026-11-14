# The Total Data Assets, My Tasks and Pipeline Status topic cards live on the retired widget keys

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `CustomizeMyDataPageWidgetUtils.test.ts` (no registry key prefixes another),
  `CustomizeMyDataPageClassBase.test.ts` (nothing the registry renders is excluded),
  Collate `CustomizeMyDataPageClassCollate.test.ts` (PipelineStatus is not excluded)
- **Related:** #34770 (persona-driven landing page)

## Context

The landing page's topic cards resolve a layout entry to a widget by **prefix**, not equality:
`isKnownMyDataWidgetKey`, `getMyDataWidgetBaseKey` and `getMyDataWidgetFromKey` all use
`startsWith`, because a picker-added instance carries a `uniqueId` suffix
(`KnowledgePanel.Domains-211`). `getExcludedWidgetFqns` is applied the same way.

#34770 retired `KnowledgePanel.TotalAssets` and `KnowledgePanel.MyTask` and listed both in
`getExcludedWidgetFqns`. Collate retired its own `KnowledgePanel.PipelineStatus` (an ingestion
widget) the same way. The three topic cards that replace them need keys. A fresh name such as
`KnowledgePanel.MyTasks` starts with the excluded `KnowledgePanel.MyTask`, so it would be
excluded from both the grid and the picker. Any new name has to avoid every retired prefix, now
and later.

## Decision

- `LandingPageWidgetKeys.TOTAL_DATA_ASSETS` (`KnowledgePanel.TotalAssets`) renders
  `TotalDataAssetsWidget`, and `MY_TASK` (`KnowledgePanel.MyTask`) renders `MyTasksWidget`. Both
  leave `getExcludedWidgetFqns`, and their seeds (`totalAssets.json`, `myTask.json`) come back.
- `LandingPageWidgetKeys.PIPELINE_STATUS` (`KnowledgePanel.PipelineStatus`) renders
  `PipelineStatusWidget` and is seeded from `pipelineStatus.json`. Collate stops excluding it.
- The rows the retired widgets left behind are **deleted, not updated**, by the existing 2.1.0
  migrations (`MyTask`, `TotalAssets` in OSS; `PipelineStatus` in 2.1.0-collate). The seed loader
  re-inserts any seeded row it cannot find on the next boot, so the row comes back with the topic
  card's name and description. This relies on migrations running before the server seeds, which
  is the existing order.
- No registry key may be a prefix of another.

## Consequences

- A persona layout saved with one of the old keys shows the replacement card again, which is
  what that user chose, instead of dropping the entry.
- Excluding a key now also excludes everything that starts with it. Before retiring a key, check
  that no live key begins with it.
- `KnowledgePanel.PipelineStatus` is a contract with Collate: Collate must not exclude it and may
  only redirect the card's footer link (`getPipelineStatusActionPath`).

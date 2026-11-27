# Observability pages use core PageLayout directly, with an isolated stacking context

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** UI team
- **Guard:** `playwright/e2e/Features/AIMode/ObservabilityLayout.spec.ts` › "the modal overlay covers the page tabs"; `AlertsPage.test.tsx`, `TestCaseDetail.test.tsx`
- **Related:** open-metadata/openmetadata-collate#8577 (Collate's copy of the shell)

## Context

The AI-mode observability pages (Data Quality, Incidents, Test Library, Alerts, Alert details, Test
case, Test suite) rendered through `ObservabilityPageShell`, a local wrapper of plain `div`s that set
the page padding, a 16px vertical content inset, the document title and an `isolation: isolate`
stacking context. Their headers were already core `PageLayout.PageHeader`. Collate kept a second copy
of the shell that rebuilt the same look on core `PageLayout` with `!` padding overrides, which the
core-component rules forbid.

## Decision

- The shell is removed. Each page renders core `PageLayout`, `PageLayout.PageHeader` (or
  `PageLayout.Header` for a custom header) and `PageLayout.Content` directly.
- Core's spacing is accepted as is: the content inset is `PageLayout.Content`'s 8px on every side,
  down from the shell's 16px vertical inset. No caller-side padding override.
- The document title stays the app's `DocumentTitle` (title-priority store, #34093), not core
  `PageLayout`'s `pageTitle`, which sets the title directly and would bypass that precedence.
- Each page keeps its own stacking context via `OBSERVABILITY_PAGE_LAYOUT_CLASS` (`tw:isolate`)
  on `PageLayout`, so the page tabs' `z-10` stays below a modal's scrim. This is stacking, not
  styling, so it is not a core-component override.

## Consequences

- Content sits 8px closer to the header and the page bottom on these pages.
- The `observability-page-shell` / `-header` / `-content` test ids are gone. Tests target the page's
  own `data-testid`, or core's default `page-layout` where the page sets none.
- A new observability page uses `PageLayout` with `OBSERVABILITY_PAGE_LAYOUT_CLASS`; it does not
  reintroduce a page wrapper.

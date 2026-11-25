# Class-base menu builders take `showModal` and never call hooks

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `ServiceDetailsPage.test.tsx` (`should build the manage menu without hooks and export through showModal`),
  `DataInsightHeader.test.tsx` (`should read the export modal hook outside the menu memo ...`),
  `DataQualityPage.test.tsx` (`should read the export modal hook outside the export button memo ...`);
  each fails on React's "Do not call Hooks" / "change in the order of Hooks" warning
- **Related:** open-metadata/OpenMetadata#35874, open-metadata/openmetadata-collate#7627

## Context

Pages build their manage-menu items and export buttons inside `useMemo`, by calling a class-base
method that Collate overrides. The menu helpers behind those methods called
`useEntityExportModalProvider()` themselves, so the hook ran inside the memo callback, and on some
pages only conditionally. The service details page logged "Do not call Hooks inside useEffect(...),
useMemo(...)" and "React has detected a change in the order of Hooks", because a memo that does
not re-run on the next render drops the hook from the page's hook order.

## Decision

- A class-base menu or extra-option builder that a page calls from a memo must not call hooks, and
  neither may any helper it calls. The page reads the hook at its top level and passes the value in.
- These signatures are the contract Collate overrides; the export-modal opener arrives as
  `showModal`:
  - `EntityUtilClassBase.getManageExtraOptions(entityType, fqn, permission, entityDetails, navigate, showModal, tab?)`
  - `DataInsightClassBase.getManageExtraOptions(showModal)`
  - `DataQualityClassBase.getExportDataQualityDashboardButton(activeTab, showModal)`
- The OpenMetadata change merges before the Collate change that adopts these signatures, because
  Collate compiles against the submodule's `main`.

## Consequences

- A builder that needs another hook value gets a new parameter, read by the page and added to the
  memo's dependencies; changing a signature above is a cross-repo change that Collate has to adopt
  in a PR of its own.
- The memo dependencies include `showModal`, which the provider keeps stable, so this adds no
  recomputation.

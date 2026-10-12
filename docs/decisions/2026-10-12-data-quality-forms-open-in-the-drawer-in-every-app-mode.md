# Data Quality test case and bundle suite forms open in the slide-out drawer in every app mode

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Vansh0310
- **Guard:** `TestCaseFormDrawer.test.tsx` (Show Hint gates the Form Hint column in the drawer); `tsc` rejects any caller still passing the removed props; merge-order review for the Collate companion
- **Related:** [OpenMetadata #35230](https://github.com/open-metadata/OpenMetadata/pull/35230), ADR:2026-10-11-migrated-antd-components-adopt-core-styling

## Context

The add/edit Test Case and Bundle Suite forms had two presentations chosen by app mode. Classic
mode opened a slide-out drawer with the full `ServiceDocPanel` beside the form; any other mode
(the AskCollate AI experience) opened a centered `AiFormModal` with a Show Hint toggle and a
per-field Form Hint column. The choice was threaded through ten call sites as `variant` /
`editVariant`, including `TestCaseTabProps`, which Collate's AI renderer sets.

## Decision

Both forms always open in the slide-out drawer (`useFormDrawerWithHook`), whatever the app mode.
The Test Case drawer shows the Show Hint toggle in its header and the Form Hint column
(`HookForm fieldDocDisplay="panel"`) in place of `ServiceDocPanel`; `showDocPanel={false}` (the
parameter-only edit) turns both off. The Bundle Suite form registers no field docs, so its drawer
has no hint.

`variant` (on `TestCaseFormDrawerProps` and `BundleSuiteFormDrawerProps`), `editVariant` (on
`DataQualityTabProps` and `TestCaseTabProps`) and `utils/DataQuality/TestCaseFormVariantUtils.ts`
are removed, not deprecated. Merge this OSS change first, then the Collate change that stops
passing those props immediately afterward. There is no compatibility phase between the two.

## Consequences

Both modes run one code path. `AiFormModal` remains only for forms that still use it
(`AlertEditModal`, `TestDefinitionForm`). Between the two merges, Collate code that still passes
`variant` / `editVariant` or imports the deleted util fails its TypeScript build, so the merges
are a coordinated window. If a mode ever needs a different presentation for these forms again,
record that as a new decision rather than restoring `variant`.

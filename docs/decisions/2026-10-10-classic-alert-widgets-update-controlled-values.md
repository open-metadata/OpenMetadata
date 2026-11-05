# Classic alert widgets update controlled values through a callback

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** Shailesh Parmar
- **Guard:** `AlertFormSourceItemSeveralSources.test.tsx`, Collate `TemplateFormItem.test.tsx`, and paired build review
- **Related:** ADR:2026-10-10-alert-widgets-use-values-and-oss-merges-before-collate

## Context

Classic Observability now uses React Hook Form and core components. Collate's notification
template widget previously wrote directly into an Ant Design form instance. The shared
notification form still has legacy form state, so exposing a particular form library would
couple downstream widgets to incompatible implementations.

## Decision

`AddAlertFormWidgetProps.values` contains the current editable subscription. A widget that
changes fields calls `onValuesChange` with a partial subscription. The owning form merges
those changes into its latest values. Read-only widgets consume `values` without invoking
the callback. `formRef` remains optional for legacy callers, and migrated widgets do not
require it.

A custom notification template is an editing draft containing `displayName`, `templateSubject`
and `templateBody`. It has no persisted template identity until the create API succeeds.
Do not require or fabricate a template `id` or `name` when updating this draft. The parent
continues to own template creation and subscription submission.

Validate OSS and Collate together. Merge the OSS Classic migration first, then its Collate
companion immediately afterward. Keep Collate's OpenMetadata submodule on main and verify
its build against merged OSS before completing the migration. Collate requires the new
callback, draft type, profiler state and core component exports.

## Consequences

Widgets share a controlled contract across form libraries. Collate's companion change is
required before its Classic template picker can write into the migrated OSS form; the
interval between merges is a coordinated integration window. This does not change the
notification template API or persisted subscription schema.

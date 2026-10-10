# Alert widgets consume form values, and the Observability migration merges OSS before Collate

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** Shailesh Parmar
- **Guard:** `AlertEditModal.component.test.tsx` and Collate `TestAlertButton.test.tsx`; paired build and merge-order review
- **Related:** [OpenMetadata #34935](https://github.com/open-metadata/OpenMetadata/issues/34935), [OpenMetadata #34936](https://github.com/open-metadata/OpenMetadata/pull/34936), [Collate #7216](https://github.com/open-metadata/openmetadata-collate/pull/7216)

## Context

The AI Observability alert form now owns its state without Ant Design. Its footer widgets are
registered through `AlertsClassBase` and implemented downstream in Collate. The previous
`TestAlertButton` read an Ant Design form instance, which the AI form can no longer provide.
The same migration removes `pipeline-actions.less`, still imported by Collate main.

## Decision

Alert footer widgets read the current `ModifiedCreateEventSubscription` through the `values`
prop of `AddAlertFormWidgetProps`. Both Classic and AI callers supply these values. They are
the current editing state, not a promise of submission validation. Widgets remain responsible
for deciding whether their operation has the fields it requires.

The AI form does not pass `formRef`. The optional `formRef` remains available to existing
Classic widgets that write into the legacy form; read-only widgets such as Collate's
`TestAlertButton` must not require it. Collate uses `values` to derive availability and the
test-notification request, including edits made after the widget first rendered.

Validate the OSS and Collate migration branches together. Merge OSS #34936 first, then Collate
#7216 immediately afterward. Keep Collate's OpenMetadata submodule branch on `main` for merge.
The Collate change consumes the new OSS widget contract and removes the deleted stylesheet
import. Do not restore the deleted stylesheet or an Ant Design form instance to bridge the two
merges.

## Consequences

Widgets can serve both form implementations without importing Ant Design or retaining a form
instance. The companion PR is required for this migration: between the merges, Collate main
has an obsolete stylesheet import and its test-alert widget still expects `formRef`. Treat
that interval as a coordinated integration window, and verify Collate against the merged OSS
main before considering the migration integrated. A future independently deployable transition
would need an explicit compatibility phase instead of this immediate merge sequence.

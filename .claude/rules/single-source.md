---
description: Single source of truth — search before creating; one component per concept, no variants
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Single source of truth

The 2026 dedup audits found dozens of near-identical components a few directories apart (24 empty
states, 17 badge/chip implementations, 5 search bars each with its own debounce, three DomainLabels).
Every one started as "quicker to write than to find". This rule makes finding mandatory.

## Before creating ANY new component

1. **Search `@openmetadata/ui-core-components` first** — `component-library.md` has the reuse table.
   If core almost fits, fix the gap **in core** (its own PR); never work around it with a local
   variant.
2. **Search this repo for the concept, not just a name**: a "status chip" may be called Badge, Pill,
   Tag, or Chip. Grep the visual concept's words and the props you need.
3. Only then create — and say in the PR why nothing existing fits. A new component with no such
   justification is a review finding.

## One component per concept — the canon

| Concept | Canonical | Never create |
|---|---|---|
| Empty/error state | ui-core `EmptyPlaceholder` (the `common/EmptyPlaceholder/*` wrappers) | per-feature `*EmptyState`, new `ErrorPlaceHolder` variants |
| Loading | `common/Loader`; ui-core `Skeleton` for layout-preserving | bespoke skeleton wrappers, hand-rolled spinners |
| Status badge/chip | ui-core `Badge`/`BadgeWithDot` + a status→colour map | new badge/pill/chip components |
| Confirm/delete dialog | `common/DeleteModal` / `Modals/ConfirmationModal` | inline Dialog compositions for yes/no |
| Modal shell | ui-core `Dialog.Header/Content/Footer` | hand-rolled headers with own close button |
| Drawer | ui-core `SlideoutMenu` | — |
| Date range | `common/DatePickerMenu` / ui-core `DateRangePicker` | hand-rolled preset pickers |
| Pagination | `usePaging` + `common/NextPrevious` | per-feature pagination |
| Search input | `common/SearchBarComponent` | per-file `<Input>` + hand-rolled debounce |
| Owner/user display | `common/OwnerLabel` / `common/ProfilePicture` | — |
| Rich text preview | one previewer (`RichTextEditorPreviewerV1`) | another `*New`/`*V2` previewer |

## Variants are forks

Never copy a component to change its behaviour somewhere else (`FooV2`, `FooNew`, `FooForBar`). Add
a prop/variant to the one component, or lift the shared part out. A `V2` is only acceptable inside
an active, ledgered migration — and the migration is not done until the old variant's importer count
is zero and the file is deleted (finish-the-flip). The audit's abandoned-flip graveyard
(`DestinationFormItemV2`, `DomainLabelNew`, the `ActivityFeedCardV2` shell) is what skipping this
step produces.

## Shared logic follows the same rule

`DateTimeUtils`/`NumberUtils`/`StringUtils`/`EntityNameUtils` cover formatting and naming;
`useClipboard`, `usePaging`, `useFqn` exist. Types come from `src/generated/**` — never hand-write
an interface in `rest/` that mirrors a schema. One `defaultFields` mechanism, not a per-file copy.

## Downstream consumers

openmetadata-collate imports this repo's sources through a generated mirror. Before deleting or
renaming an exported symbol knip calls unused, grep openmetadata-collate too — `knip.jsonc`'s ignore
list documents the known Collate-consumed keeps (`rest/index.ts`, `styles/index.ts`,
`NodeSuggestions`, `DataInsightProvider`, `useLogStream`, `AnnouncementsWidget` props type).

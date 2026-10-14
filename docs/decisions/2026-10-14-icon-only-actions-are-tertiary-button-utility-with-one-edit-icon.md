# Icon-only actions are a tertiary ButtonUtility, and editing has one icon

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `openmetadata-ui-core-components/.../components/base/buttons/button.test.tsx` (tertiary default, ref, disabled tooltip); `reviewer`
- **Related:** ADR:2026-10-13-core-icons-and-buttons-follow-the-figma-icon-spec, open-metadata/OpenMetadata#35348

## Context
ADR:2026-10-13-core-icons-and-buttons-follow-the-figma-icon-spec made `Button` and `ButtonUtility`
size and colour their own icons, but only for icons passed as a component. The app passed most
icons as sized elements (`<Edit01 size={14} />`), built icon-only actions from bare icons with
`onClick`, raw `<button>`s, core `Button`s and five pass-through wrappers, mixed bordered and
borderless icon buttons, and drew "edit" with seven different glyphs.

## Decision
- An icon-only action is a `ButtonUtility`, never an icon, `div` or `span` with a click handler, a
  raw `<button>` or a children-less `Button`. Its colour is `tertiary` (the default);
  `tertiary-destructive` only where the action was already destructive. Its `size` comes from where
  it sits: `xs` chip remove / input clear / row expander, `sm` inline section edit, `md` table-row and
  card actions, `lg` collapse, accordion, canvas controls and page-header actions. `xl` is not
  used: its padding is too heavy beside a title.
- Icons in `Button` / `ButtonUtility` are passed as component references, so the button sizes them.
- A disabled `ButtonUtility` with a tooltip stays focusable with `aria-disabled` and keeps the
  tooltip, which usually explains why it is disabled; without a tooltip it is natively disabled.
- `ButtonUtility` forwards its ref so it can be a `PopoverTrigger` / `DialogTrigger` child directly.
- Delete actions use core `Trash01` only.
- Menu and popover item icons are 20px and `text-quaternary`.
- Edit actions use core `Edit01` only. `Edit02`, `Edit03`, `Edit05`, `Pencil01`, `EditSkills` and the
  app's `edit-new*.svg`, `action-icons/edit.svg` and `ic-edit-circle.svg` are deleted. `UserEdit`
  stays: it is an icon-picker value, not an action.
- An icon that must be blue uses `utility-brand-600`.

## Consequences
Call sites no longer choose icon sizes or colours, so one change to `ButtonUtility` restyles every
icon action. The `EditIconButton` family, `WidgetActionButton`, `LineageNodeRemoveButton` and
`Modals/CloseIcon` are gone; their call sites name `ButtonUtility` directly. A bordered or filled
icon-only button needs a new record.

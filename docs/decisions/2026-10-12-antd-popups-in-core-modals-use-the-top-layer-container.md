# Antd popups inside core modals render into the top-layer container

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `openmetadata-ui/src/main/resources/ui/src/components/common/DrawerPopupContainerProvider/DrawerPopupContainerProvider.tsx`
- **Related:** open-metadata/openmetadata-collate#6895, ADR:2026-10-11-antd-imports-are-frozen-by-eslint-suppressions

## Context
The core `ModalOverlay` (react-aria) marks every element outside the open dialog `inert`,
including nodes appended to `<body>` while it is open. Antd Select, TreeSelect and DatePicker
portal their dropdowns to `<body>`, so inside a core modal those dropdowns render but cannot be
clicked. A click on them also counts as an outside click and closes a dismissable modal.

## Decision
While a core modal still hosts antd fields with popups:

- Wrap the antd content in `DrawerPopupContainerProvider`. Its `ConfigProvider` renders popups
  into a `data-react-aria-top-layer` container, which react-aria leaves interactive.
- Set `isDismissable={false}` on the modal so a click in a popup does not close it.
- Components built from `antd/lib/*` (for example `components/common/DatePicker`) do not read the
  `antd` `ConfigProvider` context. Pass the exported `getPopupContainer` to them directly.

## Consequences
Removing the provider or making such a modal dismissable breaks its dropdowns with no lint or
type error. Each modal's wrapper can go once its last antd popup field moves to core.

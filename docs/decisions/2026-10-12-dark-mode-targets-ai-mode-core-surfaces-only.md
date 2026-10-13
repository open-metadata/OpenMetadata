# Dark mode targets AI mode and core/Tailwind surfaces only

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Harshit Shah
- **Guard:** reviewer
- **Related:** ADR:2026-10-11-migrated-antd-components-adopt-core-styling, open-metadata/openmetadata-collate#7317, open-metadata/OpenMetadata#35271

## Context
Dark-mode sweeps keep finding light edges and fills on antd components (`.ant-modal-header`,
`.ant-dropdown-menu`, `.ant-select-selector`, `.ant-collapse-item`) and on classic-mode chrome
such as the classic navbar search. Antd is being removed from the codebase component by component,
and classic (non-AI) mode is not going to ship a dark theme. Dark-mode work spent on either is
deleted by the migration that follows it.

## Decision
Classic (non-AI) mode does not support dark mode, and antd-only surfaces are not themed for dark.
Dark-mode fixes target AI mode, rendered through `@openmetadata/ui-core-components` and Tailwind
(`tw:`) surfaces, plus non-antd legacy markup that AI mode renders.

- Do not add `.dark-mode` overrides, dark token swaps or `tw:dark:*` variants whose only effect is
  on an `.ant-*` selector or an antd component.
- Do not fix classic-only chrome for dark mode.
- A shared legacy LESS variable (for example `@grey-15`) may be bridged for dark when non-antd
  surfaces in AI mode use it, even though antd consumers pick the change up too.
- An antd surface that looks wrong in dark is fixed by migrating it to its core equivalent.

## Consequences
Antd screens and classic mode can look unfinished in dark until they migrate; that is accepted.
Dark-mode PRs stay small and their fixes survive the antd removal. Revisit if classic mode is
kept and given a dark theme, or if the antd removal stops before the remaining surfaces are migrated.

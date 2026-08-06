# <AntdComponent> → <CoreComponent> mapping guide

**Sweep status:** ledger row `<component>`
**Core component:** `@openmetadata/ui-core-components` → `<import path>`
**Codemod:** `tooling/antd-codemods/transforms/<name>.js` (or "manual — no codemod")

## Import

| Before | After |
|---|---|
| `import { X } from 'antd';` | `import { Y } from '@openmetadata/ui-core-components';` |

## Prop mapping

| antd prop (as used in repo) | core equivalent | notes |
|---|---|---|
| | | |

## No direct equivalent — do this instead

| antd usage | replacement pattern |
|---|---|
| | |

## Before / after examples

<!-- 2–3 real examples lifted from the codebase -->

## CSS to delete with this sweep

<!-- .ant-* override selectors and component .less files this sweep orphans -->

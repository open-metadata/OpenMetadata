---
description: Page scaffold canon — the sanctioned layouts, headers and tabs
paths: "openmetadata-ui/src/main/resources/ui/src/pages/**/*.{ts,tsx}"
---

# Page structure

Every page uses a sanctioned scaffold. Do not introduce a new shell, header, or tab mechanism — if
the canon can't express a layout, extend the canonical component in
`openmetadata-ui-core-components`, in its own PR.

## Sanctioned layouts (pick by situation, newest first)

| Layout | Source | When |
|---|---|---|
| `PageLayout` (compound: `.Header`/`.Panel`/`.Content`, `scroll` modes) | `@openmetadata/ui-core-components` `application/page-layout` | **default for new pages** |
| `ObservabilityPageShell` | `components/observability/ObservabilityPageShell` | observability surfaces (alerts, pipelines, data quality) |
| `PageLayoutV1` | `components/PageLayoutV1` | legacy. Fine to keep when editing an existing V1 page; do not use for new pages |
| `ResizablePanels` / `ResizableLeftPanels` | `components/common/ResizablePanels` | split layouts with a resizable side panel (react-reflex) — composes inside a layout, not a page shell |

Never: hand-rolled `tw:flex tw:h-full` page wrappers, or a new `*Shell`/`*Layout` component.

## Header, tabs, spacing

- **Header**: the layout's own slot — core `PageLayout.Header` — with `HeaderBreadcrumb`
  (`TitleBreadcrumb` is legacy). Do not fight a core component's spacing with `tw:mb-0!` — if its
  margin is wrong for a layout, fix the core component itself.
- **Tabs**: ui-core `Tabs` compound, one `Tabs.List type` per surface level (`underline` for page
  tabs). No detached tab strips, no URL-param-only tabs without a visible strip.
- **Spacing**: `tw:` utilities / core `Box` gaps only — no legacy utility classes
  (`p-x-lg`, `m-t-xs`), no inline margins.

Every page is lazy-loaded via its router (`withSuspenseFallback` + `React.lazy`); no direct
top-level page imports in a router file.

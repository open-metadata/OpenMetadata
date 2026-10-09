# Core-components stroke icons go straight into antd icon slots, never through the antd Icon wrapper

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Vansh0310
- **Guard:** reviewer
- **Related:** #35019 (Version button on the domain details page), #34141 (icons moved to core-ui)

## Context
Icons are moving from local SVGs and `@ant-design/icons` to the untitled-ui set in
`@openmetadata/ui-core-components/icons`, while some buttons are still antd `Button`s. Core icons
are stroke icons: the root `<svg>` sets `fill="none"` and each path draws with
`stroke="currentColor"`. The `@ant-design/icons` `<Icon component={X} />` wrapper renders `X` with
its base SVG props, which include `fill: 'currentColor'` (`@ant-design/icons` 4.8.3,
`lib/utils.js` `svgBaseProps`, spread in `lib/components/Icon.js`). They override the icon's own
`fill="none"`, so the stroke shapes get filled and the glyph turns into a solid blob. Separately,
antd spaces a button's icon from its label only when the icon carries the `anticon` class
(`.ant-btn > .anticon + span`).

## Decision
When a core-components icon goes into an antd `icon` slot, such as antd `Button`'s `icon` prop,
pass the icon element directly with `className="anticon"` and an explicit `size`:

```tsx
icon={<Version className="anticon" size={14} />}
```

Never wrap a core icon in `@ant-design/icons` `<Icon component={...}>`. Core components (`Button`,
`ButtonUtility`) take icons through their own `iconLeading` / `icon` props and need neither.

## Consequences
The icon keeps its stroke rendering and antd's icon-label gap without a new wrapper component.
`size` has to be set by hand, because core icons default to 24px where antd icons sized themselves
at `1em`. The rule lasts only as long as antd icon slots do: once a button moves to a core
component, pass the icon through that component's own prop instead.

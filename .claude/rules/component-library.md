---
description: Component library — prefer openmetadata-ui-core-components; do not add Ant Design for new work
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Component library: `openmetadata-ui-core-components` over Ant Design

Applies to UI `*.{ts,tsx}`. Consumed via the bare package name
`@openmetadata/ui-core-components` (a yarn `link:` to `openmetadata-ui-core-components/src/main/resources/ui`).

- **Use `openmetadata-ui-core-components` for all new UI work** — it is the canonical component
  library, implementing the **UntitledUI + Tailwind** go-forward design system. **Do not use Ant
  Design or MUI, and do not introduce new UI component-library dependencies.**
- **Read the design-system spec before building a component.** The machine-readable specs live in
  `openmetadata-ui/src/main/resources/ui/specs/`: start at `specs/README.md` (it declares the two
  stacks — go-forward **UntitledUI + Tailwind (`tw:`)** vs legacy **Ant Design + Less**, deprecated),
  then read `specs/untitled/<component>.md` for the component you touch. `yarn tw-guard` blocks new
  `assets/svg/` raw-SVG files/imports and reports new `.less` files. `antd` is not installed.
- Available components (all under
  `openmetadata-ui-core-components/src/main/resources/ui/src/components/`): Button, Input, Select,
  Modal, Table, Tabs, Pagination, Badge, Avatar, Checkbox, Dropdown, Form, Card, Tooltip, Toggle,
  Slider, Textarea, Tags, and more. When building layout/color, invoke the `ui-core-components` skill
  before reaching for a raw `<div>` + Tailwind.
- **Planning UI work? Invoke `planning` first** — its component map ties each screen piece to an
  existing component before any code. Layout and colour reference: the `ui-core-components` skill.
- **Building or restructuring a component? Invoke these first** — they do not fire on their own:
  `react-best-practices` (waterfalls, re-renders, barrel imports, bundle) and `composition-patterns`
  (prop proliferation, compound components). When the component is done, invoke
  `web-design-guidelines` as an a11y/UX audit. All three are vendored under `skills/vendor/`; a skill
  loads only when invoked, and their own trigger wording aims at *refactoring* and *reviewing*, so
  they miss "build me a component" unless named. `frontend-performance.md` and `frontend-a11y.md`
  carry the load-bearing subset and auto-load — these skills are the depth behind them.
- **Do not hand-roll a component the library already exports.** Reach for these first:

  | Instead of hand-rolling | Import |
  |---|---|
  | `<div role="listbox">`, `role="combobox"` | `Select`, `MultiSelect`, `Combobox`, `Autocomplete` |
  | `<div role="menu">`, `role="menuitem"` | `Dropdown` |
  | `<div role="tablist">`, `role="tab"` | `Tabs` |
  | `<div role="dialog">`, `role="alertdialog"` | `Modal` |
  | `role="switch"` / `role="radiogroup"` / `role="progressbar"` / `role="tooltip"` | `Toggle` / `RadioButtons` / `ProgressIndicator` / `Tooltip` |
  | raw `<button>`, `<input>`, `<select>`, `<textarea>` in `src/components/**` | `Button`, `Input`, `Select`, `Textarea` |
  | `onKeyDown` handling `ArrowDown`/`ArrowUp` | `Select` / `Dropdown` / `Tabs` (keyboard nav is built in) |
  | `createPortal` overlays | `Modal`, `Popover`, `SlideoutMenu` |
  | `<h1>`–`<h6>`, `<p>`, a `<span>` with `tw:text-*`/`tw:font-*` | `Typography as="h2" size weight color` |
  | `<div className="tw:flex …">` / `tw:grid` | `Box` (`direction`/`align`/`gap`/`wrap`) / `Grid` |
  | `Box` with `tw:bg-*`/border (a surface) | `Card` — `Box` is layout only |
  | `Typography className="tw:text-tertiary"` (and the other text colours) | the `color` prop (`secondary` renders `text-tertiary`) |

  No linter knows the design system; `jsx-a11y` only enforces that a hand-rolled widget is accessible.
- **Layout is `Box` and `Grid`, never a styled `div`.** Flex rows/columns → `Box` (`direction`,
  `align`, `justify`, `gap`, `wrap`, `inline`); grids → `Grid` (`gap`/`rowGap`/`colGap`, `Grid.Item`
  `span`) — not `<div className="tw:flex|tw:grid …">` or arbitrary `grid-cols-[…]`. `Box`/`Grid`
  are layout only: no background, border or radius; a bordered or coloured panel is `Card`.
- **Colour tokens: semantic only, and the right surface** (full list: `frontend-styling.md`). Card on
  the page → `Card` or `tw:bg-surface`; a card inside a `bg-surface` panel, modal or drawer →
  `Card variant="muted"`/`"tile"` (ADR:2026-11-05-nested-cards-sit-one-step-off-their-panel). Never `tw:bg-primary` (the page colour
  in dark: the card disappears). Modal/drawer → `tw:bg-overlay-surface`; popover/menu → `tw:bg-floating`;
  raw palette and hex do not flip → `utility-*` or a semantic token; icons → `tw:text-fg-*`;
  `Typography` colour → its `color` prop. Check every new surface in both themes.
- **Every new component, hook or util with a branch ships its own test in the same change**
  (`X.test.tsx` beside it). Assert the rendered outcome or returned value for each branch (empty,
  error, read-only/permission, each variant), against the real core components — not a mock of
  them, and not only `toHaveBeenCalled`.
- **Core first, every time — the UI looks the same only if every feature uses the same components.**
  Before writing any new component file, read the core export list
  (`openmetadata-ui-core-components/src/main/resources/ui/src/components/index.ts`) and
  `src/components/common/`, and use what is there as-is, with its own `variant`/`size`/`color` props.
  A new file that is mostly one core component plus classes or forwarded props is not a new component:
  use the core one at the call site (no `FooHeader` around `PageLayout.PageHeader`, no `FooToggle`
  around `Toggle`, no `FooSegmentedControl` around `ButtonGroup`).
- **Core missing something is a core fix, not a local variant.** If the call site needs a prop core
  lacks (a tooltip, a size, a slot), add it to `openmetadata-ui-core-components` (its own PR, with a
  story and test) and use it directly. Never build a parallel feature-local component to get it.
- **Icon-only actions are `ButtonUtility`**, never a children-less `Button`, a raw `<button>`, or an
  icon or `div` with `onClick`. Use `tertiary` by default, `secondary` when bordered, and `primary` for
  send/confirm. Size follows the role. Exceptions (feed comment/reply, split-button chevron,
  colour swatches, drag handles) and the reasons for each are in
  ADR:2026-10-14-icon-only-actions-are-tertiary-button-utility-with-one-edit-icon.
- **Modals: always `<Dialog dividers="scroll">`.** Dividers show only when the modal scrolls: no
  line under the title, and the footer line appears only while `Dialog.Content` overflows. Do not
  draw your own `border-t`/`border-b` or `<Divider>` around a dialog's header or footer. The
  default (`always`) exists only for legacy modals. Spec: `specs/untitled/modal.md` → Dividers.
- **Empty states: use the variants in `src/components/common/EmptyPlaceholder/`**, never the core
  `EmptyPlaceholder` directly — `NoDataPlaceholder`, `CreatePlaceholder`, `PermissionPlaceholder`,
  `NoSearchResultsPlaceholder`, `NoFilteredResultsPlaceholder`, `SomethingWentWrongPlaceholder`
  carry the default icon and i18n copy; `FeaturesPlaceholder` has no defaults, so pass `title`,
  `description` and `features` (ADR:2026-10-21-empty-states-render-through-the-placeholder-wrappers).
  The host must be `tw:relative` (the placeholder is absolutely positioned). Keep the default icon
  (no `assets/svg` icons) and never wrap `title`/`description` in a `Tooltip`: its trigger is
  `w-max`, so the copy stops wrapping.
- **Clear a controlled prop with `null`, never `undefined`.** `selectedKey={x ?? undefined}` flips a React
  Aria component to uncontrolled and can loop until "Maximum update depth exceeded". Enforced by
  `openmetadata-ui-patterns/no-undefined-controlled-prop`
  (ADR:2026-11-13-react-aria-controlled-props-are-cleared-with-null-not-undefined).
- **Legacy**: Ant Design components remain in existing code but should be replaced with
  `openmetadata-ui-core-components` equivalents when refactoring. For forms, do not use the legacy
  Ant Design `getField`/`generateFormFields` (see `frontend-react.md` → Forms).

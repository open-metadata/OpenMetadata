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
  `antd` imports and new `.less` files.
- Available components (all under
  `openmetadata-ui-core-components/src/main/resources/ui/src/components/`): Button, Input, Select,
  Modal, Table, Tabs, Pagination, Badge, Avatar, Checkbox, Dropdown, Form, Card, Tooltip, Toggle,
  Slider, Textarea, Tags, and more. When building layout/color, invoke the `ui-core-components` skill
  before reaching for a raw `<div>` + Tailwind.
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

  This table is guidance, not a gate — no linter knows the design system. What CI *does* enforce is
  that a hand-rolled widget must at least be accessible: `jsx-a11y` blocks an invalid `role`, missing
  required ARIA props, and unusable tab order. Using the library component is how you satisfy that
  without writing the ARIA yourself.
- **Legacy**: Ant Design components remain in existing code but should be replaced with
  `openmetadata-ui-core-components` equivalents when refactoring. For forms, do not use the legacy
  Ant Design `getField`/`generateFormFields` (see `frontend-react.md` → Forms).

> **Resolved contradiction (do not follow the old wording):** `AGENTS.md` still says the frontend is
> "React + TypeScript + Ant Design" and to "use React/TypeScript with Ant Design components." The
> code says otherwise — a blocking hook rejects `antd` imports and every other source forbids Ant
> Design for new work — so **the code-supported rule wins: no Ant Design for new work.**

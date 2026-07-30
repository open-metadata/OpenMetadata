---
description: Component library — prefer openmetadata-ui-core-components; do not add Ant Design for new work
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Component library: `openmetadata-ui-core-components` over Ant Design

Applies to UI `*.{ts,tsx}`. Consumed via the bare package name
`@openmetadata/ui-core-components` (a yarn `link:` to `openmetadata-ui-core-components/src/main/resources/ui`).

- **Use `openmetadata-ui-core-components` for all new UI work** — it is the canonical component
  library, implementing the **UntitledUI + Tailwind** go-forward design system. **Do not use Ant
  Design, and do not introduce new UI component-library dependencies.**
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
- **Do not hand-roll a component the library already exports.** `yarn reuse-audit` blocks these on
  **added lines only** (existing code is untouched, like `tw-guard`). Same list the script enforces:

  | Instead of hand-rolling | Import |
  |---|---|
  | `<div role="listbox">`, `role="combobox"` | `Select`, `MultiSelect`, `Combobox`, `Autocomplete` |
  | `<div role="menu">`, `role="menuitem"` | `Dropdown` |
  | `<div role="tablist">`, `role="tab"` | `Tabs` |
  | `<div role="dialog">`, `role="alertdialog"` | `Modal` |
  | `role="switch"` / `role="radiogroup"` / `role="progressbar"` / `role="tooltip"` | `Toggle` / `RadioButtons` / `ProgressIndicator` / `Tooltip` |
  | raw `<button>`, `<input>`, `<select>`, `<textarea>` inside `src/components/**` | `Button`, `Input`, `Select`, `Textarea` |
  | `onKeyDown` handling `ArrowDown`/`ArrowUp` | `Select` / `Dropdown` / `Tabs` (keyboard nav is built in) |
  | `createPortal` overlays | `Modal`, `Popover`, `SlideoutMenu` |

  Tests, mocks, stories and Playwright specs are out of scope. If a raw element is genuinely
  required, put `reuse-audit-ignore` in a comment on that line.
- **Legacy**: Ant Design components remain in existing code but should be replaced with
  `openmetadata-ui-core-components` equivalents when refactoring. For forms, do not use the legacy
  Ant Design `getField`/`generateFormFields` (see `frontend-react.md` → Forms).

> **Resolved contradiction (do not follow the old wording):** `AGENTS.md` still says the frontend is
> "React + TypeScript + Ant Design" and to "use React/TypeScript with Ant Design components." The
> code says otherwise — a blocking hook rejects `antd` imports and every other source forbids Ant
> Design for new work — so **the code-supported rule wins: no Ant Design for new work.**

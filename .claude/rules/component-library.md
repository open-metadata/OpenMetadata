---
description: Component library — prefer openmetadata-ui-core-components; do not add Ant Design for new work
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Component library: `openmetadata-ui-core-components` over Ant Design

Applies to UI `*.{ts,tsx}`. Consumed via the bare package name
`@openmetadata/ui-core-components` (a yarn `link:` to `openmetadata-ui-core-components/src/main/resources/ui`).

- **Use `openmetadata-ui-core-components` for all new UI work** — it is the canonical component
  library. **Do not use Ant Design, and do not introduce new UI component-library dependencies.**
- Available components (all under
  `openmetadata-ui-core-components/src/main/resources/ui/src/components/`): Button, Input, Select,
  Modal, Table, Tabs, Pagination, Badge, Avatar, Checkbox, Dropdown, Form, Card, Tooltip, Toggle,
  Slider, Textarea, Tags, and more. When building layout/color, invoke the `ui-core-components` skill
  before reaching for a raw `<div>` + Tailwind.
- **Legacy**: Ant Design components remain in existing code but should be replaced with
  `openmetadata-ui-core-components` equivalents when refactoring. For forms, do not use the legacy
  Ant Design `getField`/`generateFormFields` (see `frontend-react.md` → Forms).

> **Resolved contradiction (do not follow the old wording):** `AGENTS.md` still says the frontend is
> "React + TypeScript + Ant Design" and to "use React/TypeScript with Ant Design components." The
> code says otherwise — a blocking hook rejects `antd` imports and every other source forbids Ant
> Design for new work — so **the code-supported rule wins: no Ant Design for new work.** (Audit:
> `docs/harness-audit/00-findings.md` §C-A.)

---
description: React/TypeScript component, hook, state, and type-safety conventions plus the CI lint code-rules
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Frontend React/TypeScript conventions

Applies to UI `*.{ts,tsx}`. Styling/tokens are in `frontend-styling.md`; component-library choice in
`component-library.md`; strings/i18n in `i18n.md`; Playwright in `frontend-playwright.md`. For the
**formatting procedure** invoke the `ui-checkstyle` skill — do not hand-edit formatting.
Compliant reference: `openmetadata-ui/src/main/resources/ui/src/components/ActivityFeed/ActivityFeedCardNew/ActivityFeedcardNew.component.tsx`
with its interface in a sibling `*.interface.ts`; forms reference
`openmetadata-ui/src/main/resources/ui/docs/formutils.md`.

## Component patterns

- **File naming**: components `ComponentName.component.tsx`, interfaces `ComponentName.interface.ts`
  (props interfaces live in the `.interface.ts` file). *(Adherence is partial across the tree; follow
  it for new files.)*
- **Functional components only** — no class components.
- **State**: `useState` with proper typing; multiple loading states as one object
  (`useState<Record<string, boolean>>({})`).
- **Side effects**: `useEffect` with correct dependency arrays.
- **Performance**: `useCallback` for handlers, `useMemo` for expensive computations.
- **Custom hooks**: prefix `use`, place in `src/hooks/`, return typed objects.
- **Errors**: `showErrorToast` / `showSuccessToast` from ToastUtils.
- **Navigation**: `useNavigate` from react-router-dom, not direct history manipulation.
- **Data fetching**: async + try/catch, update loading states.

## State management

- Zustand stores for global state (`useLimitStore`, `useWelcomeStore`). Keep component state local
  with `useState` when possible. Context providers for feature-shared state (`ApplicationsProvider`).

## Forms

- New forms use the `react-hook-form` + `react-aria` stack from `@openmetadata/ui-core-components`
  (`getField`/`FieldProp`/`FieldTypes`/`HookForm`/`FormFields`): `FieldProp[]` config + RHF state + a
  pure values→payload transform. Full reference:
  [`openmetadata-ui/src/main/resources/ui/docs/formutils.md`](../../openmetadata-ui/src/main/resources/ui/docs/formutils.md).
  Do **not** use the legacy Ant Design `getField`/`generateFormFields` from `@utils/formUtils` for new
  forms.

## Application config & service utilities

- Applications use `ApplicationsClassBase` for schema loading; dynamic imports handle app-specific
  schemas/assets; form schemas use RJSF with custom widgets.
- Each service type has a dedicated utility file (e.g. `DatabaseServiceUtils.tsx`); connection schemas
  are imported statically and pre-resolved; service configs map types to schemas via switch.

## Type safety

- **NEVER use `any`** — use proper types, or `unknown` + type guards. Import types from existing
  definitions (e.g. `RJSFSchema` from `@rjsf/utils`); API response types come from `generated/`
  (see `schema-first.md`). Avoid type assertions; use discriminated unions for action/state variants.
  Add `// eslint-disable-next-line` only when unavoidable.
- **Import organization** — `yarn organize-imports:cli` auto-sorts. Order: external libs (React, …) →
  internal absolute (`generated/`, `constants/`, `hooks/`, …) → relative utilities/components → assets
  (SVGs, styles) → type imports grouped when needed.

## CI lint code-rules (enforced on every PR — code that violates these will not merge)

- **No `console.log/warn/error`** (`no-console`) — use the logger or remove.
- **`===` not `==`** (`eqeqeq`, smart, except `null` checks).
- **Max 200 characters per line.**
- **Self-closing components** — `<Div />` not `<Div></Div>`.
- **Sort JSX props alphabetically**, callbacks last.
- **Space after `//`** in comments.
- **Blank lines** before `function`/`class`/`export`/`return`.
- **Tests**: use `it()` consistently (don't mix `test()`); blank lines around `describe`/`it`/`beforeEach`.
- **Prettier** — 2-space indent, single quotes, strict HTML whitespace.
- **Apache-2.0 header** on new files (`yarn license-header-fix`).

> The `UI Checkstyle` workflow runs one `checkstyle` job gating six steps (src lint, licence header,
> i18n sync, app-docs, playwright lint, core-components lint) — not three separate jobs. The
> `ui-checkstyle` skill runs the same ESLint → Prettier → organize-imports sequence locally.

## Commands

```bash
cd openmetadata-ui/src/main/resources/ui
yarn start                    # dev server on :3000
yarn test [path/to.spec.ts]   # Jest (add :watch, :coverage)
yarn lint / yarn lint:fix     # ESLint
yarn ui-checkstyle:changed    # CI checkstyle for changed files (excludes tsc)
npx tsc --noEmit              # type check
yarn build                    # production build (Vite)
```

# OpenMetadata UI Developer Handbook

## 1. Folder Structure

The top-level folders are **layers** (`components`, `pages`, `rest`, `utils`, …). Inside each layer,
code is grouped by **domain**, then by **feature**. The same domain and feature names repeat in every
layer, so `governance/glossary` is one coordinate you can use to find anything about glossaries.

```
@src/
│
├── components/                 # Reusable UI components
│   ├── discovery/              # domain
│   │   ├── explore/            # feature
│   │   │   ├── ExploreTree/    # component
│   │   │   └── ExploreSearchBar/
│   │   ├── search/
│   │   ├── my-data/
│   │   └── data-marketplace/
│   ├── governance/
│   │   ├── glossary/
│   │   │   ├── GlossaryList/
│   │   │   ├── GlossaryHeader/
│   │   │   └── GlossaryTermCard/
│   │   ├── classification/
│   │   ├── domain/
│   │   └── data-product/
│   ├── observability/
│   │   ├── data-quality/
│   │   ├── incident-manager/
│   │   ├── profiler/
│   │   └── alerts/
│   ├── insights/
│   │   ├── data-insight/
│   │   └── kpi/
│   ├── platform/
│   │   ├── settings/
│   │   ├── services/
│   │   ├── ingestion/
│   │   └── auth/
│   ├── lineage/                # cross-cutting — belongs to no single domain
│   ├── data-contract/
│   ├── entity/
│   ├── activity-feed/
│   └── common/                 # generic, domain-agnostic UI
│
├── pages/                      # Route-level views
│   ├── governance/
│   │   └── glossary/
│   │       ├── GlossaryListPage/
│   │       └── GlossaryDetailPage/
│   ├── discovery/
│   ├── observability/
│   ├── insights/
│   ├── platform/
│   └── lineage/
│
├── rest/                       # API clients
│   ├── governance/
│   │   ├── glossary.api.ts
│   │   └── classification.api.ts
│   └── …                       # same domains
│
├── utils/                      # Helpers
│   ├── governance/
│   │   ├── glossary.utils.ts
│   │   └── glossary.utils.test.ts
│   ├── …                       # same domains
│   └── common/                 # date, string, formatting
│
├── hooks/
│   ├── governance/
│   │   └── useGlossaryList.ts
│   └── common/
│
├── constants/                  # grouped by domain, plus common/
├── interface/                  # grouped by domain, plus common/
├── context/                    # React context providers (note: a stray `contexts/` also
│                               #   exists — use `context/`, fold the other in)
├── generated/                  # generated from openmetadata-spec — never hand-edit
├── assets/                     # images, fonts, icons
├── locale/                     # i18n resources
├── styles/                     # global styles, variables, mixins (LESS)
├── App.tsx
└── index.tsx
```

One feature, fully expanded across the layers:

```
components/governance/glossary/GlossaryList/
pages/governance/glossary/GlossaryListPage/
rest/governance/glossary.api.ts
utils/governance/glossary.utils.ts
hooks/governance/useGlossaryList.ts
constants/governance/glossary.constants.ts
interface/governance/glossary.interface.ts
```

**Trade-off to be aware of:** because layers stay at the top, one feature spans several trees — adding
a glossary field can touch four folders. That is the price of keeping the core layers stable and the
lint layer-rules working (see §6). Keep the domain and feature names identical across layers so the
files are still trivially greppable.

## 2. Domains

Five domains, matching the product surface:

| Domain | Owns |
|---|---|
| `discovery` | Explore, search, my data, data marketplace, knowledge center |
| `governance` | Glossary, classification, domains, data products, policies, roles, certification |
| `observability` | Data quality, incident manager, profiler, test library, alerts, service insights |
| `insights` | Data insight, KPI, web analytics |
| `platform` | Settings, services, ingestion, auth, bots, applications, personas, customization |

**Cross-cutting features sit at the domain level, not inside a domain** — `lineage/`,
`data-contract/`, `entity/`, `activity-feed/`.

Use one test to decide: **if two domains would both reasonably claim a feature, it has no domain** —
put it at the domain level. Lineage is discovery *and* governance *and* observability, so it stays
flat. This is what stops every new folder from reopening a taxonomy argument.

Do not add a sixth domain without team agreement — the value of the scheme is that the same five
names appear in every layer.

## 3. File Naming Conventions

One stem per unit; the suffix carries the role. Fuzzy-finding `GlossaryList` returns a set of files
that label themselves.

| File | Holds |
|---|---|
| `GlossaryList.tsx` | the component |
| `GlossaryList.types.ts` | props and local types |
| `GlossaryList.utils.ts` | pure logic, no React, no JSX |
| `GlossaryList.constants.ts` | literals, enums |
| `GlossaryList.style.less` | component-scoped styles |
| `GlossaryList.test.tsx` | unit test |
| `GlossaryList.mock.ts` | test fixtures |

Casing:

- **kebab-case** for domain and feature folders — they are paths, not things: `governance/`,
  `data-contract/`
- **PascalCase** for component folders and component files — the import name then matches the
  filename with no mental mapping: `GlossaryList/GlossaryList.tsx`
- **camelCase** for non-component modules: `useGlossaryList.ts`, `glossary.api.ts`,
  `glossary.utils.ts`
- **UPPER_CASE** for constant values (not filenames): `API_URL`

Never rename a file by case alone. macOS is case-insensitive by default and git will not track it
cleanly — rename via an intermediate name if you must.

> Legacy files use `.component.tsx` and `.interface.ts`. New code uses the table above. The
> divergence is intentional: the suffix tells you at a glance whether a file has been migrated.

## 4. Component Structure

Each component gets a folder containing only the files it needs — do not scaffold empty ones:

```
components/governance/glossary/GlossaryList/
  GlossaryList.tsx
  GlossaryList.types.ts
  GlossaryList.utils.ts
  GlossaryList.test.tsx
  GlossaryList.style.less
```

- **Keep business logic out of the component.** Data shaping, filtering, and derivation go in
  `*.utils.ts` as pure functions — no React, no JSX. They are then unit-testable without rendering.
- **No `index.ts` barrel files inside a component folder.** A barrel re-export pulls every sibling
  module into the graph and defeats tree-shaking; the `no-internal-barrel-imports` lint rule reports
  it. Import the deep path instead.

## 5. Component-Specific Types

- Simple, single-use types: define at the top of the component file.
- Complex or reused types: `[ComponentName].types.ts` beside the component.
- Types shared across a whole feature: `interface/[domain]/[feature].interface.ts`.
- **Never redefine an API type** — import it from `generated/`, which is generated from
  `openmetadata-spec/` (see `.claude/rules/schema-first.md`).

## 6. Imports

**Within a feature, use relative imports.**

```ts
import { formatTerms } from './GlossaryList.utils';
import { GlossaryHeader } from '../GlossaryHeader/GlossaryHeader';
```

If you need more than one `../`, the file is probably in the wrong feature. Reach for an absolute
import rather than climbing.

**Across features or layers, use absolute imports from the layer root.**

```ts
import { GlossaryList } from 'components/governance/glossary/GlossaryList/GlossaryList';
import { getGlossaryTerms } from 'rest/governance/glossary.api';
import { formatTerms } from 'utils/governance/glossary.utils';
```

> **Setup required.** Absolute imports currently resolve in Jest only
> (`jest.config.js` → `moduleDirectories: ['node_modules', 'src']`). Vite and `tsc` do not resolve
> them yet — `tsconfig.json` has no `baseUrl`, and `vite.config.ts` aliases only `@`. Before using
> absolute imports in application code, add `"baseUrl": "./src"` to `tsconfig.json` and matching
> entries to the Vite `resolve.alias` block. Until then, application code must keep using relative
> paths; only tests can use the absolute form.

Enforced import rules (custom ESLint plugins in `eslint-rules/`, run on every PR):

- **No app-internal barrel imports** — import the deep path, not an `index.ts`.
- **Pages must not import other pages.** Move shared code down into components, hooks, interfaces, or
  pure utilities.
- **REST clients and hooks must not import UI.** Dependencies point one way — `pages` → `components`
  → `hooks`/`rest` → `utils`.
- **Pure utilities must not contain JSX** or import React, pages, or REST.
- **Routers must lazy-load pages** with `import()`, never a static import.
- **No lodash default or namespace imports** — `import { isEmpty } from 'lodash';`.

These rules derive a file's layer from the first path segment after `src/`, which is why the layer
folders stay at the top level.

## 7. API Layer

- All API calls live in `@src/rest/`, grouped by domain: `rest/governance/glossary.api.ts`
- One file per feature, not per endpoint
- Request and response types come from `generated/`
- Keep API logic free of UI concerns — no React, no toasts, no navigation

## 8. State Management

- Zustand stores for global state. They live in `@src/hooks/` alongside other hooks, not in a separate
  `store/` folder — `useApplicationStore`, `useSearchStore`, `useDomainStore`, `useWelcomeStore`
- New stores go in `hooks/[domain]/`, named `use[Thing]Store.ts`
- Keep component state local with `useState` when possible
- Context providers for feature-shared state live in `@src/context/`

## 9. Hooks

- Feature hooks: `hooks/[domain]/useThing.ts`
- Generic hooks: `hooks/common/`
- Always prefix with `use`; return typed objects
- Hooks must not import UI components

## 10. Interfaces & Types

- Shared types go in `@src/interface/[domain]/`
- Component-local types stay in `[ComponentName].types.ts` (see §5)
- API types always come from `generated/` — never hand-written

## 11. Testing

- Use Jest + React Testing Library
- Test files live next to the code they test
- Cover components, hooks, utils, and API logic
- **IMPORTANT**: Always write unit tests for utility functions
  - Every utility function should have corresponding test coverage
  - Test edge cases, error conditions, and expected behavior
  - Place test files next to the utility: `glossary.utils.test.ts`
- Because business logic lives in `*.utils.ts` (§4), most logic is testable without rendering — prefer
  that over deep component tests
- Follow [this](./playwright/PLAYWRIGHT_DEVELOPER_HANDBOOK.md) guide for e2e testing.

## 12. Routing

- Routers live in `@src/components/AppRouter/`, which is the app's routing composition root — there is
  no `src/routes/` folder
- Each feature that owns a route subtree gets its own router there: `GlossaryRouter`, `DomainRouter`,
  `ClassificationRouter`, `SettingsRouter`, `EntityRouter`
- Route path constants go in `constants/[domain]/[feature].routes.ts`
- Route modules must load pages with `React.lazy` + `import()`, never a static import — enforced by
  the `no-eager-page-imports` rule. Pass every lazy component to a helper from
  `components/AppRouter/withSuspenseFallback`, or render it in a real `Suspense` boundary with an
  explicit `fallback`

## 13. Assets

- Place images, SVGs, fonts, etc. in `@src/assets/`
- Organize by type or feature
- **SVG Guidelines**: When adding new SVG files, DO NOT include `width` and `height` attributes in the SVG element
  - ❌ Bad: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">`
  - ✅ Good: `<svg viewBox="0 0 20 20" fill="none">`
  - This allows flexible sizing via CSS/props without hardcoded dimensions

## 14. Styles

- Use LESS style for component styles (`.style.less`)
- Place global styles, variables, and mixins in `@src/styles/` as `.less` files

## 15. Translations

- **i18n Translation Rule**: DO NOT use i18n translation functions outside of React components
  - Only use `t()` from `useTranslation()` hook inside components
  - Store translation keys (not translated strings) in constants, utilities, hooks, and other non-component files
  - ❌ Bad: In constants/utils/hooks: `message: i18n('label.name')`
  - ✅ Good: Store the key `message: 'label.name'`, then translate in component using `t('label.name')`
  - This prevents initialization order issues and keeps non-component code pure

## 16. UI Library (@openmetadata/ui-core-components) and Icons (@untitledui/icons)

- Primary UI library: `@openmetadata/ui-core-components`, built on Untitled UI patterns with `react-aria-components` as the accessibility foundation.
- Icon source: @untitledui/icons.

Usage guidance:
- Component-level usage:
  - Prefer components from `openmetadata-ui-core-components` (Button, Input, Select, Modal, Table, Tabs, etc.) over raw elements or other UI libraries.
  - Do not use Ant Design for new UI work; see the top-level [CLAUDE.md](../../../../../CLAUDE.md) styling section for the full component/token reference.
- Styling:
  - Use Tailwind utility classes with the `tw:` prefix (e.g., `tw:flex`, `tw:text-sm`) to avoid conflicts with legacy Ant Design/LESS styles.
  - Use CSS custom properties (design tokens) defined in `openmetadata-ui-core-components` for colors instead of hardcoded values.
  - Use `.style.less` only for component-specific static styles/layout that predate the Tailwind migration.
- Icons:
  - Import icons directly to keep bundle size small: `import { IconName } from '@untitledui/icons';`
  - For rarely used icons, import directly where needed to enable tree-shaking.
  - If you need consistent sizing, color, or extra behavior, wrap icons in a shared component at
    `@src/components/common/Icon/Icon.tsx` (create it when the need arises — it does not exist yet).
  - Do **not** create an `assets/icons/index.ts` re-export barrel. It is the exact case the
    `no-internal-barrel-imports` rule exists to prevent: one import pulls the whole icon set into the
    module graph and defeats tree-shaking.
- Accessibility and ARIA:
  - Rely on `react-aria-components`' accessible primitives (already wired into `openmetadata-ui-core-components`).
  - Ensure icons used as interactive elements have accessible names or aria-hidden when decorative.
- Performance & bundle:
  - Prefer named imports to maintain tree-shaking icon packages.
  - Keep the icon re-export file limited to used icons; avoid exporting entire icon packs.

## 17. General Rules

- Keep files small and focused
- Prefer composition over inheritance
- Use TypeScript everywhere; never `any`
- Write clear, descriptive comments and JSDoc where needed — explain *why*, never restate the code
- Keep third-party code and wrappers in a separate folder if needed

## 18. Forms

- New forms use the `react-hook-form` + `react-aria` stack from `@openmetadata/ui-core-components` (`getField`/`FieldProp`/`FieldTypes`/`HookForm`/`FormFields`): a form is `FieldProp[]` config objects + RHF state + a pure values→payload transform.
- Full reference: [docs/formutils.md](./docs/formutils.md) — field types, validation, composition, escape hatches, and the drawer caller pattern.
- Do not use the legacy Ant Design `getField`/`generateFormFields` from `@utils/formUtils` for new forms.

---

## Adding a new feature — checklist

1. Pick the domain (§2). If two domains claim it, put it at the domain level.
2. Create the folders you need, in each layer you touch:
   - `components/[domain]/[feature]/[ComponentName]/`
   - `pages/[domain]/[feature]/[PageName]/`
   - `rest/[domain]/[feature].api.ts`
   - `utils/[domain]/[feature].utils.ts`
3. Name files by role (§3): `.tsx`, `.types.ts`, `.utils.ts`, `.test.tsx`.
4. Put business logic in `*.utils.ts` and unit-test it.
5. Import API types from `generated/` — never redeclare them.
6. Run `yarn ui-checkstyle:changed` and `npx tsc --noEmit`.

---

This handbook ensures a clean, scalable, and consistent codebase for all developers.

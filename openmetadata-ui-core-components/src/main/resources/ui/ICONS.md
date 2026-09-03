# OpenMetadata Icon Library

First-party icon library for OpenMetadata, built from SVG sources and shipped as typed React components inside `@openmetadata/ui-core-components/icons`.

---

## Overview

```
icons/              ← source SVGs for regular icons (kebab-case, committed)
icons-custom/       ← source SVGs for custom/gradient icons (colors preserved)

src/icons/          ← generated TSX components (committed, do not edit manually)
  AddAlert.tsx
  Memories.tsx
  Gold.tsx          ← generated from icons-custom/gold.svg
  index.ts
src/icons-static/
  types.ts          ← IconProps interface (hand-written)
```

**Both `.svg` source files and `.tsx` generated files are committed to git.**
The generator (`yarn icons:generate`) is a developer tool — run it explicitly
when SVGs change, then commit the result. `yarn build` is pure `vite build` with
no generation step.

**Import syntax**

```ts
import { Memories, AddAlert, Domain } from '@openmetadata/ui-core-components/icons';
```

**Props** — same shape as `@untitledui/icons`:

| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | `number` | `24` | Width and height in px |
| `color` | `string` | `'currentColor'` | SVG stroke color |
| `className` | `string` | — | Additional CSS classes |
| `...props` | `SVGProps<SVGSVGElement>` | — | Any other SVG attribute |

```tsx
<Memories size={20} color="#667085" />
<AddAlert size={16} className="tw:text-brand-600" />
```

---

## Adding new icons

### 1. Export the SVG from Figma

- Select the icon frame in Figma
- Export as **SVG** (not PNG/PDF)
- Make sure no artboard background is included

### 2. Name and place the file

Name the file in **kebab-case** and drop it into the `icons/` directory at the package root:

```
openmetadata-ui-core-components/src/main/resources/ui/icons/my-new-icon.svg
```

Examples of valid names:
- `data-quality.svg` → `DataQuality`
- `api-collection.svg` → `ApiCollection`
- `ml-model-2.svg` → `MlModel2`

> Numbers and hyphens are fine. Spaces, `&`, and other special characters in the original Figma name will be stripped — so always use hyphens as word separators.

### 3. Run the generator and commit the output

```bash
cd openmetadata-ui-core-components/src/main/resources/ui
yarn icons:generate
```

Then **commit both the SVG and the generated `.tsx` file** as part of the same PR.
The generated files are tracked in git so `yarn build` stays fast (pure `vite build`,
no generation step).

This will:
- Run SVGO to optimise the SVG
- Generate `src/icons/MyNewIcon.tsx`
- Update `src/icons/index.ts` to export it

### 4. Verify in Storybook

```bash
yarn storybook
```

Open [http://localhost:6006](http://localhost:6006) and navigate to **Icons → Library**. Your new icon should appear in the searchable grid.

---

## Viewing the Storybook

```bash
cd openmetadata-ui-core-components/src/main/resources/ui
yarn storybook          # dev server on http://localhost:6006
yarn build-storybook    # static build to storybook-static/
```

Navigate to **Icons → Library** in the left sidebar.

| Feature | How to use |
|---|---|
| **Search** | Type in the search box to filter icon names across all categories |
| **Size** | Use the **size** slider in the Controls panel (bottom of screen) |
| **Copy import** | Click any icon cell — the import statement is copied to your clipboard |

---

## How the generator works

| File | Role |
|---|---|
| `icons/*.svg` | Source SVGs — kebab-case, committed, canonical source of truth |
| `scripts/generate-icons.mjs` | Reads `icons/`, runs SVGO + SVGR, writes `src/icons/` |
| `templates/component.cjs` | SVGR template that produces each `.tsx` file |
| `templates/index.cjs` | SVGR template that produces `src/icons/index.ts` |
| `src/icons/types.ts` | `IconProps` interface |

The Vite library build (`vite.config.ts`) auto-discovers `src/icons/index.ts` as an entry point — no build config changes are needed when adding icons.

**Full regeneration:**

```bash
yarn icons:generate    # re-reads all SVGs in icons/ and overwrites src/icons/*.tsx + index.ts
```

Safe to run at any time — it only touches generated files, never `types.ts` or other hand-written files.

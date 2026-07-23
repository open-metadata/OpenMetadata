# @openmetadata/ui-core-components

Shared UI component library for OpenMetadata, built on UntitledUI design system patterns with React Aria Components as the accessibility foundation.

## Package Overview

- **Package name**: `@openmetadata/ui-core-components`
- **Source root**: `src/main/resources/ui/src/`
- **Build tool**: Vite (library mode) with `vite-plugin-dts` for type declarations
- **Styling**: Tailwind CSS v4 with `tw:` prefix to avoid conflicts with the main app's Less/Ant Design styles
- **Component foundation**: `react-aria-components` (NOT Ant Design)
- **Icons**: `@untitledui/icons`

## Development Commands

```bash
cd openmetadata-ui-core-components/src/main/resources/ui
yarn build              # Production build to dist/
yarn dev                # Watch mode build
yarn type-check         # TypeScript type checking (tsc --noEmit)
yarn storybook          # Launch Storybook on port 6006
yarn clean              # Remove dist/
```

## Architecture

### Export Structure (package.json `exports`)

| Import path                                   | Description                                  |
| --------------------------------------------- | -------------------------------------------- |
| `@openmetadata/ui-core-components`            | Main entry - re-exports everything           |
| `@openmetadata/ui-core-components/components` | All UI components                            |
| `@openmetadata/ui-core-components/colors`     | Color utilities                              |
| `@openmetadata/ui-core-components/utils`      | `cx`, `sortCx`, utilities                    |
| `@openmetadata/ui-core-components/styles.css` | Compiled CSS (must be imported by consumers) |

### Source Directory Layout

```
src/
├── components/
│   ├── base/              # Primitive building blocks
│   │   ├── avatar/        # Avatar, AvatarLabelGroup, AvatarProfilePhoto
│   │   ├── badges/        # Badge, BadgeGroup
│   │   ├── buttons/       # Button, CloseButton, ButtonUtility, SocialButton
│   │   ├── button-group/  # ButtonGroup
│   │   ├── checkbox/      # Checkbox
│   │   ├── dropdown/      # Dropdown
│   │   ├── form/          # Form, HookForm
│   │   ├── input/         # Input, InputGroup, Label, HintText
│   │   ├── select/        # Select, MultiSelect, Combobox, Popover
│   │   ├── slider/        # Slider
│   │   ├── tags/          # Tags
│   │   ├── textarea/      # Textarea
│   │   ├── toggle/        # Toggle
│   │   └── tooltip/       # Tooltip
│   ├── application/       # Composite/application-level components
│   │   ├── date-picker/   # DatePicker, DateRangePicker, Calendar
│   │   ├── modals/        # ModalOverlay, Modal, Dialog, DeleteModal
│   │   ├── pagination/    # Pagination
│   │   ├── slideout-menus/ # SlideoutMenu
│   │   ├── table/         # Table
│   │   └── tabs/          # Tabs
│   └── foundations/        # Design tokens as components
│       ├── dot-icon.tsx
│       ├── featured-icon.tsx  # FeaturedIcon (light, outline themes)
│       └── payment-icons/
├── styles/
│   ├── globals.css        # Shared Tailwind-facing CSS entry (tokens, typography, shared styles)
│   └── typography.css     # Typography prose rules
├── colors/                # Color generation utilities
├── utils/                 # cx, sortCx, isReactComponent
├── types/                 # Shared TypeScript types
├── constants/             # Button constants, etc.
└── hooks/                 # Shared hooks
```

### Component Export Registration

All public components must be exported from `src/components/index.ts`. Add new exports there when creating components.

## Key Conventions

### Tailwind CSS Prefix

All Tailwind classes use the `tw:` prefix: `tw:flex`, `tw:bg-primary`, `tw:text-sm`, etc. This is mandatory to scope styles and prevent collisions with the main app's existing Less/Ant Design CSS.

### CSS Custom Properties (Design Tokens)

Theme colors are defined as CSS custom properties in `src/styles/globals.css` with light and dark mode variants. Components reference these semantic tokens:

- **Backgrounds**: `bg-primary`, `bg-secondary`, `bg-error-secondary`, `bg-error-solid`
- **Text**: `text-primary`, `text-secondary`, `text-tertiary`, `text-fg-error-primary`
- **Featured icon**: `text-featured-icon-light-fg-{brand,error,gray,success,warning}`
- **Utility colors**: `border-utility-{brand,error,gray,success,warning}-{50-900}`

### Style Patterns

- Use `sortCx({})` to define style variant objects (enables Tailwind IntelliSense sorting)
- Use `cx()` (from `tailwind-merge`) to merge class names with conflict resolution
- Use `isReactComponent()` to type-guard icon props that accept both `FC` and `ReactNode`

### Borders: never use `ring-*` — use `border` or `outline`

`tw:ring-*` compiles to a `box-shadow`, and **WebKit does not pixel-snap box-shadows** — a
ring used as a border thins out and can vanish entirely in Safari at non-100% zoom. `border`
and `outline` are snapped and never degrade. The library was migrated off rings; do not
reintroduce them.

| Situation | Use |
|---|---|
| Edge may occupy layout space (static container) | `tw:border tw:border-<token>` |
| Edge must be layout-neutral and the element's `outline` is free | `tw:outline-1 tw:-outline-offset-1 tw:outline-<token>` |
| Element's `outline` is already the focus ring (any focusable control) | `borderAfter` from `@/utils/tailwindClasses` |

`border` consumes layout, so on content-sized controls it adds 2px of height and makes them
grow on focus (1px → 2px). That is why controls use `outline`.

```tsx
import { borderAfter } from '@/utils/tailwindClasses';

// host needs `tw:relative`; colour via `tw:after:outline-<token>`
cx('tw:relative', borderAfter, 'tw:after:outline-primary',
   isDisabled && 'tw:disabled:after:outline-disabled_subtle')
```

`borderAfter2` is the 2px variant. Note `::before` is already used by `button.tsx` and
`social-button.tsx` for their inner gradient — hence `::after`.

Converting a ring: `ring-inset` → `-outline-offset-N`; **no** `ring-inset` → offset `0` (a
non-inset ring draws *outward*). Getting this wrong shifts the edge by 1px.

Gotchas:
- **`tw:outline-hidden` erases an outline border** — remove it from any element whose border
  is an outline. Unlayered LESS (`outline: none`) beats Tailwind utilities and will kill it.
- **`tw:transition-shadow` won't animate an outline** — use
  `tw:transition-[outline-color,outline-width]`. Plain `tw:transition` covers `outline-color`
  but not `outline-width`.
- **Keep `tw:shadow-*`** — a real drop shadow, not the ring.
- Consumers overriding a border must match where it's drawn: `::after` for
  Button/ButtonUtility/Tab, the element for Input/Select/Badge/Card.

There are **no** remaining `ring-*` usages and the ESLint rule has **no allow-list**. Even
`ring-offset-*` halos convert: the offset gap uses `--tw-ring-offset-color` (default `#fff`),
so when the ring colour is also white the two merge into one `(ring + offset)`px band —
`ring-2 ring-white ring-offset-2` is exactly `outline-4 outline-white`. Where the colours
differ, `outline-offset-N` matches the geometry with a transparent gap. Consumer focus rings
on `Button` are usually pure duplicates of its built-in
`focus-visible:outline-2 focus-visible:outline-offset-2` — delete rather than convert.

Full rationale, measurements, and the anti-pattern table:
[`openmetadata-ui/src/main/resources/ui/docs/colors.md`](../openmetadata-ui/src/main/resources/ui/docs/colors.md) §2.3.1.

### Button Color Variants

The `Button` component supports these `color` values:

- `primary`, `secondary`, `tertiary`, `link-gray`, `link-color`
- `primary-destructive`, `secondary-destructive`, `tertiary-destructive`, `link-destructive`

### Dark Mode

Dark mode uses a custom variant: `@custom-variant dark (&:where(.dark-mode, .dark-mode *))`. Toggle by adding `.dark-mode` class to a parent element.

### Externalized Dependencies (Vite rollup)

These are externalized in the build and must be provided by the consuming app:

- `react`, `react-dom`, `react/jsx-runtime`
- `@untitledui/icons`
- `react-aria`, `react-aria-components`, `react-stately`
- `react-hook-form`
- `tailwind-merge`
- `input-otp`
- `@react-aria/utils`, `@react-stately/utils`, `@react-types/shared`
- `@internationalized/date`
- `tailwindcss-react-aria-components`

## Adding New Components

1. Create the component file in the appropriate directory (`base/` for primitives, `application/` for composites, `foundations/` for design-token components)
2. Use `tw:` prefix on all Tailwind classes
3. Use `cx()` for class merging and `sortCx()` for style variant maps
4. Build on `react-aria-components` for accessibility
5. Export from `src/components/index.ts`
6. Run `yarn build` to verify compilation

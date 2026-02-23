# @openmetadata/ui-core-components

Shared UI component library for OpenMetadata, built on UntitledUI design system patterns with React Aria Components as the accessibility foundation.

## Package Overview

- **Package name**: `@openmetadata/ui-core-components`
- **Source root**: `src/main/resources/ui/src/`
- **Build tool**: Vite (library mode) with `vite-plugin-dts` for type declarations
- **Styling**: Tailwind CSS v4 with `tw:` prefix to avoid conflicts with the main app's Less/Ant Design styles
- **Component foundation**: `react-aria-components` (NOT MUI or Ant Design)
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

| Import path | Description |
|---|---|
| `@openmetadata/ui-core-components` | Main entry - re-exports everything |
| `@openmetadata/ui-core-components/components` | All UI components |
| `@openmetadata/ui-core-components/theme` | MUI theme, `createMuiTheme` |
| `@openmetadata/ui-core-components/colors` | Color utilities, `generateMuiPalettes` |
| `@openmetadata/ui-core-components/utils` | `cx`, `sortCx`, utilities |
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
│   ├── globals.css        # Tailwind v4 config, plugins, custom variants/utilities
│   ├── theme.css          # CSS custom properties (design tokens, light/dark)
│   └── typography.css     # Typography scale
├── theme/                 # MUI theme configuration
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

Theme colors are defined as CSS custom properties in `src/styles/theme.css` with light and dark mode variants. Components reference these semantic tokens:

- **Backgrounds**: `bg-primary`, `bg-secondary`, `bg-error-secondary`, `bg-error-solid`
- **Text**: `text-primary`, `text-secondary`, `text-tertiary`, `text-fg-error-primary`
- **Featured icon**: `text-featured-icon-light-fg-{brand,error,gray,success,warning}`
- **Utility colors**: `border-utility-{brand,error,gray,success,warning}-{50-900}`

### Style Patterns

- Use `sortCx({})` to define style variant objects (enables Tailwind IntelliSense sorting)
- Use `cx()` (from `tailwind-merge`) to merge class names with conflict resolution
- Use `isReactComponent()` to type-guard icon props that accept both `FC` and `ReactNode`

### Button Color Variants

The `Button` component supports these `color` values:
- `primary`, `secondary`, `tertiary`, `link-gray`, `link-color`
- `primary-destructive`, `secondary-destructive`, `tertiary-destructive`, `link-destructive`

### Dark Mode

Dark mode uses a custom variant: `@custom-variant dark (&:where(.dark-mode, .dark-mode *))`. Toggle by adding `.dark-mode` class to a parent element.

### Externalized Dependencies (Vite rollup)

These are externalized in the build and must be provided by the consuming app:
- `react`, `react-dom`
- `@mui/material`, `@mui/system`, `@emotion/react`, `@emotion/styled`
- `notistack`

`tailwind-merge` is a dev dependency and bundled into the output. `react-aria-components` and `@untitledui/icons` are bundled as well.

## Adding New Components

1. Create the component file in the appropriate directory (`base/` for primitives, `application/` for composites, `foundations/` for design-token components)
2. Use `tw:` prefix on all Tailwind classes
3. Use `cx()` for class merging and `sortCx()` for style variant maps
4. Build on `react-aria-components` for accessibility
5. Export from `src/components/index.ts`
6. Run `yarn build` to verify compilation

## Relationship to UntitledUI Source

Components are adapted from the UntitledUI React library (cloned at `/Users/deuex/Documents/GitHub/untitled-ui/react/`). When porting components:
- Add `tw:` prefix to all Tailwind classes
- Replace `@/utils/cx` imports with the local `@/utils/cx` (same API)
- Replace `@/utils/is-react-component` with local `@/utils/is-react-component`
- Not all UntitledUI theme variants need to be ported — add only what's needed

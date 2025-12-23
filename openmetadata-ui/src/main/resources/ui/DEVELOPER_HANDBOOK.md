# OpenMetadata UI Developer Handbook

## 1. Folder Structure

```
@src/
│
├── assets/                # Static files (images, fonts, icons, etc.)
├── components/            # Reusable UI components (buttons, modals, etc.)
│   └── [ComponentName]/
│       ├── index.tsx
│       ├── [ComponentName].tsx
│       ├── [ComponentName].test.tsx
│       ├── [ComponentName].style.less
│       └── [ComponentName].types.ts   # (if needed, see below)
├── constants/             # App-wide constants and enums
├── context/               # React context providers
├── hooks/                 # Custom React hooks
├── interface/             # TypeScript interfaces and types (shared)
├── pages/                 # Top-level pages/views (mapped to routes)
│   └── [PageName]/
│       ├── index.tsx
│       ├── [PageName].tsx
│       ├── [PageName].test.tsx
│       ├── [PageName].style.less
│       └── [PageName].types.ts   # (if needed)
├── routes/                # Route definitions and helpers
├── store/                 # State management (Redux, Zustand, etc.)
├── api/                   # API service functions and clients
├── utils/                 # Utility/helper functions
├── styles/                # Global styles, variables, mixins (LESS)
├── App.tsx                # Main app component
├── index.tsx              # Entry point
└── ...                    # Other config files, setup, etc.
```

## 2. File Naming Conventions

- Use PascalCase for components, pages, and their folders: `UserProfile`, `UserProfile.tsx`
- Use camelCase for hooks and utility functions: `useFetchData.ts`, `formatDate.ts`
- Use UPPER_CASE for constants: `API_URL`
- Test files: `[ComponentName].test.tsx` or `[util].test.ts`
- Styles: `[ComponentName].style.less` for component-scoped styles
- Types: `[ComponentName].types.ts` for component-specific types (see below)

## 3. Component Structure

Each component/page should have its own folder containing:
- Main component file (`.tsx`)
- Test file (`.test.tsx`)
- Styles (`.style.less`)
- Index file for clean imports
- Types file (`.types.ts`) if types are complex or reused

Example:
```
components/
  Button/
    Button.tsx
    Button.test.tsx
    Button.style.less
    Button.types.ts
    index.ts
```

## 4. Component-Specific Types

- For simple or small components, define types/interfaces at the top of the component file.
- For complex components or when types are reused elsewhere, create a separate file:
  - `[ComponentName].types.ts`
- **Rule of Thumb:**
  - If the type is only used in one file and is simple, keep it in the same file.
  - If the type is reused or complex, use a separate `.types.ts` file.

## 5. API Layer

- All API calls go in `@src/api/`
- Group by resource (e.g., `userApi.ts`, `projectApi.ts`)
- Use TypeScript interfaces from `@src/interface/`
- Keep API logic separate from UI logic

## 6. State Management

- Use `@src/store/` for global state (Redux, Zustand, etc.)
- Organize by feature/domain
- Keep actions, reducers, and selectors together

## 7. Hooks

- Place all custom hooks in `@src/hooks/`
- Prefix with `use` (e.g., `useAuth.ts`)
- Keep hooks generic and reusable

## 8. Interfaces & Types

- All shared types/interfaces go in `@src/interface/`
- Group by domain or feature
- Import types from here in components, API, and store

## 9. Testing

- Use Jest + React Testing Library
- Test files live next to the code they test
- Cover components, hooks, utils, and API logic
- Follow [this](./playwright/PLAYWRIGHT_DEVELOPER_HANDBOOK.md) guide for e2e testing.

## 10. Routing

- Define all routes in `@src/routes/`
- Use a central file for route paths and lazy loading

## 11. Assets

- Place images, SVGs, fonts, etc. in `@src/assets/`
- Organize by type or feature

## 12. Styles

- Use LESS style for component styles (`.style.less`)
- Place global styles, variables, and mixins in `@src/styles/` as `.less` files

## 13. UI Library (MUI) and Icons (@untitledui/icons)

- Primary UI library: Material UI (MUI v5).
- Icon source: @untitledui/icons.

Recommended project layout for MUI and icons:
- Theme and providers:
  - @src/styles/theme.ts         -> createTheme, overrides, palette, typography
  - @src/styles/mui-overrides.less -> LESS file for any global CSS overrides (kept minimal)
  - App.tsx should wrap the app with MUI ThemeProvider and CssBaseline:
    - Place providers at top-level (App.tsx or @src/context/Providers.tsx).
- Component-level usage:
  - Prefer MUI components for common primitives (Button, TextField, Menu, Dialog).
  - Create small app-specific wrappers in @src/components/ui/ for commonly used variants:
    - e.g., @src/components/ui/Button/ (wrap MUI Button to apply project defaults)
- Styling with LESS styles and MUI:
  - Prefer MUI theming and the `sx` prop for dynamic styling (colors, spacing).
  - Use `.style.less` for component-specific static styles and layout that are easier in LESS.
  - Avoid conflicting global CSS rules; favour scoped className+style.less together with `sx` for theme-aware overrides.
  - For global MUI component overrides, use the theme `components` key in createTheme (not global CSS).
- Icons:
  - Import icons directly to keep bundle size small. Example:
    - import { IconName } from '@untitledui/icons';
  - Create a single re-export file for commonly used icons:
    - @src/assets/icons/index.ts — re-export the subset of icons used across app to centralize changes.
  - For rarely used icons, import directly where needed to enable tree-shaking.
  - Wrap icons in an Icon component if you need consistent sizing, color, or additional behavior:
    - @src/components/ui/Icon/Icon.tsx
- Accessibility and ARIA:
  - Use MUI's accessible primitives (IconButton with aria-label, role, etc.).
  - Ensure icons used as interactive elements have accessible names or aria-hidden when decorative.
- Testing with MUI:
  - Provide a test render helper that wraps components with ThemeProvider and any required context:
    - @src/test/utils/renderWithProviders.tsx
  - Mock or configure MUI components where needed in Jest for stable snapshots.
- Performance & bundle:
  - Prefer named imports to maintain tree-shaking for MUI and icon packages.
  - Keep the icon re-export file limited to used icons; avoid exporting entire icon packs.

## 14. General Rules

- Keep files small and focused
- Prefer composition over inheritance
- Use TypeScript everywhere
- Write clear, descriptive comments and JSDoc where needed
- Use absolute imports from `@src/` (configure `tsconfig.json` paths)
- Keep third-party code and wrappers in a separate folder if needed

---

This handbook ensures a clean, scalable, and consistent codebase for all developers.

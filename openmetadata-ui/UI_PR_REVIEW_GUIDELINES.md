# UI Pull Request Review Guidelines

This document outlines the standards and best practices that must be followed when reviewing pull requests for the OpenMetadata UI project. GitHub Copilot and human reviewers should use this as a checklist.

## TypeScript Type Safety

- [ ] **No `any` types**: Code must never use `any` type - use proper types or `unknown` with type guards
- [ ] **Proper type imports**: All types imported from existing definitions (e.g., `RJSFSchema` from `@rjsf/utils`, types from `generated/`)
- [ ] **Interface definitions**: All component props have defined interfaces in `.interface.ts` files
- [ ] **Type assertions**: Avoid type assertions unless absolutely necessary and well-justified
- [ ] **Discriminated unions**: Use discriminated unions for action types and state variants

## React Component Standards

### File Structure and Naming
- [ ] **Component files**: Named as `ComponentName.component.tsx`
- [ ] **Interface files**: Named as `ComponentName.interface.ts`
- [ ] **Functional components only**: No class components
- [ ] **Custom hooks**: Prefixed with `use`, placed in `src/hooks/`, return typed objects

### Component Implementation
- [ ] **State management**: Uses `useState` with proper typing
- [ ] **Effect dependencies**: `useEffect` has correct dependency arrays
- [ ] **Performance optimization**: `useCallback` for event handlers, `useMemo` for expensive computations
- [ ] **Loading states**: Uses object state for multiple loading states: `useState<Record<string, boolean>>({})`
- [ ] **Error handling**: Uses `showErrorToast` and `showSuccessToast` from ToastUtils
- [ ] **Navigation**: Uses `useNavigate` from react-router-dom, not direct history manipulation
- [ ] **Data fetching**: Async functions wrapped in try-catch blocks with proper loading state updates

## Internationalization (i18n)

- [ ] **No string literals**: All user-facing strings use `useTranslation` hook
- [ ] **Translation usage**: Uses `const { t } = useTranslation()` and accesses strings like `t('label.key')`
- [ ] **No hardcoded text**: All labels, messages, and UI text must come from locale files

## Styling and UI Components

### MUI Migration
- [ ] **Prefer MUI v7.3.1**: New features use Material-UI components, not Ant Design
- [ ] **Theme tokens**: Uses theme colors and design tokens from MUI theme, not hardcoded values
- [ ] **Theme reference**: Styles reference `openmetadata-ui-core-components` theme data
- [ ] **Legacy components**: Ant Design components only acceptable in existing code, flag for future refactoring

### CSS/Styling
- [ ] **BEM naming**: Custom CSS classes follow BEM convention
- [ ] **Component-specific naming**: Styles in `.less` files use component-specific naming
- [ ] **CSS modules**: Used where appropriate for better scoping

## Code Quality

### Import Organization
- [ ] **Correct order**: Imports organized as:
  1. External libraries (React, MUI, etc.)
  2. Internal absolute imports (`generated/`, `constants/`, `hooks/`)
  3. Relative imports (utilities, components)
  4. Asset imports (SVGs, styles)
  5. Type imports grouped separately

### ESLint and Code Standards
- [ ] **ESLint compliance**: No ESLint errors or warnings
- [ ] **No console statements**: Remove or properly handle console logs (project enforces no-console)
- [ ] **eslint-disable comments**: Only used when absolutely necessary with justification
- [ ] **Self-documenting code**: Clear variable and function names, minimal comments
- [ ] **Avoid over-engineering**: Only implement requested features, no speculative additions

### Comments Policy
- [ ] **No unnecessary comments**: Code is self-documenting
- [ ] **Justified comments only**: Comments only for:
  - Complex business logic
  - Non-obvious algorithms or workarounds
  - TODO/FIXME with ticket references
- [ ] **No obvious comments**: Avoid comments like "increment counter" or "create new user"

## State Management

- [ ] **Local state preferred**: Keep component state local with `useState` when possible
- [ ] **Zustand for global state**: Use Zustand stores (e.g., `useLimitStore`, `useWelcomeStore`)
- [ ] **Context providers**: Use for feature-specific shared state (e.g., `ApplicationsProvider`)

## Testing

- [ ] **Unit tests**: Jest tests for new components and utilities
- [ ] **Test coverage**: Meaningful tests, not just coverage numbers
- [ ] **E2E tests**: Playwright tests for critical user flows (when applicable)
- [ ] **Tests pass**: All tests pass locally with `yarn test`

## Build and Lint

- [ ] **Build succeeds**: `yarn build` completes without errors
- [ ] **Lint passes**: `yarn lint` passes without errors
- [ ] **Format check**: Code follows project formatting standards

## Schema and Type Generation

- [ ] **Schema changes**: If schemas modified, `yarn parse-schema` has been run
- [ ] **Generated types**: Uses generated TypeScript interfaces from `generated/` directory
- [ ] **Schema resolution**: Connection schemas properly resolved, Application schemas handled at runtime

## Performance

- [ ] **Unnecessary re-renders**: Components don't re-render unnecessarily
- [ ] **Memoization**: Expensive computations properly memoized
- [ ] **Bundle size**: No unnecessary dependencies or imports
- [ ] **Lazy loading**: Large components lazy-loaded when appropriate

## Accessibility

- [ ] **Semantic HTML**: Uses appropriate semantic elements
- [ ] **ARIA labels**: Proper ARIA attributes for interactive elements
- [ ] **Keyboard navigation**: Interactive elements accessible via keyboard
- [ ] **MUI accessibility**: MUI components used correctly with accessibility in mind

## Security

- [ ] **No secrets**: No API keys, tokens, or credentials in code
- [ ] **Input validation**: User inputs properly validated
- [ ] **XSS prevention**: No dangerouslySetInnerHTML without sanitization
- [ ] **Secure dependencies**: No known vulnerabilities in dependencies

## Documentation

- [ ] **Prop interfaces**: Complex props documented with JSDoc when necessary
- [ ] **README updates**: Component README updated if adding new patterns
- [ ] **Migration notes**: Breaking changes documented

## Git and Version Control

- [ ] **Atomic commits**: Commits are logical and focused
- [ ] **No commented code**: Removed code deleted, not commented out
- [ ] **No debug code**: Console logs and debug statements removed
- [ ] **Clean git history**: No merge commits in feature branches (rebase preferred)

## Specific to OpenMetadata UI

- [ ] **Service utilities**: Follows patterns in existing service utility files
- [ ] **ApplicationsClassBase**: Applications properly use schema loading and configuration
- [ ] **RJSF forms**: Form schemas use React JSON Schema Form with custom UI widgets
- [ ] **Dynamic imports**: Application-specific schemas and assets use dynamic imports
- [ ] **Type safety with generated types**: API responses use interfaces from `generated/` directory

## Before Merging Checklist

- [ ] All automated checks pass (CI/CD)
- [ ] Code review approved by at least one maintainer
- [ ] No merge conflicts with target branch
- [ ] Branch is up to date with main/target branch
- [ ] All review comments addressed or discussed
- [ ] Screenshots/videos provided for UI changes
- [ ] Testing instructions clear and verified

---

## Quick Reference Commands

```bash
# Run before requesting review
yarn lint              # Check for linting errors
yarn lint:fix          # Auto-fix linting issues
yarn test              # Run unit tests
yarn build             # Verify build succeeds
yarn playwright:run    # Run E2E tests (if applicable)
```

## Common Issues to Flag

1. **Hardcoded strings** instead of translation keys
2. **`any` type usage** anywhere in TypeScript
3. **Ant Design components** in new features (should use MUI)
4. **Hardcoded colors** instead of theme tokens
5. **Missing error handling** in async operations
6. **Console.log** statements left in code
7. **Unnecessary comments** explaining obvious code
8. **Missing TypeScript interfaces** for props
9. **Direct DOM manipulation** instead of React patterns
10. **Missing dependency arrays** in useEffect/useCallback/useMemo

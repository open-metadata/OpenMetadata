# OpenMetadata UI Component Library

A local React + TypeScript component library for OpenMetadata UI, using Untitled UI, Vite, Storybook, and Jest.

## Features

- Fast Vite bundling
- Storybook for component docs/dev
- Jest + React Testing Library for unit tests
- Theme customization via React context
- No npm publish required; use as a local dependency

## Getting Started

### 1. Install dependencies

```sh
yarn install
```

### 2. Run Storybook

```sh
yarn storybook
```

Visit [http://localhost:6006](http://localhost:6006) to view stories.

### 3. Run tests

```sh
yarn test
```

### 4. Build library

```sh
yarn build
```

### 5. Use in OpenMetadata UI

In `openmetadata-ui/package.json`:

```json
"@openmetadata-ui/component-library": "file:../openmetadata-ui-component-library"
```

Then run `yarn install` in `openmetadata-ui`.

## Theme Customization

Wrap your app or stories with `ThemeProvider` and pass a custom theme:

```tsx
import { ThemeProvider } from "@openmetadata-ui/component-library";

const customTheme = {
  button: {
    backgroundColor: "#222",
    color: "#fff",
    borderRadius: "8px",
  },
};

<ThemeProvider theme={customTheme}>
  <Button>Custom Button</Button>
</ThemeProvider>;
```

## Add Components

- Place new components in `src/components/YourComponent/`
- Add stories and tests for each component

## Troubleshooting

- Ensure all peer dependencies (React, Untitled UI) are installed
- If you see TypeScript or Jest errors, check your dependency versions

---

MIT License

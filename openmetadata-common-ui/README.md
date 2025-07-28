# OpenMetadata Common UI

This project contains common UI components that are shared across the OpenMetadata platform.

## List of Components

### RichTextEditorPreviewerV1

A React component for previewing rich text content with markdown support.

### Development

```bash
cd src/main/resources/ui
yarn install
yarn build
```

### Storybook

This project includes Storybook for component development and documentation. You can:

**Start Storybook development server:**

```bash
cd src/main/resources/ui
yarn storybook
```

**Build Storybook for production:**

```bash
cd src/main/resources/ui
yarn build-storybook
```

The Storybook server will start on `http://localhost:6006` and provides an interactive environment to develop and test UI components in isolation.

## Usage

To use this package in other projects, add it to your `package.json` dependencies:

```json
{
  "dependencies": {
    "@openmetadata/common-ui": "file:../../../../../openmetadata-common-ui/src/main/resources/ui/dist"
  }
}
```

This will link to the built distribution of the common UI components.

## Dependencies

This library uses peer dependencies for React and other common libraries to avoid version conflicts:

- React 18.2.0+
- React DOM 18.2.0+
- Ant Design 4.24.16
- Classnames 2.3.1+
- React i18next 15.5.3+

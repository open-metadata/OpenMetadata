# Playwright Documentation Generator

This directory contains the custom tooling used to generate the E2E test documentation found in `../docs`.

## 🏗️ Architecture

The generator consists of three main components:

1.  **`generate.js`** (Orchestrator)
    *   Main entry point.
    *   Manages the `DOMAIN_MAPPING` to categorize tests into domains (e.g., Governance, Platform).
    *   Calls the loader to get test data.
    *   Calls the markdown generator to create strings.
    *   Writes the final `.md` files to the output directory.

2.  **`playwright-loader.js`** (Data Provider)
    *   **Test Discovery**: Uses `npx playwright test --list --reporter=json` to get an accurate list of all tests from Playwright itself.
    *   **Temp Config**: Created a temporary `playwright.docs.temp.config.ts` during execution to ensure *all* tests (including ignored/nightly ones) are included in the discovery phase.
    *   **AST Parsing**: Uses the TypeScript Compiler API (`typescript` package) to parse the source code of test files.
        *   Extracts `test.step('Step Name', ...)` calls to provide granular details.
        *   Extracts JSDoc comments for test descriptions.

3.  **`markdown.js`** (Renderer)
    *   Contains template functions (`generateIndexMarkdown`, `generateDomainMarkdown`).
    *   Handles the calculation of metrics like "Total Scenarios".
    *   **Metrics Logic**:
        *   **Tests**: Raw count of `test(...)` blocks.
        *   **Total Scenarios**: Calculated as `(Steps > 0 ? Steps : 1)`. If a test has steps, each step is a scenario. If not, the test itself counts as one.

## 🚀 Usage

To regenerate the documentation manually:

```bash
# From the project root
yarn generate:e2e-docs
```

## 🛠️ Key Features

*   **Total Scenarios Metric**: Provides a more accurate measure of test depth by counting individual steps as scenarios.
*   **Granular Step Display**: test steps are extracted and displayed as `↳ Step Name` in the documentation tables.
*   **Domain Categorization**: Tests are automatically grouped into domains (Discovery, Governance, etc.) based on file paths and explicit overrides in `generate.js`.
*   **Zero New Dependencies**: Uses existing project dependencies (`playwright`, `typescript`, `dotenv`).

## 🔄 Workflow Integration

### Automation
A GitHub Actions workflow is available to automate the documentation update process and ensure the `main` branch always has the latest E2E docs.

*   **Workflow Name**: `Update Playwright E2E Documentation`
*   **File**: `.github/workflows/update-playwright-e2e-docs.yml`
*   **Trigger**: Manual trigger via `workflow_dispatch`.
*   **Logic**:
    1.  Runs against the `main` branch.
    2.  Installs dependencies using `yarn install --frozen-lockfile`.
    3.  Executes documentation generation via `yarn generate:e2e-docs`.
    4.  **Detection**: Uses `git status` to detect if any documentation files were modified.
    5.  **Auto PR**: If changes are found, it creates/updates the `chore/update-playwright-docs` branch and automatically opens a Pull Request to `main`.

### Manual Generation
You can still run the generator manually in your local environment before pushing:
```bash
yarn generate:e2e-docs
```

## 🏷️ Classification & Tagging Guide

The generator decides which Domain and Component a test belongs to using the following priority logic:

### 1. Explicit Tag Override (Highest Priority)
If you want full control over the Domain and Component name, use the format `@Domain:Component`.

*   **Format**: `@<Domain>:<Component_Name>`
*   **Underscores**: Use underscores in the component name to represent spaces.
*   **Example**:
    ```javascript
    // Result: Domain = Observability, Component = Data Quality
    test.describe('My Test', { tag: '@Observability:Data_Quality' }, () => ...
    ```

### 2. Domain Tag + Filename Match
If you provide a valid Domain tag (e.g., `@Observability`, `@Governance`), the generator enforces that domain.
It then checks if the **Filename** matches any known component within that domain.

*   **Valid Domains**: `Governance`, `Discovery`, `Platform`, `Observability`, `Integration`.
*   **Example**:
    *   File: `AddTestCaseNewFlow.spec.ts`
    *   Tag: `@Observability` (from `${DOMAIN_TAGS.OBSERVABILITY}`)
    *   Result: The filename contains "TestCase", which maps to "Data Quality". Since "Data Quality" is in the "Observability" domain, it is correctly classified as **Observability / Data Quality**.

### 3. Filename Fallback (Lowest Priority)
If no valid tags are found (or if the tag is ignored, like `@ingestion`), the generator falls back to strict filename matching against `DOMAIN_MAPPING`.

*   **Example**:
    *   File: `IncidentManager.spec.ts`
    *   Tag: `@ingestion` (Ignored)
    *   Result: `IncidentManager` maps to **Observability / Incident Manager** in `DOMAIN_MAPPING`.


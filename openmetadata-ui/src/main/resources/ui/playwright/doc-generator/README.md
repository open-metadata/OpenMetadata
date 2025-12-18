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
node openmetadata-ui/src/main/resources/ui/playwright/doc-generator/generate.js
```

## 🛠️ Key Features

*   **Total Scenarios Metric**: Provides a more accurate measure of test depth by counting individual steps as scenarios.
*   **Granular Step Display**: test steps are extracted and displayed as `↳ Step Name` in the documentation tables.
*   **Domain Categorization**: Tests are automatically grouped into domains (Discovery, Governance, etc.) based on file paths and explicit overrides in `generate.js`.
*   **Zero New Dependencies**: Uses existing project dependencies (`playwright`, `typescript`, `dotenv`).

## 🔄 Workflow Integration (Rock Solid Automation)

Documentation is automatically kept in sync through two layers of automation:

### 1. Pre-commit Hook (Local)
Defined in `.lintstagedrc.yaml`.
*   **Trigger**: Any change to `playwright/e2e/**/*.spec.ts`.
*   **Action**: Automatically runs `node playwright/doc-generator/generate.js`.
*   **Result**: The updated `docs/` are generated and `git add`ed to your commit automatically. You don't need to do anything manually.

### 2. GitHub Actions (CI Safety Net)
Defined in `.github/workflows/playwright-docs-check.yml`.
*   **Trigger**: Pull Requests to `main`.
*   **Action**: Checks if the documentation matches the code.
*   **Auto-Fix**: If docs are outdated (e.g., if the pre-commit hook was bypassed), the CI job will:
    1.  Fail the initial check.
    2.  Regenerate the documentation.
    3.  **Automatically commit and push** the fixes to your PR branch.


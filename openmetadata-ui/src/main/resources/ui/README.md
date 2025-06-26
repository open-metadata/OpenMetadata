# OpenMetadata UI

> This guide will help you run OpenMetadata UI locally in dev mode.

## Pre-requisites

Before proceeding, ensure that you have installed the node and yarn with the versions given below.

```
"node": ">=18.19.0",
"yarn": "^1.22.0"
```

Install [Node](https://nodejs.org/en/download/) and [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/).<br />

Install ANTLR using our recipes via

```shell
sudo make install_antlr_cli
```

Using the command below, spin up the server locally from the directory `openmetadata-dist/target/openmetadata-*-SNAPSHOT`

```shell
./bin/openmetadata-server-start.sh conf/openmetadata.yaml
```

> If you don't have distributions generated or don't see `target` directory inside the `openmetadata-dist` then follow [this](https://docs.open-metadata.org/developers/contribute/build-code-and-run-tests/openmetadata-server#create-a-distribution-packaging) guide to create a distribution.
>
> Since typescript is heavily used in the OpenMetadata project, we generate the typescript types and the interface from JSON schema. We use the `QuickType` tool to generate the typescript types and interfaces. You can view the complete instructions [here](https://docs.open-metadata.org/developers/contribute/build-code-and-run-tests/generate-typescript-types-from-json-schema).

Alternatively, you can connect to an already started OpenMetadata Server to develop UI by setting the `DEV_SERVER_TARGET` environment variable.
```shell
# For example, the openmetedata server service launched with docker compose:
# https://github.com/open-metadata/OpenMetadata/blob/main/docker/development/docker-compose.yml
export DEV_SERVER_TARGET=http://openmetadata-server:8585/

# Follow the steps to Run OpenMetadata UI...
make yarn_start_dev_ui
```

## Steps to Run OpenMetadata UI

Once the node and yarn are installed in the system, you can perform the following steps to run OpenMetadata UI.

**Step 1**: Run the given command to install the required dependencies.

**Note**: It's a one-time task to install dependencies. If there are any changes in the `package.json` file, the following steps will have to be performed again.

```shell
# installing dependencies
> make yarn_install_cache
```

**Step 2**: Start the UI locally

```shell
# starting the UI locally
> make yarn_start_dev_ui
```

**Step 3**: Visit [localhost:3000](http://localhost:3000/) to access the OpenMetadata UI.

## How to Add Language Support

To add support for a new language in our internationalization setup using `react-i18next` and `i18next`, please follow the steps below:

### Create a Language JSON File

First, create a new JSON file for the language you want to add in the `openmetadata-ui/src/main/resources/ui/src/locale/languages` directory.

For example, if you want to add support for the `French` language, you can create a file called `fr-fr.json` in the languages directory:

```shell
# Navigate to the ui/src/locale/languages directory
cd openmetadata-ui/src/main/resources/ui/src/locale/languages

# Create the French language file
touch fr-fr.json

```

### Sync the Language File with the Primary Language

To ensure consistency with our primary language, which is `en-us`, it is necessary to synchronize any newly added language files. This can be done by copying the content from the `en-us.json` file and translating it accordingly.

To copy the contents of en-us.json and add it to your translation JSON file, follow these steps:

- Go to [en-us.json](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/src/locale/languages/en-us.json)
- Copy the content of file
- Open your translation JSON file.
- Paste the copied text into your translation JSON file.

You can refer to the image below for a visual guide:

![image](https://user-images.githubusercontent.com/59080942/227428589-5770b06e-f88d-4a8c-8c45-35ed12f0c4d2.png)

## Running Playwright Tests

OpenMetadata UI uses Playwright for end-to-end testing. This section will guide you through setting up and running Playwright tests.

### Prerequisites

Before running Playwright tests, ensure you have:

1. **OpenMetadata Server Running**: The tests require a running OpenMetadata server instance. You can either:
   - Use a local server (default: `http://localhost:8585`)
   - Set the `PLAYWRIGHT_TEST_BASE_URL` environment variable to point to your server

2. **Admin User Setup**: Tests require an admin user with the following credentials:
   - Email: `admin@openmetadata.org`
   - Password: `admin`

### Installation

Playwright is already included in the project dependencies. If you need to install Playwright browsers, run:

```shell
npx playwright install
```

### Running Tests

#### 1. Run All Tests

```shell
# Run all Playwright tests
yarn playwright:run
```

#### 2. Run Tests with UI Mode

For interactive debugging and test development:

```shell
# Open Playwright UI mode
yarn playwright:open
```

#### 3. Generate Test Code

To create new tests using Playwright's code generation:

```shell
# Start code generation
yarn playwright:codegen
```

### Test Structure

The Playwright tests are organized as follows:

```
playwright/
├── e2e/                    # Main test directory
│   ├── Features/           # Feature-specific test files
│   ├── Pages/              # Page object models
│   ├── Flow/               # Test flows and workflows
│   ├── auth.setup.ts       # Authentication setup
│   └── auth.teardown.ts    # Authentication cleanup
├── support/                # Test support utilities
├── utils/                  # Common test utilities
├── constant/               # Test constants and configurations
└── output/                 # Test results and reports
```

### Test Configuration

The Playwright configuration is defined in `playwright.config.ts` and includes:

- **Base URL**: Defaults to `http://localhost:8585`
- **Browsers**: Tests run on Chromium by default
- **Parallel Execution**: Tests run in parallel for faster execution
- **Retries**: Tests retry once on CI environments
- **Reports**: HTML reports are generated in `playwright/output/playwright-report`

### Authentication Setup

The tests use a sophisticated authentication system that creates multiple user roles:

- **Admin**: Full access to all features
- **Data Consumer**: Limited access for data consumption
- **Data Steward**: Access for data stewardship tasks
- **Custom Users**: Users with specific permissions (edit descriptions, tags, glossary terms)

Authentication states are saved in `playwright/.auth/` directory for reuse across test runs.

### Running Specific Tests

#### Run Tests by File Pattern

```shell
# Run tests matching a specific pattern
npx playwright test --grep "Table"
```

#### Run Tests by File

```shell
# Run a specific test file
npx playwright test Features/Table.spec.ts
```

#### Run Tests in Headed Mode

```shell
# Run tests with browser visible
npx playwright test --headed
```

#### Run Tests in Debug Mode

```shell
# Run tests with debugger attached
npx playwright test --debug
```

### Test Reports

After running tests, you can view detailed reports:

```shell
# Open the HTML report
npx playwright show-report
```

Reports include:
- Test results and status
- Screenshots on failure
- Video recordings (if enabled)
- Trace files for debugging

### Environment Variables

You can customize test behavior using environment variables:

```shell
# Set custom base URL
export PLAYWRIGHT_TEST_BASE_URL=http://your-server:8585

# Enable trace collection
export PLAYWRIGHT_TRACE=on

# Set test timeout
export PLAYWRIGHT_TIMEOUT=120000
```

### Writing New Tests

When writing new tests, follow these guidelines:

1. **Use Page Object Model**: Create page objects in `playwright/e2e/Pages/`
2. **Follow Naming Convention**: Use descriptive test names and file names
3. **Handle Authentication**: Use the existing authentication setup
4. **Add Proper Assertions**: Include meaningful assertions for test validation
5. **Clean Up**: Ensure tests clean up after themselves

Example test structure:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../Pages/LoginPage';

test.describe('Feature Name', () => {
  test('should perform specific action', async ({ page }) => {
    // Test implementation
    const loginPage = new LoginPage(page);
    await loginPage.login();
    
    // Add assertions
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

### Troubleshooting

#### Common Issues

1. **Server Not Running**: Ensure OpenMetadata server is running and accessible
2. **Authentication Failures**: Verify admin credentials are correct
3. **Browser Issues**: Reinstall Playwright browsers if needed
4. **Timeout Errors**: Increase timeout values for slower environments

#### Debug Commands

```shell
# Run with verbose logging
npx playwright test --reporter=list

# Run with trace enabled
npx playwright test --trace=on

# Run specific test with debug
npx playwright test --debug Features/YourTest.spec.ts
```

### CI/CD Integration

For continuous integration, the tests are configured to:

- Run in headless mode
- Generate reports for artifact storage
- Use GitHub Actions reporter for better CI visibility
- Retry failed tests once
- Limit parallel workers to 4 for stability

The configuration automatically adapts based on the `CI` environment variable.



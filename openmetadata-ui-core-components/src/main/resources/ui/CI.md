# CI/CD Configuration for UI Core Components

## GitHub Actions Workflow

The UI Core Components Jest tests are automatically run in CI using GitHub Actions.

### Workflow File

`.github/workflows/ui-core-components-tests.yml`

### Triggers

The workflow runs on:

1. **Pull Requests** when:
   - Opened, synchronized, or reopened
   - Changes are made to files in `openmetadata-ui-core-components/src/main/resources/ui/`

2. **Push to branches**:
   - `main`
   - `release-*` branches

3. **Manual Trigger** (`workflow_dispatch`):
   - Run on-demand via GitHub Actions UI
   - Optional parameters:
     - **branch**: Branch to run tests on (default: `main`)
     - **run-coverage**: Generate coverage report (default: `true`)
     - **skip-type-check**: Skip TypeScript type check (default: `false`)

### How to Run Manually

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Select **UI Core Components Tests** workflow
4. Click **Run workflow** button (top right)
5. Configure options:
   - **Branch**: Select or enter the branch name
   - **Generate coverage report**: Check/uncheck
   - **Skip TypeScript type check**: Check/uncheck
6. Click **Run workflow**

### Jobs

#### 1. Unit Tests (`unit-tests`)
- Runs Jest tests with coverage
- Uses Node.js 22.17.0
- Runs with `--maxWorkers=2` for CI optimization
- Generates coverage reports
- Uploads coverage to Codecov
- Comments on PRs with test results and coverage summary

#### 2. Type Check (`type-check`)
- Runs TypeScript type checking
- Ensures no type errors in the codebase

#### 3. Lint (`lint`)
- Runs ESLint if configured
- Continues on error (non-blocking)

### Features

✅ **Coverage Reporting**: Automatically generates and uploads coverage reports
✅ **PR Comments**: Posts test results and coverage summary as PR comments
✅ **Artifacts**: Archives test results for 30 days
✅ **Codecov Integration**: Uploads coverage to Codecov (requires `CODECOV_TOKEN`)
✅ **Path Filtering**: Only runs when relevant files change
✅ **Parallel Jobs**: Runs tests, type-check, and lint in parallel

### Coverage Report Example

The workflow will comment on your PR with:

```markdown
## 🧪 UI Core Components Test Results

### Coverage Summary

| Metric | Coverage |
|--------|----------|
| Statements | 85.5% |
| Branches | 78.2% |
| Functions | 82.1% |
| Lines | 85.3% |

**Status:** success
**Workflow:** [UI Core Components Tests](link-to-workflow-run)
```

### Local Testing

Before pushing, you can run the same tests locally:

```bash
# Run tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run type check
yarn type-check
```

### Configuration

The workflow uses the following configuration files:
- `jest.config.ts` - Jest configuration
- `tsconfig.json` - TypeScript configuration
- `package.json` - Scripts and dependencies

### Troubleshooting

**Test failures**: Check the workflow logs for detailed error messages

**Coverage upload fails**: Ensure `CODECOV_TOKEN` is set in repository secrets

**Workflow doesn't trigger**: Verify file paths in the `paths` filter match your changes

### Codecov Setup (Optional)

To enable Codecov integration:

1. Sign up at [codecov.io](https://codecov.io)
2. Add your repository
3. Get your Codecov token
4. Add it to GitHub repository secrets as `CODECOV_TOKEN`

If you don't use Codecov, the workflow will continue without errors (using `fail_ci_if_error: false`).

## Continuous Integration Best Practices

1. **Run tests locally before pushing**
2. **Keep tests fast** - Current tests run in ~7 seconds
3. **Maintain high coverage** - Aim for >80% coverage
4. **Fix failing tests immediately** - Don't merge PRs with failing tests
5. **Review coverage reports** - Check that new code is properly tested

## Monitoring

View workflow runs:
- Go to your repository on GitHub
- Click "Actions" tab
- Select "UI Core Components Tests" workflow

## Making Changes to the Workflow

To modify the workflow:

1. Edit `.github/workflows/ui-core-components-tests.yml`
2. Test locally if possible
3. Submit as part of your PR
4. Workflow changes trigger a test run automatically

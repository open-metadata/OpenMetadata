# 🎭 Playwright E2E Testing & Coverage

This guide helps you run End-to-End (E2E) tests and generate code coverage reports for the OpenMetadata UI.

## 🚀 Quick Start (Recommended)

### Local Development Loop
To run all tests and generate a coverage report locally against a dev server:

```bash
yarn run test:e2e:ci
```

### Production/CI Loop (Port 8585)
If your CI runs tests against a **production build** (e.g., served by Java on port 8585), you must ensure the build itself is instrumented.

1. **Build with Coverage**:
   ```bash
   # Create an instrumented build
   VITE_COVERAGE=true yarn run build
   ```

2. **Deploy/Serve**:
   Start your Java backend (which serves the `dist/` folder created above).

3. **Run Tests**:
   Run the tests against your CI server URL (e.g., http://localhost:8585).
   ```bash
   PLAYWRIGHT_TEST_BASE_URL=http://localhost:8585 yarn run playwright:coverage
   ```

4. **Generate Report**:
   ```bash
   yarn run coverage:report
   ```

**What this does:**
1. Runs a custom Node script (`scripts/ci-e2e-coverage.js`).
2. Starts the server on port 3001 with coverage enabled.
3. waits for the port to be ready.
4. Runs Playwright tests and generates the report.
5. Safely shuts down the server.

---

## 📊 Viewing the Report

After the tests complete, you can find the reports in the `coverage/` folder:

- **HTML Report**: Open `coverage/index.html` in your browser to see a visual breakdown.
- **Summary**: A text summary is printed to your terminal.

---

## 🛠️ Manual Execution (For Debugging)

If you need more control (e.g., keeping the server running while you debug tests), follow these steps:

### 1. Start the Server with Coverage
You must explicitly enable coverage when starting the server.

```bash
VITE_COVERAGE=true yarn run start --port 3001
```

### 2. Run Tests
In a separate terminal, run the tests. Note that for manual runs, you might need to set `PLAYWRIGHT_TEST_BASE_URL` if not using the default.

```bash
# Run all tests (assumes server at localhost:3000 or config default)
VITE_COVERAGE=true yarn run playwright:coverage

# OR run a specific test file
VITE_COVERAGE=true yarn run playwright:coverage tests/my-feature.spec.ts
```

> **Note**: We kept `VITE_COVERAGE=true` for manual runs to be explicit, though the `playwright:coverage` script in `package.json` now expects the specific environment or config to be set. Since we removed `cross-env`, on Windows use: `set VITE_COVERAGE=true && yarn run playwright:coverage`

### 3. Generate Report
Once testing is done, generate the report:

```bash
yarn run coverage:report
```

---

## 🤖 CI/CD Integration

For CI pipelines (like GitHub Actions), use the single command or split steps if you need artifact caching.

**Example Workflow Step:**
```yaml
- name: Run E2E Tests with Coverage
  run: yarn run test:e2e:ci

- name: Post Coverage Summary
  run: node scripts/format-coverage-summary.js > coverage-summary.md
```

## ❓ Troubleshooting

- **Coverage is empty/zero?**
  Ensure you started the server with `VITE_COVERAGE=true`. Normal `yarn start` does **not** collect coverage.

- **Port 3000/3001 in use?**
  The `test:e2e:ci` command uses port **3001** by default to avoid conflicting with your default dev server. Ensure this port is free or update the command in `package.json`.

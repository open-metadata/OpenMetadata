---
name: test-enforcement
description: Use after implementing any feature or fix to ensure comprehensive test coverage. Enforces 90% line coverage in openmetadata-service, integration tests for all API endpoints in openmetadata-integration-tests, and Playwright E2E tests for UI changes.
user-invocable: true
argument-hint: "[PR number, branch name, or file paths]"
---

# Test Enforcement for OpenMetadata

Ensure every code change has comprehensive tests — 90% line coverage for service code, integration tests for APIs, and Playwright E2E tests for UI changes.

## When to Use

- After implementing any feature or bug fix (before creating a PR)
- When reviewing a PR to check test completeness
- When the `/tdd` skill was not used during implementation

## Workflow

### Step 1: Identify Changed Files

Determine what changed and classify by layer:

```bash
# Branch changes
git diff main...HEAD --name-only

# Or staged changes
git diff --cached --name-only

# Or PR changes
gh pr diff <number> --name-only
```

Classify each changed file:

| File path pattern | Layer | Required tests |
|---|---|---|
| `openmetadata-service/src/main/` | Java backend | Unit tests (90% coverage) + integration tests |
| `openmetadata-spec/src/main/resources/json/schema/` | Schema | Regeneration verification + downstream tests |
| `openmetadata-integration-tests/` | Integration tests | Self — verify they pass |
| `ingestion/src/metadata/` | Python ingestion | pytest unit tests (90% coverage) |
| `openmetadata-ui/.../ui/src/` | React frontend | Jest unit tests + Playwright E2E |
| `bootstrap/sql/migrations/` | Database | Integration tests verifying migration |

### Step 2: Check Java Service Coverage

For any changes under `openmetadata-service/src/main/`:

#### 2a. Find existing tests

```bash
# For a changed class Foo.java, find its test
CHANGED_CLASS="Foo"
find openmetadata-service/src/test -name "${CHANGED_CLASS}Test.java" -o -name "${CHANGED_CLASS}Tests.java"

# Also check integration tests
find openmetadata-integration-tests/src/test -name "*${CHANGED_CLASS}*IT.java"
```

#### 2b. Run coverage for the module

```bash
mvn test -pl openmetadata-service -P static-code-analysis -Dtest=<TestClass>
# Coverage report: openmetadata-service/target/site/jacoco/index.html
```

#### 2c. Verify 90% line coverage for changed code

After running tests, check the JaCoCo report for the specific classes you changed:

```bash
# Parse the JaCoCo XML report for specific classes
REPORT="openmetadata-service/target/site/jacoco/jacoco.xml"
# Look for coverage of your specific packages/classes
grep -A5 "name=\"YourClassName\"" "$REPORT"
```

**Target: 90% line coverage on all changed/new classes.**

#### 2d. Generate missing tests

If coverage is below 90%, create tests following these patterns:

**Unit tests** (`openmetadata-service/src/test/`):
- Test public methods with meaningful inputs
- Test edge cases: null inputs, empty collections, boundary values
- Test error paths: invalid input, missing data, permission denied
- Use descriptive test names: `testCreateEntityWithValidInput`, `testDeleteEntityNotFound`

**Do NOT:**
- Mock internal OpenMetadata classes — write integration tests instead
- Test obvious getters/setters
- Write tests that only verify mock wiring

### Step 3: Check Integration Tests for API Endpoints

For any changes to REST resources or entity logic:

#### 3a. Map changed code to API endpoints

```bash
# Find resource classes that changed
git diff main...HEAD --name-only | grep -E "Resource\.java$"

# Find the @Path annotations to identify endpoints
grep -n "@Path" <resource-file>
```

#### 3b. Check existing integration tests

```bash
# Integration test naming convention: <Entity>IT.java
find openmetadata-integration-tests/src/test -name "*IT.java" | sort
```

Every REST resource should have a corresponding `*IT.java` that tests:

| Operation | What to test |
|---|---|
| **Create** | Valid creation, duplicate handling, missing required fields |
| **Get** | By ID, by name, with fields parameter, not found |
| **List** | Pagination, filtering, sorting, limit |
| **Update (PUT)** | Full update, partial update, version increment |
| **Patch** | JSON patch operations, concurrent modification |
| **Delete** | Soft delete, hard delete, cascade behavior |
| **Custom endpoints** | Any non-CRUD endpoints specific to the entity |

#### 3c. Verify integration tests use the current patterns

Tests must follow these patterns:

```java
// Extend BaseEntityIT for entity resources
class MyEntityIT extends BaseEntityIT<MyEntity, CreateMyEntity> {

    @Override
    protected CreateMyEntity createMinimalRequest(TestNamespace testNamespace) {
        // Return minimal valid create request
    }

    @Test
    void testCustomBehavior(TestNamespace testNamespace) {
        // Test entity-specific behavior
    }
}
```

**Key patterns:**
- Use `TestNamespace` for test isolation (not `TestInfo`)
- Use `OpenMetadataClient` SDK for API calls
- Use typed exceptions, not raw HTTP status codes
- Create entities via API, assert on API responses
- Clean up created entities in test teardown

#### 3d. Generate missing integration tests

If an API endpoint lacks integration test coverage:

1. Read the existing `BaseEntityIT` to understand the contract
2. Read a similar entity's IT class as a reference pattern
3. Create the IT class with all CRUD operations tested
4. Add entity-specific endpoint tests
5. Run and verify:
   ```bash
   mvn verify -pl openmetadata-integration-tests -Dtest=MyEntityIT
   ```

### Step 4: Check Playwright E2E Tests

For any changes under `openmetadata-ui/src/main/resources/ui/src/`:

#### 4a. Identify UI features affected

Map changed components to user-facing features:

```bash
# What components changed?
git diff main...HEAD --name-only | grep -E '\.(tsx?|component\.tsx)$'

# What pages/features do they belong to?
# Check the component's imports and route usage
```

#### 4b. Check existing Playwright coverage

```bash
# Find specs that test the affected feature
find openmetadata-ui/src/main/resources/ui/playwright/e2e -name "*.spec.ts" | xargs grep -l "<feature-keyword>"

# List all spec files by category
ls openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/
ls openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/
ls openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/
```

#### 4c. Determine if new Playwright tests are needed

**New Playwright tests ARE needed when:**
- A new page or major UI section was added
- User-facing workflow was changed (e.g., entity creation flow)
- New permissions or role-based behavior was added
- A UI bug was fixed (regression test)

**New Playwright tests are NOT needed when:**
- Only internal refactoring with no visible behavior change
- Style-only changes (colors, spacing)
- Changes already covered by existing specs (verify by running them)

#### 4d. Generate missing Playwright tests

Use the `/playwright` skill to generate tests. At minimum, verify:

1. **Read the Playwright Developer Handbook first:**
   ```
   openmetadata-ui/src/main/resources/ui/playwright/PLAYWRIGHT_DEVELOPER_HANDBOOK.md
   ```

2. **Required test coverage for new features:**
   - Happy path — feature works as expected
   - Permission boundaries — admin vs. data consumer vs. data steward
   - Data persistence — changes survive page reload
   - Error states — invalid input, network errors
   - Navigation — feature accessible from expected entry points

3. **Run and verify:**
   ```bash
   cd openmetadata-ui/src/main/resources/ui
   yarn playwright:run --grep "<test name>"
   ```

4. **Run the linter:**
   ```bash
   yarn lint:playwright
   ```

### Step 5: Check Jest Unit Tests for Frontend

For component changes, verify Jest coverage:

```bash
cd openmetadata-ui/src/main/resources/ui

# Run tests for changed files with coverage
yarn test --coverage --collectCoverageFrom='src/path/to/changed/**/*.{ts,tsx}' path/to/test.spec.ts

# Check coverage report
# Lines, branches, functions should be >= 90%
```

**Every component should have a co-located `.test.ts` or `.test.tsx` file.**

### Step 6: Check Python Ingestion Tests

For changes under `ingestion/src/metadata/`:

```bash
source env/bin/activate && cd ingestion

# Find tests for changed modules
CHANGED="my_module"
find tests/unit -name "*${CHANGED}*" -o -name "*test_${CHANGED}*"

# Run with coverage for specific modules
python -m pytest tests/unit/path/to/test.py -v --cov=metadata.ingestion.source.database.my_module --cov-report=term-missing

# Verify >= 90% coverage
```

### Step 7: Generate Coverage Report

Produce a summary for the PR:

```
## Test Coverage Report

### Java Service (openmetadata-service)
| Class | Lines | Branches | Status |
|-------|-------|----------|--------|
| NewFeature.java | 92% | 85% | PASS |
| ModifiedClass.java | 88% | 80% | NEEDS WORK |

### Integration Tests (openmetadata-integration-tests)
| Endpoint | Create | Get | List | Update | Delete | Custom |
|----------|--------|-----|------|--------|--------|--------|
| /api/v1/myEntity | PASS | PASS | PASS | PASS | PASS | PASS |

### Playwright E2E
| Feature | Happy Path | Permissions | Persistence | Status |
|---------|------------|-------------|-------------|--------|
| New Feature Page | PASS | PASS | PASS | PASS |

### Python Ingestion
| Module | Lines | Status |
|--------|-------|--------|
| my_connector/metadata.py | 94% | PASS |

### Overall: [PASS / FAIL]
```

## Coverage Targets

| Layer | Metric | Target | How to measure |
|-------|--------|--------|----------------|
| openmetadata-service | Line coverage | 90% | JaCoCo with `-P static-code-analysis` |
| openmetadata-integration-tests | API endpoint coverage | 100% of changed endpoints | Manual check against resource classes |
| Playwright | Feature coverage | All new/changed user-facing flows | Spec file existence + test pass |
| Jest | Component coverage | 90% lines | `yarn test --coverage` |
| Python ingestion | Line coverage | 90% | `pytest --cov` |

## Quick Reference: Test File Locations

```
openmetadata-service/src/test/java/org/openmetadata/         # Java unit tests
openmetadata-integration-tests/src/test/java/org/openmetadata/it/  # Integration tests
openmetadata-ui/.../ui/src/**/*.test.{ts,tsx}                 # Jest unit tests
openmetadata-ui/.../ui/playwright/e2e/                        # Playwright E2E
ingestion/tests/unit/                                         # Python unit tests
ingestion/tests/integration/                                  # Python integration tests
```

---
name: tdd
description: Use when implementing new features or fixing bugs to enforce test-driven development. Guides the RED-GREEN-REFACTOR cycle for Java (JUnit), Python (pytest), and TypeScript (Jest/Playwright) in OpenMetadata.
user-invocable: true
argument-hint: "<feature or bug description>"
---

# Test-Driven Development for OpenMetadata

Enforce RED-GREEN-REFACTOR discipline across all three language stacks.

## When to Use

- Implementing any new feature or behavior
- Fixing bugs (write a test that reproduces the bug first)
- Adding new API endpoints, connectors, or UI components

## The Cycle

### 1. RED - Write a Failing Test

Write the **smallest test** that describes the desired behavior. Run it. It **must fail**. If it passes, your test isn't testing the new behavior.

**Java (JUnit 5):**
```bash
# Write test in openmetadata-service/src/test/ or openmetadata-integration-tests/
mvn test -pl openmetadata-service -Dtest=YourTestClass#yourTestMethod
```

**Python (pytest):**
```bash
source env/bin/activate
cd ingestion
# Write test using pytest style — plain assert, no unittest.TestCase
python -m pytest tests/unit/your_test.py::test_your_function -v
```

**TypeScript (Jest):**
```bash
cd openmetadata-ui/src/main/resources/ui
yarn test path/to/YourComponent.test.ts
```

**Rules for RED:**
- Test one behavior per test
- Use descriptive test names that explain what should happen
- Assert on observable outcomes (API responses, database state, rendered output), not internal method calls
- For Python: use `assert x == y`, not `self.assertEqual(x, y)`

### 2. GREEN - Write the Minimum Code to Pass

Write **only** the code needed to make the test pass. No more.

- Don't add error handling for cases you haven't tested
- Don't generalize — hardcode if that's what the test requires
- Don't clean up or refactor yet

**Run the test again. It must pass.**

### 3. REFACTOR - Clean Up While Green

Now improve the code while keeping tests green:

- Remove duplication
- Improve naming
- Extract methods if needed (but don't over-abstract)
- Run the full test suite for the module to check for regressions

```bash
# Java — format then test
mvn spotless:apply
mvn test -pl openmetadata-service

# Python — format, lint, then test
cd ingestion && make py_format && make lint
python -m pytest tests/unit/your_test.py -v

# TypeScript — lint then test
cd openmetadata-ui/src/main/resources/ui
yarn lint:fix
yarn test path/to/YourComponent.test.ts
```

### 4. Repeat

Go back to RED with the next behavior. Each cycle should take minutes, not hours.

## What to Test Where

| Layer | Test Type | Location | Runner |
|-------|-----------|----------|--------|
| Java REST API | Integration | `openmetadata-integration-tests/` | `mvn verify` |
| Java service logic | Unit | `openmetadata-service/src/test/` | `mvn test` |
| Python connectors | Unit | `ingestion/tests/unit/` | `pytest` |
| Python integration | Integration | `ingestion/tests/integration/` | `pytest` |
| React components | Unit | Co-located `.test.ts` files | `yarn test` |
| UI E2E flows | E2E | `playwright/e2e/` | `yarn playwright:run` |

## Anti-Patterns to Avoid

- **Writing code before the test.** If you catch yourself doing this, stop. Write the test first.
- **Mocking everything.** Mock external boundaries (HTTP clients, third-party APIs), not your own classes. If you need 3+ mocks, write an integration test instead.
- **Testing implementation details.** Don't assert on internal method calls with `verify()`. Assert on outcomes.
- **Giant test methods.** Each test should verify one behavior. Split multi-assertion tests into separate test cases.
- **Skipping REFACTOR.** The refactor step is where code quality happens. Don't skip it.

## OpenMetadata-Specific Patterns

**Java integration tests** use `BaseEntityIT` with `TestNamespace` for isolation and `OpenMetadataClient` for API calls. Prefer this over heavily mocked unit tests for API testing.

**Python connector tests** should test real behavior:
```python
# Good: test the actual parsing logic
def test_parse_table_metadata():
    raw = {"name": "users", "columns": [...]}
    result = parse_table(raw)
    assert result.name == "users"
    assert len(result.columns) == 3

# Bad: mock everything and verify calls
def test_parse_table_metadata():
    mock_client = MagicMock()
    mock_client.get.return_value = {...}
    # ... 20 lines of mock setup
    verify(mock_client.get).called_once()  # proves nothing
```

**Frontend tests** should render components and assert on visible output:
```typescript
// Good: test what the user sees
render(<MyComponent data={testData} />);
expect(screen.getByText('Expected Label')).toBeInTheDocument();

// Bad: test implementation details
expect(component.state.internalFlag).toBe(true);
```

---
name: verification
description: Use before claiming any task is complete. Requires running actual verification commands and showing evidence — no "should work" claims without proof.
user-invocable: true
---

# Verification Before Completion

No completion claims without fresh verification evidence.

## Core Rule

**Never say "done", "should work", "looks correct", or "this fixes it" without running the verification commands and showing the output.**

## Verification by Change Type

### Schema Changes (`openmetadata-spec/`)

```bash
# 1. Regenerate models
make generate

# 2. Verify Java compilation
mvn test-compile -pl openmetadata-spec,openmetadata-service

# 3. Verify Python models
source env/bin/activate && cd ingestion
python -c "from metadata.generated.schema.entity.services.connections.<module> import <Model>; print('OK')"

# 4. If connection schema: verify UI schema resolution
cd openmetadata-ui/src/main/resources/ui && yarn parse-schema
```

### Java Backend Changes

```bash
# 1. Format
mvn spotless:apply

# 2. Compile
mvn test-compile -pl <module>

# 3. Run relevant tests
mvn test -pl <module> -Dtest=<TestClass>

# 4. For API changes: run integration tests
mvn verify -pl openmetadata-integration-tests -Dtest=<IntegrationTestClass>
```

### Python Ingestion Changes

```bash
source env/bin/activate && cd ingestion

# 1. Format and lint
make py_format
make lint

# 2. Type check
make static-checks

# 3. Run unit tests
python -m pytest tests/unit/<relevant_test>.py -v

# 4. For connector changes: run connector-specific tests
python -m pytest tests/unit/topology/<service_type>/ -v
```

### Frontend Changes

```bash
cd openmetadata-ui/src/main/resources/ui

# 1. Lint
yarn lint

# 2. Type check
npx tsc --noEmit

# 3. Run unit tests
yarn test <path/to/changed/component>

# 4. For significant UI changes: run Playwright tests
yarn playwright:run --grep "<relevant test>"
```

## Evidence Format

When reporting completion, include:

```
## Verification Results

### Commands Run
1. `mvn spotless:apply` — completed, no formatting changes needed
2. `mvn test -pl openmetadata-service -Dtest=MyTest` — 5/5 tests passed
3. `yarn lint` — no errors

### Test Output
[paste relevant test output showing PASS]
```

## What Counts as Evidence

- Test runner output showing PASS
- Build output showing SUCCESS
- Lint/format output showing no errors
- API response showing expected data
- Screenshot or description of UI rendering correctly

## What Does NOT Count as Evidence

- "I reviewed the code and it looks correct"
- "This follows the same pattern as X, so it should work"
- "The logic is straightforward"
- "I've made similar changes before"
- No output at all — just claiming it's done

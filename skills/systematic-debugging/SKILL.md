---
name: systematic-debugging
description: Use when debugging a failing test, build error, or runtime issue that isn't immediately obvious. Guides a 4-phase root cause analysis instead of random fix attempts.
user-invocable: true
argument-hint: "<error description or failing test>"
---

# Systematic Debugging for OpenMetadata

Structured 4-phase debugging process. Stops you from guessing and forces root cause identification.

## When to Use

- Test failures with unclear cause
- Build errors after dependency or schema changes
- Runtime exceptions in backend, frontend, or ingestion
- Issues that persist after 2+ fix attempts

## Phase 1: Gather Evidence

**Do not change any code yet.** Only observe and collect data.

1. **Read the full error** — not just the last line. Stack traces, build logs, test output.
2. **Reproduce reliably:**
   ```bash
   # Java
   mvn test -pl <module> -Dtest=FailingTest#failingMethod

   # Python
   source env/bin/activate && cd ingestion
   python -m pytest tests/unit/path/to/test.py::test_name -v

   # TypeScript
   cd openmetadata-ui/src/main/resources/ui
   yarn test path/to/test.spec.ts

   # E2E
   yarn playwright:run --grep "test name"
   ```
3. **Check what changed recently:**
   ```bash
   git log --oneline -20
   git diff HEAD~5 -- <relevant-directory>
   ```
4. **Document findings:** Write down the exact error, when it started, and what you've observed.

## Phase 2: Form Hypotheses

Based on the evidence, list **2-3 possible causes** ranked by likelihood:

```
1. [Most likely] Schema change in X broke generated model Y
   Evidence: error mentions field Z, git log shows schema modified 3 commits ago
2. [Possible] Dependency version mismatch after recent upgrade
   Evidence: ClassNotFoundException for new API
3. [Unlikely] Test environment state pollution
   Evidence: test passes in isolation but fails in suite
```

**Do not jump to fixing yet.** Verify the top hypothesis first.

## Phase 3: Verify Root Cause

Test your top hypothesis with the **smallest possible experiment:**

- **Read the suspected code** — don't guess what it does
- **Add targeted logging** or use a debugger if needed
- **Check one hypothesis at a time** — don't make multiple changes simultaneously

### Common OpenMetadata Root Causes

| Symptom | Likely Cause | Verification |
|---------|-------------|--------------|
| `ImportError` in Python | Models not regenerated after schema change | `make generate` then retry |
| `TypeScript compile error` on generated types | Schema changed, types not rebuilt | `yarn parse-schema` then retry |
| Java `NullPointerException` in entity | Missing field in Flyway migration | Check `bootstrap/sql/migrations/` |
| Test passes alone, fails in suite | Shared state mutation between tests | Run with `--forked` (Java) or `-x` (pytest) |
| `404 Not Found` on API endpoint | Missing `@Path` annotation or route config | Check resource class registration |
| UI component renders blank | Missing i18n key | Check `locale/languages/en-us.json` |
| `Connection refused` in integration test | Docker service not running | `docker compose -f docker/development/docker-compose.yml ps` |

## Phase 4: Fix and Verify

Now — and only now — write the fix:

1. **Fix only the root cause.** Don't "improve" surrounding code.
2. **Run the failing test** — it must pass now.
3. **Run the broader test suite** for the affected module to check for regressions.
4. **Explain why** the fix works in your commit message or response.

## Escalation Rules

- **After 3 failed fix attempts:** Stop trying random fixes. Re-examine your hypotheses. The root cause is likely different from what you think.
- **After 5 failed attempts:** Question your assumptions about the architecture. Read more broadly — adjacent modules, recent PRs, dependency changelogs.
- **If the fix requires changing test infrastructure:** Pause and discuss with the user. The problem might be in the test setup, not the code.

## Anti-Patterns

- **Shotgun debugging:** Changing multiple things at once hoping something works.
- **Symptom treating:** Adding `try/catch` or `if null` checks to suppress errors instead of fixing the cause.
- **Blame the framework:** Before assuming a bug in Dropwizard, Pydantic, or React, verify your own code is correct.
- **Skipping reproduction:** "I think I know what it is" — prove it with a failing test first.

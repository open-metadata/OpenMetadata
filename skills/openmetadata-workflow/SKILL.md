---
name: openmetadata-workflow
description: Meta-skill loaded at session start. Directs Claude to check for applicable OpenMetadata skills before starting any task. Ensures structured workflows are followed.
---

# OpenMetadata Development Workflow

This skill is loaded automatically at session start. It ensures you follow the right workflow for every task.

## Before Starting Any Task

**Check which skills apply to your task and use them.** This is not optional — if a skill applies, you must follow it.

### Skill Selection Guide

| Task type | Required skill(s) |
|---|---|
| New feature (multi-file) | `/planning` then `/tdd` then `/test-enforcement` then `/verification` |
| Bug fix | `/systematic-debugging` then `/tdd` (write regression test) then `/verification` |
| New API endpoint | `/planning` then `/tdd` then `/test-enforcement` (must include integration test) |
| New connector | `/connector-standards` then `/connector-building` then `/test-enforcement` |
| UI component | `/tdd` then `/test-enforcement` (must include Jest + Playwright if user-facing) |
| Code review / PR review | `/code-review` then `/test-enforcement` |
| Connector review | `/connector-review` |
| E2E test creation | `/playwright` |
| Finishing implementation | `/test-enforcement` then `/verification` |

> **Note:** Connector skills (`/connector-standards`, `/connector-building`, `/connector-review`) and `/playwright` are part of the OpenMetadata Skills plugin and ship together with this workflow skill. They are defined in the `skills/` directory alongside this file.

### Workflow Rules

1. **Plan before coding.** For any non-trivial task, use `/planning` to design the approach before writing code.

2. **Test-first when possible.** Use `/tdd` to write failing tests before implementation. This applies to Java, Python, and TypeScript equally.

3. **Always enforce test coverage.** Before any PR, use `/test-enforcement` to verify:
   - 90% line coverage on changed Java classes
   - Integration tests for all changed/new API endpoints
   - Playwright E2E tests for new user-facing features
   - Jest unit tests for new React components

4. **Verify with evidence.** Use `/verification` before claiming completion. Show actual test output, not claims.

5. **Review before merging.** Use `/code-review` for two-stage review (spec compliance + code quality).

### OpenMetadata Cross-Layer Checklist

When your task touches multiple layers, ensure all are synchronized:

- [ ] JSON Schema in `openmetadata-spec/` → run `make generate`
- [ ] Connection schema → run `yarn parse-schema`
- [ ] Java entity changes → Flyway migration in `bootstrap/sql/migrations/`
- [ ] Backend API changes → update frontend API client
- [ ] New UI strings → add to `locale/languages/en-us.json` then run `yarn i18n`
- [ ] Java files → run `mvn spotless:apply`
- [ ] Python files → run `make py_format && make lint`
- [ ] TypeScript/React files → run `yarn organize-imports:cli && yarn lint:fix && yarn pretty:base --write`
- [ ] New source files → ensure Apache 2.0 license header (run `yarn license-header-fix`)
- [ ] Application changes → run `yarn generate:app-docs`

### CLAUDE.md Takes Precedence

If CLAUDE.md instructions conflict with any skill, **CLAUDE.md wins**. Skills are supplementary workflows, not overrides.

---
name: planning
description: Use when starting a non-trivial feature, refactor, or multi-file change. Forces structured design thinking before writing any code - brainstorm approaches, get approval, then create a step-by-step implementation plan.
user-invocable: true
argument-hint: "<feature or task description>"
---

# Planning - Design Before Code

Structured workflow for planning implementation before writing code. Prevents wasted effort from diving in without a clear direction.

## When to Use

- New features spanning multiple files or modules
- Refactors touching backend, frontend, or ingestion layers
- Bug fixes where the root cause is unclear
- Any task where the approach isn't immediately obvious

## Workflow

### Phase 1: Understand the Problem

1. **Read before suggesting.** Explore the relevant code, schemas, and tests. Do not propose changes to code you haven't read.
2. **Ask clarifying questions** one at a time. Don't dump a list of 10 questions.
3. **Identify constraints:**
   - Which layers are affected? (Java backend, React frontend, Python ingestion, JSON schemas)
   - Are there existing patterns to follow? (Check similar implementations)
   - Database migration needed? (Flyway in `bootstrap/sql/migrations/`)
   - Schema changes needed? (`openmetadata-spec/` JSON schemas)

### Phase 2: Propose Approaches

Present **2-3 approaches** with trade-offs:

```
## Approach A: [Name]
- How it works: [1-2 sentences]
- Pros: [bullet list]
- Cons: [bullet list]
- Files affected: [list]
- Risk: [low/medium/high]

## Approach B: [Name]
...

## Recommendation: [A or B] because [reason]
```

**Wait for user approval before proceeding.**

### Phase 3: Create Implementation Plan

Once an approach is approved, break it into ordered tasks:

1. Each task should be **completable in a single focused step**
2. Each task must specify:
   - Exact file paths to create or modify
   - What changes to make (not vague descriptions)
   - Verification command (test to run, build to check)
3. Order tasks by dependency — schema changes before model generation, backend before frontend
4. Include a final verification task that runs all relevant tests

**OpenMetadata task ordering pattern:**
```
1. JSON Schema changes (openmetadata-spec/)
2. Run: make generate (regenerate Pydantic models)
3. Java backend changes (openmetadata-service/)
4. Run: mvn spotless:apply && mvn test-compile
5. Python ingestion changes (ingestion/)
6. Run: cd ingestion && make lint && make unit_ingestion_dev_env
7. Frontend changes (openmetadata-ui/.../ui/)
8. Run: yarn lint && yarn test
9. Database migrations if needed (bootstrap/sql/)
10. Full verification: mvn test or relevant integration tests
```

### Phase 4: Execute

- Work through the plan task by task
- Mark each task complete as you finish it
- If you hit a blocker, stop and discuss — don't silently deviate from the plan
- After all tasks complete, run the final verification

## Rules

- **Never skip Phase 2.** Even if the approach seems obvious, stating it gets alignment.
- **No placeholder code.** Every step in the plan must describe real, complete changes.
- **Schema-first.** If the feature touches data models, start with JSON Schema changes in `openmetadata-spec/`.
- **User approves before code.** Don't write code until the plan is approved.

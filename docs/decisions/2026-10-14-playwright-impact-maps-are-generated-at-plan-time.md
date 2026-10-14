# Generate Playwright impact maps from the checkout being planned

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial); v2 2026-10-14 (changed specs gate PRs); v3 2026-10-14 (PR execution without private credentials); v4 2026-10-14 (credential cases gate the queue)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `.github/scripts/tests/test_playwright_impact_map.py` and the Playwright impact-map drift check
- **Related:** `.github/playwright/README.md`

## Context

The generated source-to-spec map is a deterministic function of UI source, spec imports and test IDs. Committing it on many unrelated PRs causes shared-file conflicts. The drift bot also pushes onto contributors' branches, changing their head SHA and retriggering checks.

## Decision

Keep handwritten ownership and semantic routing in Git. Generate the derived map from the checkout being planned, including local uncommitted edits.

The selector generates a temporary map by default and ignores legacy sibling snapshots. CI may supply a freshly generated artifact from its checked-out candidate and retain it with the selection for inspection. An explicitly supplied missing or invalid map, or a generator failure, must fail planning.

The generated and handwritten mappings continue to add coverage. Merge groups run smoke, directly changed specs and affected coverage from their whole base-to-head diff. The planner must check out that exact head and fail when the diff is unavailable. Shared test infrastructure and unknown production paths widen queue coverage to full.

New or modified Playwright specs must pass on the PR before queue entry, including draft PRs. Run entire changed files with the full entity matrix, route dedicated environments explicitly, and require passing execution for every changed spec. Empty or skipped test runs cannot satisfy the required check. Scheduled, cache-warming push and explicit full manual events retain full coverage. Queue plans use the existing fallback duration estimates for new specs without nightly history and still enforce shard budgets. The drift check becomes read-only generation and routing validation under its existing name.

PR execution receives no repository secrets or secret-bearing environment and uses a read-only built-in token. Dedicated authentication coverage uses local LDAP, Keycloak and mock providers with committed fixture accounts. Tests requiring private credentials declare `@requires-secrets` on the test or enclosing suite. Native collection classifies cases: public cases in mixed files gate the PR; affected credential cases gate the queue using its full candidate diff. Credential-only files are explicitly deferred instead of requiring conversion to mocks. Add affected credentialed nightly coverage to isolated Airflow shards and route live Okta through its provider environment. Require actual credential-case execution; skipped cases fail the queue gate. Preserve comprehensive trusted nightly/manual coverage. Trusted and PR shard jobs share steps via YAML aliases so their environment boundaries can differ without duplicating execution logic.

## Consequences

Authors no longer maintain, commit or resolve conflicts in derived maps. Local and CI planners use the same generator; its runtime becomes part of planning. Existing PRs should drop generated-map changes when updating from main.

The historical generated path is ignored to prevent old regeneration commands from introducing it again. Handwritten-map conflicts remain separate work.

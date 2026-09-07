# CLAUDE.md

Always-loaded guidance for every session. **Language- and path-specific rules live in
`.claude/rules/*.md` (auto-loaded when you touch matching files); procedures live in skills
(loaded on invoke).** This file is the map — see the pointer index at the bottom. Read
[ARCHITECTURE.md](ARCHITECTURE.md) for the **system map** (modules, the request/ingestion/search paths,
the invariants that hold); read [DEVELOPER.md](DEVELOPER.md) for **how to build, test, and add an entity
or connector** (deep dives + end-to-end checklists). Consult [docs/index.md](docs/index.md) — the **knowledge index** — to
**find existing design, plan, and reference docs** for whatever area you're working on.

## About OpenMetadata

OpenMetadata is a unified metadata platform for data discovery, observability, and governance — a
multi-module project with a Java backend, a React/TypeScript frontend, a Python ingestion framework,
and Docker infrastructure.

## Stack at a glance

- **Backend**: Java 21 + Dropwizard, multi-module Maven.
- **Frontend**: React + TypeScript, built with **Vite** (dev server on :3000); component library
  `openmetadata-ui-core-components` — the **UntitledUI + Tailwind v4** (`tw:` prefix, react-aria-components)
  go-forward design system; legacy stack is Ant Design + Less (deprecated). Machine-readable design-system
  specs: `openmetadata-ui/src/main/resources/ui/specs/` (read `specs/README.md` before UI work).
- **Ingestion**: Python (`>=3.10`, no pinned ceiling; **CI runs 3.10**) + Pydantic 2.x, 75+ connectors.
- **Database**: MySQL (default) or PostgreSQL. **Search**: Elasticsearch 7.17+ or OpenSearch 2.6+.
- **Infrastructure**: Apache Airflow for ingestion orchestration.

## Environment setup (every session)

- **Python venv is REQUIRED before any Python work, `make generate`, or `make install_dev*`:**
  ```bash
  source env/bin/activate          # first time: python3.11 -m venv env
  python --version                 # expect 3.10.x/3.11.x
  ```
  In a Claude Code **worktree** the venv is NOT copied — create one
  (`python3.11 -m venv env && source env/bin/activate && cd ingestion && make install_dev`) or
  symlink the main repo's (`ln -s /path/to/main-repo/env env`).
- **One-call setup (macOS + Linux)**: `make dev_setup` (or `./scripts/dev_setup.sh`) does everything
  below — toolchain, venv, generation, UI deps, pre-commit — and is idempotent. `make dev_check`
  diagnoses an existing checkout without changing it. See the `dev-setup` skill.
- **First-time bootstrap** (from the **repo root** — `make generate` is a root-only target; it does
  not exist under `ingestion/`):
  ```bash
  make prerequisites
  source env/bin/activate && cd ingestion && make install_dev_env && cd ..
  make generate                    # regenerate models after any schema change
  make yarn_install_cache
  make install_test precommit_install   # activate the commit-time format/license gate (pre-commit)
  ```
  The last line installs the `pre-commit` hooks (`.pre-commit-config.yaml`): on `git commit` they run
  Java format (spotless), Python format (ruff), UI format (prettier), design-token, and Apache-2.0
  license checks on your changed files, matching CI. Do not skip them with `--no-verify`.
- **Java**: Java 21; use `mvn`. **Frontend**: use `yarn` (never `npm`); frontend root is
  `openmetadata-ui/src/main/resources/ui/`.
- **Docker dev services**: `docker compose -f docker/development/docker-compose.yml up -d`.

## Repository layout

Maven modules (reactor order is computed from the graph, not this list):

- `openmetadata-spec/` — JSON Schemas + generated POJOs; the schema-first source of truth
- `openmetadata-sdk/` — Java client SDK
- `common/` — shared utilities (`CommonUtil`, etc.)
- `openmetadata-shaded-deps/` — ES/OS clients relocated behind `es.*`/`os.*` (do not edit — see rules)
- `openmetadata-service/` — core Java backend, REST APIs, repositories, migrations runner
- `openmetadata-k8s-operator/` — Kubernetes operator
- `openmetadata-integration-tests/` — backend API integration tests (`*IT.java`)
- `openmetadata-mcp/` — MCP server
- `openmetadata-ui-core-components/` — canonical React component library
- `openmetadata-ui/src/main/resources/ui/` — React frontend application
- `openmetadata-dist/` — packaging/distribution
- `openmetadata-clients/` — client artifacts

Other key trees: `ingestion/` (Python framework + connectors), `bootstrap/sql/` (DB migrations),
`conf/` (configuration), `docker/` (local + prod deployment).

## Hard cross-cutting constraints (apply to every session, all languages)

**Secrets & security.** Never commit secrets — use environment variables or a secrets manager.
Auth is JWT with OAuth2/SAML; RBAC lives in Java entities; config in `conf/openmetadata.yaml`.
**Do not modify `.github/workflows/**` on your own** — CI workflows are a supply-chain surface; a
`PreToolUse` hook blocks edits there unless the user explicitly authorizes them (by setting
`CLAUDE_ALLOW_WORKFLOW_EDITS=1`). Ask first.

**All caches MUST be bounded.** Never use a bare `dict` / `HashMap` / `Map` as a cache without an
explicit size cap — they grow with input and OOM on large catalogs/ingestions (only exception: the
user explicitly asks for unbounded). Pick a sane default (100–1000 entries); if unsure, ask.
Python: `collections.OrderedDict` + `popitem(last=False)`, `@functools.lru_cache(maxsize=N)`, or
`cachetools.LRUCache` (cache hits **and** misses). Java: Caffeine/Guava `maximumSize(N)`.
TypeScript: `lru-cache`. Before adding a cache, check it isn't already cached a layer down (e.g.
`OpenMetadata._search_es_entity` is already `@lru_cache(maxsize=512)`).

**Comments explain *why*, never restate code.** Do NOT add comments that describe what obvious code
does (`// Create user` before `createUser()`). Only comment complex business logic, non-obvious
algorithms/workarounds, public-API JavaDoc, or `TODO/FIXME` with a ticket reference. If code needs a
comment to be understood, refactor it to be clearer instead.

**Testing philosophy.** Test real behavior, not mock wiring — if a test mocks 3+ of your own classes
to verify a method call, it tests the wrong thing. Prefer integration tests over heavily-mocked unit
tests (this project has real ITs: `OpenMetadataApplicationTest`, Docker, real OpenSearch). Mocks are
for boundaries (HTTP clients, third-party APIs), not internals. Ask "what breaks if this test passes
but the code is wrong?" — if the answer is "nothing", rewrite it. Assert on observable outcomes
(API responses, DB state), not internal `verify()` calls.

**License headers are per-module — copy one from a sibling file, never assume Apache.** UI TS/TSX:
Apache-2.0 (`yarn license-header-fix`). Python: `ingestion/` is **Collate Community License 1.0** (`ingestion/LICENSE`); `openmetadata-airflow-apis/` Python files use the same Collate header template.
Java: Apache-2.0, most files carry none.
Only the UI is enforced — the `ui-license-header` pre-commit hook and CI `ui-checkstyle`; spotless
and `py_format_check` never look at headers, so a wrong Python or Java header ships silently.

**Schema-first.** JSON Schemas in `openmetadata-spec/` are the single source of truth; all generated
code (Java POJOs, Pydantic models, TS types) is derived. **Edit the schema, then regenerate — never
hand-edit generated output.** Details in `.claude/rules/schema-first.md`.

**Output style.** Clean code blocks, no unnecessary explanation; assume an experienced reader; focus
on functionality over education. Do not add unnecessary blank lines between prose and code blocks.

## Pointer index — when to reach for what

### Path-scoped rules (`.claude/rules/*.md`, auto-load on matching files)

| Rule file | Reach for it when you are editing… |
|---|---|
| `java.md` | any `**/*.java` — style, spotless, no-wildcard, Kafka-grade method/class rules, ITs |
| `frontend-react.md` | UI `*.{ts,tsx}` — components, hooks, state, types, and the CI lint code-rules |
| `frontend-styling.md` | UI `*.{ts,tsx,less,css}` — `tw:` prefix, design tokens, ring→border, token-audit |
| `component-library.md` | UI `*.{ts,tsx}` — prefer `ui-core-components`, do not add Ant Design for new work |
| `frontend-performance.md` | UI `*.{ts,tsx}` — waterfalls, barrel imports, re-renders, bundle discipline |
| `frontend-a11y.md` | UI `*.{ts,tsx}` — semantics over `div`+`role`, keyboard, focus, contrast, targets |
| `i18n.md` | UI `*.{ts,tsx}` + `src/locale/**` — no string literals, `yarn i18n`, translate placeholders |
| `frontend-playwright.md` | UI `playwright/**` — E2E test constraints |
| `python-ingestion.md` | `ingestion/src/**/*.py` — pytest style, connector-specific-file rule, `model_str()` |
| `schema-first.md` | `openmetadata-spec/.../schema/**` and any `generated/**` — regen, never hand-edit generated |
| `migrations.md` | `bootstrap/sql/**` — append-only, native path, MySQL+Postgres, idempotent |

### Repo coding conventions (read before writing non-trivial code)

- `docs/design-patterns.md` — the design patterns this codebase uses idiomatically (Template Method
  for repositories, Factory/Registry for dispatch, Strategy/Adapter/Observer, the ingestion
  Source→Sink pipeline, …) with the canonical class to copy each from. Extend the established pattern
  rather than inventing a parallel one.
- `openmetadata-ui/src/main/resources/ui/DEVELOPER_HANDBOOK.md` — **the UI folder structure and file
  naming spec.** Read before creating any new file under `openmetadata-ui/.../ui/src/`. Layers stay
  top-level (`components/`, `pages/`, `rest/`, `utils/`, `hooks/`) and are grouped inside by
  `domain/feature/`; new files use one stem with a role suffix (`GlossaryList.tsx`, `.types.ts`,
  `.utils.ts`, `.test.tsx`). Legacy `.component.tsx`/`.interface.ts` files stay as they are.

### Skills (invoke by name; procedures, not rules)

| Skill | Reach for it when… |
|---|---|
| `dev-setup` | setting up / repairing a dev environment, a fresh clone, or a new worktree |
| `planning` | starting any non-trivial, multi-file feature or refactor |
| `tdd` | implementing a feature or bug fix (RED→GREEN→REFACTOR) |
| `systematic-debugging` | a failing test/build/runtime issue whose cause isn't obvious |
| `test-enforcement` | before a PR — 90% changed-class coverage, ITs for new endpoints, Playwright for UI |
| `verification` | before claiming "done" — run real commands, show evidence |
| `code-review` | reviewing a diff/PR — spec compliance then code quality |
| `java-checkstyle` | after touching `.java` — runs `mvn spotless:apply` and verifies |
| `ui-checkstyle` | after touching UI `*.{ts,tsx,js,jsx,json}` — the exact CI ESLint+Prettier+organize-imports pass |
| `ui-core-components` | building UI layout/color before reaching for raw `<div>` + Tailwind |
| `test-locally` | spinning up the full local Docker stack to test a change/connector |
| `connector-standards` / `connector-building` / `connector-review` | building or reviewing an ingestion connector |
| `playwright` / `writing-playwright-tests` / `playwright-validation` | authoring or validating Playwright E2E tests |
| `pr-checklist` | opening/finalizing a PR (fills the repo PR template) |

> `openmetadata-workflow` is a meta-skill that routes tasks to the skills above; it is auto-loaded at
> session start when the `openmetadata-skills` plugin is installed.

### Harness integrity (CI, warnings-only)

A CI workflow (harness-integrity.yml) runs `scripts/harness/check_harness.py` on PRs — also
`make harness-check` locally. It **warns, never blocks** (promote to a gate only with maintainer
sign-off) when the agent-facing config decays:

- **dead references** — a path, `make`/`yarn` target, or `mvn` goal named in this file, AGENTS.md,
  ARCHITECTURE.md, `docs/index.md`, `.claude/rules/**`, or a SKILL.md that no longer resolves;
- **AGENTS.md sync** — AGENTS.md is a symlink to this file; the check warns if it isn't;
- **skill symlinks** — a real file where a symlink into `skills/` is expected (`.claude/skills`,
  `.agents/skills`), or two same-named SKILL.md with different content;
- **doc-size budgets** — this file > 200 lines, ARCHITECTURE.md > 300, any single rule > 100;
- **rule globs** — a `.claude/rules/**` `paths:` glob matching zero files;
- **generated-doc freshness** — `docs/generated/**` out of date with its source.
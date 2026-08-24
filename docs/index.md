# Documentation Index

The map to OpenMetadata's written knowledge — design docs, plans, generated references, and the
reference docs that live *outside* `docs/` (in the UI, ingestion, and bootstrap trees). Use it to
find an existing doc before reverse-engineering the code or guessing.

**Freshness** was verified against the working tree on **2026-07-24** (not inferred from age — each
verdict cites an artifact that was checked to still exist):

- **CURRENT** — its load-bearing references still exist and match the code.
- **STALE** — it references paths/classes/flags that no longer exist.
- **SUPERSEDED** — a newer doc or implementation replaced it (named in the row / footnotes).
- **⚠** — CURRENT overall, but with a specific caveat in the footnotes below.
- **by construction** — regenerated from source and CI-gated, so it cannot drift from its source.

> This index lists one file each; it does not move or relink anything (migration is out of scope).

## Start here — root guides (not under `docs/`)

| Guide | What it is |
|---|---|
| `CLAUDE.md` | Always-loaded session guidance; the pointer index to `.claude/rules/*` and skills |
| `ARCHITECTURE.md` | System map — modules, the request/ingestion/search paths, the invariants that hold |
| `DEVELOPER.md` | How to build, test, and add an entity or connector (end-to-end checklists) |
| `AGENTS.md` | Codex entry doc — **carries known contradictions** (Webpack→Vite, antd, Python ceiling); see `docs/tech-debt.md` #6 |

## Backend & platform design docs (`docs/`)

| Doc | Purpose | Read when | Modified | Freshness |
|---|---|---|---|---|
| `docs/impersonation-design.md` | Bot→user impersonation: `updatedBy`=user / `impersonatedBy`=bot, gated by `allowImpersonation` + RBAC `Impersonate` policy scoping | Touching bot impersonation auth — the flag, `BotImpersonationPolicy` seeds, `checkImpersonationAuthorization` (§4.4 is authoritative) | 2026-06-16 | CURRENT ⚠¹ |
| `docs/session-management-multi-node-design.md` | Shipped multi-node server-side session + websocket system: shared JDBC/Redis store, `OM_SESSION` cookie, session-bound JWTs, CAS refresh | Working on login/refresh/logout across pods, `SessionService`/`SessionStore`, JWT session validation, websocket handshake | 2026-06-03 | CURRENT |
| `docs/streamable-logs.md` | S3/MinIO-backed streamable ingestion logs: HTTP append/close, `partial.txt`→`logs.txt`, SSE live tail, abandoned-run sweeper | Working on ingestion log storage/streaming — `S3LogStorage`, `LogStorageInterface`, `/logs/{fqn}/{runId}` endpoints | 2026-05-15 | CURRENT |
| `docs/ingestion-log-streaming.md` | Live log tail over SSE: `LogStreamEvent` schema, resume cursors, one shared reader per run, and the limits that bound every stream | Building or debugging a client that tails ingestion logs live — `/logs/{fqn}/stream/{runId}`, `IngestionLogTailer`, `LogStreamSettings` | 2026-08-10 | CURRENT |
| `docs/rdf-local-development.md` | Run RDF/knowledge-graph support locally with Apache Jena Fuseki — startup scripts, env vars, `rdf.*` config, `/api/v1/rdf/*`, `RdfIndexApp` | Setting up or debugging local RDF/Fuseki development | 2026-07-16 | CURRENT |
| `docs/rdf-production-setup.md` | Production sizing/tuning for a remote Fuseki triple store — TDB2 heap vs page-cache, batch/timeout, weekly recreate, compaction | Sizing, scheduling, or troubleshooting a prod Fuseki deployment; tuning RDF bulk-write | 2026-07-16 | CURRENT |
| `docs/csv-relation-types-plan.md` | Carry glossary term relation types through CSV export/import via a `relationType:termFQN` prefix (default `relatedTo`) | Modifying glossary CSV round-tripping — `CsvUtil.addTermRelations`, `GlossaryRepository.getTermRelationsFromCsv` | 2026-03-17 | CURRENT |
| `docs/auto-classification/add-support-for-another-entity.md` | Step-by-step: extend auto-classification (PII + sample data) to a new entity across schema/Java/Python/UI via the `EntityAdapter` registry | Adding auto-classification/sample-data support for a new entity type | 2026-05-19 | CURRENT |
| `docs/perf/cdn-deployment-guide.md` | AWS design proposal: per-customer/per-release UI bundles from one CloudFront + S3 via an embedded CloudFront Function router (no Lambda@Edge) | Planning/reviewing CDN delivery of the UI bundle + per-customer version pinning — infra design, not existing code | 2026-05-25 | CURRENT (unimplemented proposal) |

## Plans & specs (`docs/plans/`, `docs/superpowers/`)

| Doc | Purpose | Read when | Modified | Freshness |
|---|---|---|---|---|
| `docs/plans/2026-01-27-search-indexing-stats-redesign.md` | Rework `SearchIndexingApp` stats into a per-stage pipeline model (`StageStatsTracker`/`StageCounter`), index-alias promotion, vector bulk processor | Before touching search reindex stats, `search_index_server_stats`, index promotion, vector indexing | 2026-01-29 | CURRENT (shipped design) |
| `docs/plans/2026-06-22-bulk-deletion-redesign.md` | Fast, orphan-free, resumable service-level recursive hard-deletion by id-set; self-audits what landed on `main` vs remaining gaps | Before working on recursive/bulk deletion, `entity_relationship` orphan cleanup, the deletion-lock gate | 2026-06-26 | CURRENT (shipped design) |
| `docs/superpowers/specs/2026-06-22-logviewer-modal-design.md` | Design spec for the reusable `LogViewerModal` (dark terminal modal over `@melloware/react-logviewer`); self-marked "Implemented; revised 2026-06-24" | Before modifying `LogViewerModal`, its log-level parser, theming, or streaming container/hook | 2026-07-16 | CURRENT |
| `docs/superpowers/plans/2026-06-22-logviewer-modal.md` | Original TDD build plan for `LogViewerModal` (built-in LazyLog search, `CopyToClipboardButton`) | Historical context only — the shipped component follows the revised spec, not this plan | 2026-07-16 | SUPERSEDED ² |

## Generated references (`docs/generated/`)

| Doc | Purpose | Read when | Modified | Freshness |
|---|---|---|---|---|
| `docs/generated/entity-index.md` | Auto-generated: 81 first-class entities → schema JSON, Java POJO, Python model, TS type, REST resource class | Locate every codegen artifact / the REST resource for an entity without grepping four trees | 2026-07-24 | CURRENT (by construction) ³ |
| `docs/generated/api-reference.md` | Auto-generated: all 1748 REST endpoints (method + path + `@Operation` summary) grouped by resource package | Find an endpoint's exact path/method, or enumerate a package's routes without reading JAX-RS classes | 2026-07-24 | CURRENT (by construction) ³ |

## Repo audit & quality (`docs/`)

| Doc | Purpose | Read when | Modified | Freshness |
|---|---|---|---|---|
| `docs/golden-principles.md` | 8 candidate repo-wide invariants (DRAFT for ratification), each with a measured adherence number + reproducing command | Cite/enforce an invariant (acyclic modules, ServiceSpec contract, generated-as-sink, no bare `except:`, …) | 2026-07-24 | CURRENT |
| `docs/tech-debt.md` | Prioritized (impact÷size, 3 tiers) ledger of 21 audit findings, each with location, size, and agent-fixability | Pick up a bounded cleanup, or understand a known structural debt before working near it | 2026-07-24 | CURRENT |
| `docs/quality.md` | One evidence-cited quality grade (A–C / Not assessed) per Maven module | Gauge a module's structural health / known debt before a large change | 2026-07-24 | CURRENT |

## Assets (`docs/assets/`)

| Doc | Purpose | Read when | Modified | Freshness |
|---|---|---|---|---|
| `docs/assets/` (4 PNGs) | Architecture/marketing diagrams for the "Open Context Layer for AI" — hero, architecture, context graph, memory-primitives | Editing the root `README.md` visuals | 2026-06-10 | CURRENT (sole consumer: root `README.md`) |

## UI reference docs (outside `docs/`)

| Doc | Purpose | Read when | Modified | Freshness |
|---|---|---|---|---|
| `openmetadata-ui/src/main/resources/ui/DEVELOPER_HANDBOOK.md` | **UI folder structure + file naming spec.** Layers (`components/`, `pages/`, `rest/`, `utils/`, `hooks/`) stay top-level, grouped inside by `domain/feature/`; five domains (`discovery`, `governance`, `observability`, `insights`, `platform`) with cross-cutting features at the domain level. New files use one stem + role suffix (`GlossaryList.tsx`, `.types.ts`, `.utils.ts`, `.test.tsx`); legacy uses `.component.tsx`/`.interface.ts`. Also covers imports, barrels, routing and state locations | **Before creating any new file under `ui/src/`**, or when deciding where code belongs | 2026-08-21 | CURRENT |
| `openmetadata-ui/src/main/resources/ui/specs/` | **Machine-readable design system** (41 files). `README.md` declares two stacks — **go-forward = UntitledUI + Tailwind (`tw:`)**, **legacy (deprecated) = Ant Design + Less** — plus `foundations/*` (color, spacing, typography, radius, elevation, motion), `tokens/*` (Tailwind-utility + master token reference), `untitled/*` (go-forward component specs), and legacy `components/*` | **Before writing or modifying any UI code** — start at `specs/README.md`, then the `foundations`/`tokens` and the `untitled/<component>.md` (or legacy `components/*`) spec for what you touch | 2026-07-27 | CURRENT ⁶ |
| `openmetadata-ui/src/main/resources/ui/docs/colors.md` | Semantic color-token system (`tw:bg-primary`, `tw:text-fg-*`, `tw:border-*`) with light/dark values + the mandatory `ring`→`border` migration (§2.3.1) | Before writing/reviewing any Tailwind color class or dark-mode styling, or when tempted to use `ring-*` or a raw hex | 2026-07-23 | CURRENT |
| `openmetadata-ui/src/main/resources/ui/docs/formutils.md` | The modern react-hook-form + react-aria form stack (`FieldProp`, `getField`/`FormFields`/`HookForm`) vs the legacy antd `@utils/formUtils` API | Before building/modifying any UI form — which API to use, and wiring to `useFormDrawerWithHook` + a pure transform | 2026-07-15 | CURRENT |
| `openmetadata-ui/src/main/resources/ui/playwright/docs/` | Auto-generated E2E test-coverage catalog (`README.md` + Discovery/Governance/Integration/Observability/Platform) mapping component → spec file → scenarios | Check what UI behavior is already E2E-covered before writing Playwright tests or reasoning about gaps | 2026-03-09 – 2026-07-16 | CURRENT (by construction) ³ |

## Ingestion & bootstrap reference (outside `docs/`)

| Doc | Purpose | Read when | Modified | Freshness |
|---|---|---|---|---|
| `ingestion/docs/design/ingestion-diagnostics.md` | DEBUG-gated ingestion diagnostics subsystem (operation registry, watchdog, heartbeat, memory tracker, HTTP introspection, stage backpressure, signal dumps) | Understand why/how the diagnostics subsystem works before instrumenting ingestion hangs/OOMs | 2026-05-20 | CURRENT ⚠⁴ |
| `bootstrap/MIGRATION_SYSTEM.md` | Hybrid DB-migration architecture — Flyway→native→extension execution order, `SERVER_CHANGE_LOG` tracking, file layout (Flyway *parsers* only, not the Flyway runner) | Before adding/debugging a migration under `bootstrap/sql/migrations/`, or reasoning about ordering / tracking tables / MySQL+Postgres dual paths | 2025-10-28 | CURRENT ⚠⁵ |

## Caveats (verification notes)

1. **impersonation-design** — §4.4 (v1.1) is authoritative and matches shipped code (`allowImpersonation` in `createBot.json`/`user.json`, `checkImpersonationAuthorization` in `DefaultAuthorizer.java`, the four policy/role seeds, `BotImpersonationIT`). The earlier §4.1/4.2 `POST /users/impersonate` token-exchange endpoint was **never shipped** — impersonation uses the `X-Impersonate-User` header (`JwtFilter.java`), which §4.4 supersedes 4.1/4.2 to reflect. Read §4.4.
2. **logviewer-modal plan** — superseded by the **2026-06-24 revision** of the design spec (row above): the plan's built-in LazyLog search + `CopyToClipboardButton` were reversed (search moved to the header, a footer status bar added). The shipped dir (`LogViewerModal.utils.tsx`, `LogsViewerModalContainer.tsx`, `useLogStream.ts`) follows the revised spec, not this plan.
3. **by construction** — `docs/generated/*` are regenerated by `make generate-reference-docs` and gated by the reference-docs freshness CI job; the Playwright docs by `playwright/doc-generator/generate.js` + the `playwright-docs-check.yml` workflow. They cannot drift from their source on the watched paths. (One benign lag: the Playwright `README.md` roll-up footer reads `2026-03-09` while `Governance.md` regenerated `2026-07-16`; self-corrects on the next spec-touching PR.)
4. **ingestion-diagnostics** — the design **shipped** (`ingestion/src/metadata/ingestion/diagnostics/`, activated at `loggerLevel == DEBUG`, installed in `metadata/workflow/base.py`), but the doc's §5/§7 *flat file map drifted*: files now live under `collectors/`, `monitors/`, `samplers/`; there is no standalone `heartbeat.py`; wire-in is `base.py`, not the doc's `base_workflow.py`. Treat the file map as design-era, the behavior as current.
5. **MIGRATION_SYSTEM** — accurate (the `flyway/`+`native/` layout, `SERVER_CHANGE_LOG`, `MigrationWorkflow`/`FlywayMigrationFile`, and `conf/openmetadata.yaml` `flywayPath`/`nativePath`/`extensionPath` all verified) except: the runner class is `MigrationProcessImpl` (doc says `MigrationProcess`), and the `extensions/` dir is not materialized on disk (`extensionPath: ""`) though the path is still supported.
6. **ui/specs** — tracked (41 files) and CURRENT: all four audit commands its `README.md` cites resolve to real `package.json` scripts (`tw-audit`, `tw-audit:report`, `tw-guard`, `token-audit`), and the two-stack policy it states (go-forward UntitledUI+Tailwind, legacy Antd+Less deprecated) matches the enforced rules — `tw-guard` blocks new `antd` imports / new `.less` files, and `.claude/rules/frontend-styling.md` routes agents into `specs/README.md`.

---

*Not indexed:* `docs/harness-audit/` exists in the working tree but is **untracked** (working audit notes, intentionally out of version control), so it is not part of the committed knowledge base.

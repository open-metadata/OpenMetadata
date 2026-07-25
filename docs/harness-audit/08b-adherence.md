# Convention-Adherence Audit — Are the Documented Rules Actually Followed?

**Read-only.** Nothing was fixed. Each convention below carries an exact violation count, total
population, ratio, top offenders, a trend note (old vs recent code), and a **verdict**:
**ENFORCE** (high adherence — safe to make a blocking lint) · **WARN** (mid — advisory) ·
**DOCUMENT** (low — an aspiration, not yet a real rule) · **DROP** (nobody follows it).
Commands are inline and reproducible (zsh). **OBSERVED** = measured; **INFERRED** = sampled
(sample size + selection stated).

> The verdict table is at the end and is the direct input to any "promote this lint to error"
> decision.

---

## Cross-cutting (measured in main context)

### Comments policy — IMPRESSIONISTIC, not mechanically countable
CLAUDE.md bans comments that restate obvious code (`// Create user` before `createUser()`). This
**cannot be counted mechanically** — distinguishing "restates the code" from "explains why" requires
reading each comment. **This figure is impressionistic**, from a 15-file sample (5 per language),
selected as *files touched in the last 120 days, alphabetically first* (a recent-code slice, so it
reflects current practice, not legacy).
`git log --since='120 days ago' --name-only --pretty=format: -- '<path>' | grep '\.<ext>$' | sort -u | head`

Observations (with examples):
- **TypeScript & Python core files lean compliant** — comments tend to explain *why*.
  `src/App.tsx:21-25` is a model "why" comment (QueryClientProvider ordering + cache-clear
  rationale); `ingestion/.../automations/runner.py:85-87` explains a legacy signature path;
  `execute_runner.py:44` "This will already instantiate the Secrets Manager".
- **Imperative / bootstrap Java is the weak spot.** `OpenMetadataApplication.java` (the startup
  sequence) mixes genuine "why" comments (`:251-252` Jetty LEGACY URI mode rationale; `:312-313`
  re-queue interrupted AI jobs) with a run of **step-narration comments that restate the next line** —
  `:261 "// Instantiate incident severity classifier"`, `:264 "// Initialize the IndexMapping class"`,
  `:327 "// Instantiate JWT Token Generator"`, `:335 "// init Secret Manager"`, `:339 "// init Entity
  Masker"`. These are exactly the banned pattern, clustered in sequential init code.
- **Rough impression:** a **majority of comments comply** (explain intent), with a visible minority —
  concentrated in imperative bootstrap/wiring sequences — that narrate the code. Not a clean rule;
  not safe to lint. **Verdict: DOCUMENT** (unmeasurable; keep as guidance).

### Test coverage — the 90% target is NOT enforced anywhere in-repo; actual % not cheaply measurable
`skills/test-enforcement/SKILL.md` and `CLAUDE.md` assert a **90% line-coverage target** (changed
classes). What the repo actually enforces:
- **Java (jacoco):** the plugin is declared (`pom.xml:843-845`, `:1115-1117`) but there is **no
  coverage rule** — `grep -nE '<rule>|<minimum>|COVEREDRATIO|<limit>|haltOnFailure' pom.xml` → **empty**.
  So `jacoco` reports but gates nothing. (The `<goal>check</goal>` at `pom.xml:1038` belongs to the
  **spotless** plugin, not jacoco.)
- **Frontend (Jest):** **no `coverageThreshold`** in `jest.config.js` (`grep -n coverageThreshold …`
  → none; only `collectCoverageFrom`/`coverageDirectory`). Nothing fails on low coverage.
- **Python (coverage.py):** **no `fail_under`** in `ingestion/pyproject.toml [tool.coverage.report]`
  (only an `omit` list). Nothing fails on low coverage.
- **CI:** coverage is *measured and shipped to SonarCloud*, not gated in-repo —
  `maven-sonar-build.yml`, `py-sonarcloud-nightly.yml`, `yarn-coverage.yml` feed `ci-coverage.xml` /
  `lcov.info` per `sonar-project.properties` (3 of them). `yarn-coverage.yml:130` runs
  `yarn test:cov-summary` and posts a Jest coverage PR comment. Any 90% enforcement would be a
  **SonarCloud server-side quality gate** — configured outside the repo, **not verifiable here**.
- **Actual current coverage %:** **not cheaply obtainable.** No coverage report is committed
  (`find . \( -name jacoco.xml -o -name ci-coverage.xml -o -name lcov.info -o -name coverage-summary.json \)`
  → none). Producing real numbers requires running the full suites (`mvn test` + jacoco, `pytest --cov`,
  `yarn test:coverage`) — **expensive**, so not run per the audit's cost rule.
- **Verdict: DOCUMENT.** The 90% number is a documented aspiration with **zero in-repo gate**; it
  cannot be promoted to a blocking lint without (a) a coverage number nobody currently measures in-repo
  and (b) adding the gate config that is deliberately absent from all three build tools.

---

## Frontend (`SRC = openmetadata-ui/src/main/resources/ui/src`; population 4,725 ts/tsx; HEAD 2026-07-24, 90-day window ≥ 2026-04-25)

1. **Avoid Ant Design — OBSERVED.** `grep -rlE "from 'antd(/[^']*)?'" SRC --include='*.ts' --include='*.tsx' | wc -l`
   → **864 files (18.3%)**. **TREND (the key metric): migration is stalled** — of the 2,894 ts/tsx touched
   in the last 90 days (`git log --since='90 days ago' --name-only … | sort -u`), **592 (68.5% of all antd
   importers) are recent** (`comm -12`). New/edited code keeps importing antd.
2. **No `any` — OBSERVED.** `grep -rnE ': any\b|as any\b|<any>' SRC --include='*.ts' --include='*.tsx' | wc -l`
   → **1,771 lines / 461 files (9.8%)**. Top 5 are all **generated** (`generated/…ingestionPipeline.ts` 41,
   `…serviceProgressEvent.ts` 41, `metadataIngestion/workflow.ts` 39 — regenerated 2026-07-23). 62% of lines
   sit in recently-modified files → actively (re)introduced. (`no-explicit-any` is eslint `'warn'`, not gated.)
3. **No `console.*` — OBSERVED.** `grep -rnE 'console\.(log|warn|error|info|debug)' … | wc -l` → **34 lines /
   23 files**, but **32/34 carry an adjacent `eslint-disable … no-console`** — only 2 unsuppressed (one a test).
   High adherence; `no-console` is eslint `'error'` and CI-gated.
4. **Functional components only — OBSERVED.** `grep -rlE 'extends (React\.)?(Component|PureComponent)\b' SRC …`
   → **0**. Full adherence.
5. **File naming `.component.tsx` / `.interface.ts` — OBSERVED (rough proxy, stated).** `find SRC/components
   -name '*.component.tsx'` = 389 vs 1,070 non-test/story `.tsx` = **36.4%**; `.interface.ts` 375/568 = **66%**.
   **Proxy over-counts the denominator** (many `.tsx` are sub-components/helpers never meant to carry
   `.component`), so 36.4% understates true adherence — directional only, not a violation count.
6. **Wrap JSX strings in `t()` — NOT RELIABLY MEASURABLE.** Two grep proxies gave ~7% precision (swamped by
   TS generics `=> Promise<void>` matching `>…<`); real JSX text nodes are multi-line and need an AST/JSX
   parser (i18next-scanner / eslint `i18next/no-literal-string`). **No trustworthy count is producible with
   read-only grep; none is invented.**
7. **Apache-2.0 license header — OBSERVED.** First-5-lines lacking both `Copyright` and `Licensed under the
   Apache License` → **12 / 4,751 = 0.25%**. **9 are old ANTLR-generated `.js` (2024-12-09)**; only 3 are
   hand-written recent misses (`LineageTable.interface.ts` 2026-04-06, `applicationAPI.mock.ts`,
   `LineageLayers.interface.ts`). CI gates license headers on changed files.
8. **Non-en locales actually translated — OBSERVED.** Per-locale python3 flatten+compare of
   `SRC/locale/languages/*.json` vs `en-us.json` (4,404 shared leaf keys). Byte-identical-to-English values,
   split plausible (acronyms/product/symbols, a near-constant ~22–29/locale) vs **obvious defects**
   (multi-word English left untranslated): **nl-nl 396, sv-se 393, fr-fr 347, de-de 317, pt-pt 285 …** down to
   ru-ru 225 (non-Latin scripts leave less English). ~5.6–9.6% of every locale is untranslated English (e.g.
   `nl-nl label.access-type = "Access Type"`, `sv-se label.admin-access-required = "Admin access required."`).
   CLAUDE.md calls this a reviewable defect; **nothing checks it** (the i18n CI step verifies key *sync*, not
   translation).

---

## Java (`openmetadata-service`; populations: 1,782 module main `.java`, 2,255 repo-wide)

### Wildcard imports — OBSERVED (full census)
CLAUDE.md forbids them (L233, L504). `grep -rnE '^import .*\.\*;' openmetadata-service/src/main/java --include='*.java' | wc -l`
→ **29** statements across **21 files** (`… -rl … | wc -l`). **Ratio: 21/1782 = 1.18% of files (98.8%
clean).** Repo-wide: **74** statements / 2,255 files.
Top 5 (`… | cut -d: -f1 | sort | uniq -c | sort -rn | head`): `attachments/AzureAssetService.java` (3),
`security/policyevaluator/PermissionDebugService.java` (2), `resources/teams/PersonaResource.java` (2),
`resources/databases/StoredProcedureResource.java` (2), `rdf/sql2sparql/SparqlBuilder.java` (2).
**TREND: violations are in actively-maintained files, not legacy** — `git log -1 --format=%ci`:
`PersonaResource.java` 2026-07-12 (12 days ago), `EntityUtil.java` 2026-06-22,
`StoredProcedureResource.java` 2026-06-02, `AzureAssetService.java` 2026-05-08. **Not CI-enforced** —
spotless uses `googleJavaFormat` + `removeUnusedImports`, which neither collapses nor bans wildcard
imports, so violations survive edits.

### Spotless formatting — OBSERVED (ran `mvn -pl openmetadata-service spotless:check`, exit 0, did NOT apply)
`Spotless.Java is keeping 2364 files clean - 0 needs changes`. **0 / 2,364 = 100% clean.** CI enforces
via `java-checkstyle.yml` (`mvn spotless:apply` + `git diff-files --quiet` → comment + `exit 1`).

### Structured vs string-concatenated logging — OBSERVED
*(Not explicitly in CLAUDE.md; measured as SLF4J best practice.)*
`grep -rnE '(log|LOG|logger)\.(info|warn|error|debug|trace)\([^;]*"\s*\+' … | wc -l` → **0**
concatenated, out of **5,989** logging calls (`… \(' | wc -l`). **0.00%** — the codebase uses
parameterized `LOG.x("… {}", var)` uniformly (5,980 `LOG`, 7 `log`, 2 `logger`).

### Resource-handler boundary validation — INFERRED (12/123 resource files, sorted-index spread)
Sample of 12 `*Resource.java` (indices 1,12,…,123 of 123 sorted): 111 JAX-RS handlers, 56 mutating, 27
carry `@Valid`, 53 inline `authorize`. **Two-layer validation is the norm and mostly inherited:** entity
resources extend `EntityResource<T,Repo>` whose base `create/…` methods call `authorizer.authorize(...)`
(`resources/EntityResource.java:217,268,362,396,410,424,484,495,…`) and take `@Valid Create…` bodies —
so low inline-authorize counts in subclasses (AuditReportResource=0, DatabaseResource=3) are guarded by
inheritance, not unguarded. `@Valid` tracks *request bodies* (DELETE/vote/restore path-param handlers have
no body). Thin spots flagged: `VectorSearchResource` (1 POST, no `@Valid`), `AttachmentResource` (2
mutating, no `@Valid`). **No sampled mutating handler lacked both validation and any authorization.** Not
a clean mechanical lint (authorization is inherited; `@Valid` presence is body-dependent).

---

## Python (`ingestion/`; env note: this tree has `.venv/` not `env/` — tools run from `.venv`)

1. **`make py_format_check` (ruff check + `ruff format --check`) — OBSERVED, PASS.** `ruff check … && ruff
   format --check …` → "All checks passed!" + "2586 files already formatted", `make` exit 0. **0 / 2,586 =
   0.0%.** CI-gated by `py-checkstyle.yml` (currently green).
2. **`make static-checks` (basedpyright via nox) — OBSERVED, ran, exit 1: 59 errors + 92 warnings beyond the
   committed baseline.** The baseline `.basedpyright/baseline.json` **suppresses 11,927 pre-existing findings
   across 926 files**; `--baselinemode=discard` fails only on *new* errors. Top rules: `reportMissingParameterType`
   91 (warn), `reportAttributeAccessIssue` 39 (err). **Caveat:** several are local platform/env artifacts —
   2 `reportMissingImports` (`py7zr`/`rarfile` extras absent locally), and much of the pandas-stub
   `reportAttributeAccessIssue` is the documented "macOS arm64 vs Linux x86_64 stub drift"; **not confirmed equal
   to CI's Linux numbers.** Mechanism is a **no-new-errors ratchet over a large baseline**, not a clean tree. CI
   gates it (`py-tests.yml` `nox -s static-checks`, `pipefail`). Trend: error hotspots are older (Apr–May 2026).
3. **Exception handling — OBSERVED + INFERRED.** Over `ingestion/src/metadata` (2,075 `except` handlers, 1,968
   `try`): **bare `except:` = 1 real** (`hive/custom_hive_connection.py:181`; a 2nd grep hit is docstring prose)
   → **0.05%**. **broad `except Exception` = 1,566 = 75.5% of handlers** — the *dominant, sanctioned idiom*
   (resilient log-and-continue ingestion; many carry `# pylint: disable=broad-except`/`# noqa: B904`). Top 5 by
   count are actively maintained (`powerbi/metadata.py` 43 @2026-07-10, `dbt/metadata.py` 26 @2026-07-15).
   *Without re-raise* (full-population heuristic): re-raise **165/1,566 = 10.5%**, log/report-and-continue
   **84%**, **genuine silent swallow ≈86 = 5.5%** (INFERRED sample n=21 agrees: ~5% silent). So ~90% don't
   re-raise, but only ~5.5% swallow silently.
4. **Connector registration (`service_spec.py`) — OBSERVED, 100%.** Every leaf connector (dir with
   `metadata.py`/`connection.py`) has a `service_spec.py`: **95/95 depth-1, 96/96 any-depth, 0 missing.** The 4
   depth-1 dirs without one are principled non-connectors: `database/common` (shared base), and
   `database/iceberg` / `database/microsoftfabric` / `pipeline/microsoftfabricpipeline` (git-ignored `__pycache__`
   only, **0 tracked `.py`**). **Registration discipline holds at 100%** for tracked connectors.

---

## Verdict table

Verdict = readiness to promote to a **blocking** lint. **ENFORCE** = high adherence, safe to gate (small
or zero cleanup). **WARN** = mid adherence / advisory only. **DOCUMENT** = low adherence or not mechanically
measurable — an aspiration, keep as prose. **DROP** = the code does the opposite; the "rule" isn't one.

| # | Convention | Population | Violations | Ratio (adherence) | Trend | Currently gated? | **Verdict** |
|---|---|---|---|---|---|---|---|
| **Java** |
| J1 | No wildcard imports | 1,782 files | 21 files / 29 stmts | 98.8% clean | fresh violations (files edited this month) | No | **ENFORCE** (~21 files to fix first) |
| J2 | Spotless formatting | 2,364 files | 0 | 100% | clean | **Yes** (java-checkstyle.yml) | **ENFORCE** (already) |
| J3 | Parameterized (not concatenated) logging | 5,989 calls | 0 | 100% | clean | No | **ENFORCE** (de facto universal; not yet a written rule) |
| J4 | Resource boundary validation (@Valid + authorize) | 123 resources (12 sampled) | no unguarded handler found | systematic via `EntityResource` inheritance | stable | Partly (framework) | **WARN** (holds, but not a clean lint) |
| **Python** |
| P1 | ruff check + format (`py_format_check`) | 2,586 files | 0 | 100% | clean | **Yes** (py-checkstyle.yml) | **ENFORCE** (already) |
| P2 | basedpyright type-clean (`static-checks`) | 926 files baselined (11,927 suppressed) | 59 err/92 warn beyond baseline (local; env-caveated) | ratchet, not clean | hotspots older | **Yes** (ratchet: no *new* errors) | **ENFORCE** as a no-new-errors ratchet (NOT "zero errors") |
| P3 | No bare `except:` | 2,075 handlers | 1 | 99.95% | 1 old file | No | **ENFORCE** (gate ruff E722; ~1 fix) |
| P4 | Avoid broad `except Exception` | 2,075 handlers | 1,566 | **24.5%** (75.5% are broad) | actively used | No | **DROP** (the sanctioned idiom; a ban would fail everywhere) |
| P5 | Broad-except must log or re-raise (no silent swallow) | 1,566 broad | ~86 silent | 94.5% log/re-raise | stable | No | **WARN** (only ~5.5% silent swallows worth auditing) |
| P6 | Connector `service_spec.py` registration | 96 connectors | 0 | 100% | stable | No (runtime import only) | **ENFORCE** (structural; 100%) |
| **Frontend** |
| F1 | Avoid Ant Design (use ui-core-components) | 4,725 ts/tsx | 864 files | 81.7% antd-free | **stalled** (68.5% of antd files edited ≤90d) | No | **DOCUMENT** (migration not progressing; blanket block infeasible) |
| F2 | No `any` | 4,725 | 461 files / 1,771 lines | 90.2% | actively (re)introduced; top-5 generated | eslint `warn` only | **WARN** (mid; exclude `generated/` first) |
| F3 | No `console.*` | 4,725 | 2 unsuppressed (34 total, 32 disabled) | ~99.96% | recent but suppressed | **Yes** (eslint `error`) | **ENFORCE** (already) |
| F4 | Functional components only | 4,725 | 0 | 100% | clean | No | **ENFORCE** (safe to gate today) |
| F5 | `.component.tsx` / `.interface.ts` naming | 1,070 tsx | 681 (36.4% suffixed) | 36.4% (rough proxy) | n/a | No | **DOCUMENT** (proxy unreliable; not a real violation count) |
| F6 | Wrap JSX strings in `t()` | — | not measurable | n/a | n/a | No | **DOCUMENT** (needs AST tool; no trustworthy count) |
| F7 | Apache-2.0 license header | 4,751 | 12 (9 generated `.js`) | 99.75% | 3 recent real misses | **Yes** (ui-checkstyle license step) | **ENFORCE** (already) |
| F8 | Non-en locales actually translated | 4,404 keys × 19 | ~225–396 English/locale | ~90–94% translated | latent, unchecked | No (sync only) | **DOCUMENT** (real defect; not a clean lint — some identity legit) |
| **Cross-cutting** |
| X1 | Comments explain *why*, don't restate code | 15-file sample | impressionistic | majority comply; bootstrap code narrates | n/a | No | **DOCUMENT** (unmeasurable) |
| X2 | 90% test coverage | per-module | not measurable in-repo | no in-repo gate exists | n/a | No (SonarCloud only, unverifiable) | **DOCUMENT** (aspiration; ungated) |

### Rules flagged as effectively NOT in force
- **P4 — "avoid broad `except Exception`":** 75.5% of handlers are broad; it is the deliberate ingestion idiom
  (with opt-in `# noqa`). This is a **DROP** — the code follows the opposite of the stated ideal.
- **F1 — "don't use Ant Design":** 864 files (18.3%) import antd and **68.5% were edited in the last 90 days** —
  the migration is not progressing. As a *blocking* rule it is not in force (**DOCUMENT**); it only holds as a
  direction of intent for genuinely net-new components.
- **F5 / F6 — component-naming and JSX-`t()`:** not reliably measurable; F5's 36.4% is a proxy artifact, F6 is
  unmeasurable with grep. Neither is enforceable as stated.
- **X2 — 90% coverage:** no jacoco rule, no Jest `coverageThreshold`, no coverage `fail_under`; **zero in-repo
  gate.** A number nobody measures in-repo cannot be promoted to blocking.

### Safe to promote to blocking now (high adherence, small/zero cleanup)
J2, P1, F3, F4, F7 are **already gated** and green. **J1 (no-wildcard, 98.8%), P3 (no-bare-except, 99.95%),
P6 (service_spec 100%), J3 (parameterized logging 100%), F4 (functional-only 100%)** are the ungated rules
with adherence high enough to make blocking with negligible cleanup. P2 is enforceable only as a
**no-new-errors ratchet**, not as "zero type errors."

# CI Feedback Loops — Measured From History

**Tooling:** `gh` 2.87.3, authenticated as `TeddyCr` against `open-metadata/OpenMetadata` (default
`main`). **No workflow run was triggered; no test suite was run locally.** All numbers are read from
GitHub Actions run history (`gh api .../actions/workflows/<f>/runs?per_page=100`) and from the
`merge-rules` ruleset. Maven build timings are taken from CI job steps (stated below), not from a
local build.

**Method notes that matter for reading the tables:**
- Most PR checks use `pull_request_target` + a `dorny/paths-filter` "check-changes" gate + a
  `safe to test` label gate. When a PR doesn't touch the relevant paths (or isn't labeled), the run
  **completes in seconds on the skip path**. So the raw *median* is skip-dominated and misleading.
  I therefore report **`skip%`** (fraction of completed runs finishing < 1.5 min = the no-op path) and
  the **`work_md` / `work_p90`** = median / p90 of runs ≥ 1.5 min (the check actually executing).
- **Flakiness estimate** = fraction of runs that were **re-run and then passed with no new commit**,
  measured as `run_attempt > 1` runs that concluded `success`. Across all workflows this was **0** in
  the last 100 runs (see §2 caveat).
- `pass%` is over completed `success`+`failure` runs and **includes `push`/`merge_group` events**, not
  only PRs — noted where it distorts (playwright-sso-tests).

---

## 1. Required vs scheduled/nightly/manual

Classic branch protection is **off** (`branches/main/protection` → 404 "Branch not protected"). Gating
is via the **`merge-rules` ruleset** (id 6520078, `enforcement: active`, refs `main` + default), which
lists the **8 required status-check contexts** (+ **1 approving review**, + a **merge queue** — hence the
`merge_group` triggers):

| Required context | Produced by workflow file(s) |
|---|---|
| `java-checkstyle` | java-checkstyle.yml |
| `py-checkstyle` | py-checkstyle.yml |
| `ui-checkstyle` | ui-checkstyle.yml |
| `ui-coverage` | yarn-coverage.yml |
| `py-tests-status` | py-tests.yml + py-tests-postgres.yml |
| `integration-tests-mysql-elasticsearch` | integration-tests-mysql-elasticsearch.yml |
| `integration-tests-postgres-opensearch` | integration-tests-postgres-opensearch.yml |
| `playwright-summary` | playwright-postgresql-e2e.yml (+ playwright-sso-tests.yml) |

**PR-triggered but NOT required** (advisory / auto / informational): `maven-sonar-build`,
`maven-build-collate`, `typescript-type-generation` (auto-commits regenerated types),
`openmetadata-service-unit-tests`, `validate-jsons-yamls`, `airflow-apis-tests`,
`py-operator-build-test`, `data-access-request-e2e`, `playwright-mysql-e2e`(+`-skip`),
`playwright-integration-tests-{mysql,postgres}`, `playwright-knowledge-graph-postgresql-e2e`,
`pr-metadata-validation`, `team-labeler`, `label-connector`, `playwright-docs-check`,
`validate-docker-compose-quickstart`, `playwright-postgresql-pr-comment` (`workflow_run` reporter).

**Scheduled / nightly** (`schedule:`): `py-cli-e2e-tests`, `py-sonarcloud-nightly`, `security-scan`,
`monitor-slack-link`, `stale`, `storybook-nightly`, `playwright-search-nightly`,
`playwright-sso-login-nightly`, `java-playwright-external`, `mysql-nightly-e2e`,
`postgresql-nightly-e2e`.

**Manual only** (`workflow_dispatch:`): all `docker-*.yml` (7), `trivy-scan-*` (3),
`git-create-release-branch`, `publish-maven-package`, `python-packages-publish`,
`java-playwright-nightly`, `update-playwright-e2e-docs`, and — notably — **`codeql.yml` is
dispatch-only (CodeQL does not run on PRs here).**

---

## 2. Per-workflow run stats (last ~100 runs)

| Workflow (required★) | n | skip% | work median | work p90 | pass% | failures | re-run flakiness |
|---|---:|---:|---:|---:|---:|---:|---:|
| ★ java-checkstyle | 100 | 2% | **3.1m** | 5.1m | 88.2% | 9 | 0 |
| ★ py-checkstyle | 100 | 62% | 6.2m | 6.8m | 88.5% | 9 | 0 |
| ★ ui-checkstyle | 100 | 53% | 4.8m | 5.4m | 95.3% | 4 | 0 |
| ★ ui-coverage (yarn-coverage) | 100 | 58% | 19.9m | 21.9m | 98.8% | 1 | 0 |
| ★ py-tests | 100 | 57% | **69.2m** | 71.2m | 84.2% | 12 | 0 |
| ★ py-tests-postgres | 100 | 57% | 65.3m | 73.8m | 86.8% | 10 | 0 |
| ★ integration-tests-mysql-elasticsearch | 100 | 59% | 37.6m | 40.1m | 91.7% | 6 | 0 |
| ★ integration-tests-postgres-opensearch | 100 | 60% | 33.8m | 39.1m | 91.9% | 6 | 0 |
| ★ playwright-postgresql-e2e | 100 | 84% | **49.6m** | 54.1m | **82.0%** | 16 | 0 |
| ★ playwright-sso-tests | 100 | — | — | — | 0%* | 100* | 0 |
| maven-sonar-build | 100 | 5% | 13.6m | 16.0m | 88.3% | 7 | 0 |
| openmetadata-service-unit-tests | 100 | 51% | 9.8m | 11.2m | 92.9% | 5 | 0 |
| typescript-type-generation | 100 | 8% | 5.0m | 6.5m | **65.6%** | 32 | 0 |
| validate-jsons-yamls | 100 | 37% | 2.8m | 2.9m | 92.7% | 6 | 0 |

\* **playwright-sso-tests anomaly:** 100/100 recent runs concluded `failure` — **93 on `push` events,
7 on `pull_request`** — all on the fast path. It is not a healthy PR signal by itself; the effective
`playwright-summary` cost/reliability is **playwright-postgresql-e2e** (82% pass, the least-reliable
required check).

**Flakiness caveat (important):** the re-run-recovery metric is **0 across every workflow** — GitHub's
"re-run" (which increments `run_attempt`) is essentially never used here. That does **not** mean the
checks are non-flaky; it means failures are resolved by **pushing a new commit** (new `head_sha`), which
this metric cannot distinguish from a real fix. So: treat a red *checkstyle* check (java/py/ui) as a
**real** signal (88–95% pass, deterministic). Treat **playwright-postgresql-e2e (82%)** and the
**~84% py-tests / ~92% integration** pass rates as the workflows where an unrelated/environmental
failure is most plausible — but it is **not measurable as re-run flakiness**, only as a lower pass rate.

---

## 3. Ranked by expected wall-clock cost to an agent

Cost = **`work_median × P(it runs)`**, where `P(it runs)` = the empirical non-skip rate `(1 − skip%)`
(how often the expensive path actually executed across recent PRs). Required checks in **bold**.

| Rank | Workflow | work median | P(runs) | **Expected cost** |
|---:|---|---:|---:|---:|
| 1 | **py-tests** | 69.2m | 0.43 | **≈29.8m** |
| 2 | **py-tests-postgres** | 65.3m | 0.43 | **≈28.1m** |
| 3 | **integration-tests-mysql-elasticsearch** | 37.6m | 0.41 | **≈15.4m** |
| 4 | **integration-tests-postgres-opensearch** | 33.8m | 0.40 | **≈13.5m** |
| 5 | maven-sonar-build | 13.6m | 0.95 | ≈12.9m |
| 6 | **ui-coverage** | 19.9m | 0.42 | **≈8.4m** |
| 7 | **playwright-postgresql-e2e** | 49.6m | 0.16 | **≈7.9m** |
| 8 | openmetadata-service-unit-tests | 9.8m | 0.49 | ≈4.8m |
| 9 | typescript-type-generation | 5.0m | 0.92 | ≈4.6m |
| 10 | **java-checkstyle** | 3.1m | 0.98 | **≈3.0m** |
| 11 | **py-checkstyle** | 6.2m | 0.38 | **≈2.4m** |
| 12 | **ui-checkstyle** | 4.8m | 0.47 | **≈2.3m** |
| 13 | validate-jsons-yamls | 2.8m | 0.63 | ≈1.8m |

**Takeaway:** the Python + backend/UI **test** checks (ranks 1–7) dominate wall-clock; the four
**checkstyle/validate** checks (ranks 10–13) are cheap but are the ones that most often fail on
formatting/lint. An agent should spend local effort predicting the *cheap frequent failers* (checkstyle)
and only pay for the expensive test lanes when its diff touches their paths.

---

## 4. Shortest local sequence that predicts PR outcome

| Required CI check | Local equivalent | Faithful? |
|---|---|---|
| `java-checkstyle` | `mvn spotless:check` (scope `-pl openmetadata-service`) | **Faithful** — CI runs `spotless:apply` + `git diff` gate; `:check` is the read-only mirror. *(Neither catches wildcard imports — see 08b J1.)* |
| `py-checkstyle` | `make py_format_check` | **Mostly** — ruff check+format are exact. CI additionally runs `make generate` first, so schema/codegen drift can fail CI that `py_format_check` alone won't show. |
| `ui-checkstyle` | `make ui-checkstyle-changed` / `yarn ui-checkstyle:changed` | **Faithful** — same organize-imports → eslint → prettier → license → i18n on changed files. |
| `ui-coverage` | `yarn test:coverage` (or `yarn test:cov-summary`) | **Partial** — runs the Jest suite (faithful pass/fail); the coverage-*number* gate is SonarCloud, no local equivalent. |
| `py-tests-status` | `make unit_ingestion_dev_env` (unit) | **Partial** — unit tests reproduce locally; CI's matrix also runs DB-integration lanes against real MySQL/Postgres containers — not cheaply reproducible. |
| `integration-tests-{mysql-es, postgres-os}` | `mvn verify -pl openmetadata-integration-tests -DdatabaseType=mysql\|postgres` | **Faithful but heavy** — ITs self-bootstrap via testcontainers; ~35–40m; needs Docker. Not a cheap predictor. |
| `playwright-summary` | `yarn playwright:run` against a local stack (`./docker/run_local_docker.sh`) | **Faithful but heavy** — ~50m; needs the full local stack. Not a cheap predictor. |

**CI checks with NO cheap local equivalent (gaps):**
- **SonarCloud quality gate** (coverage-on-new-code, code smells) — server-side; `ui-coverage`/sonar
  jobs feed it but the pass/fail verdict is not reproducible locally.
- **`typescript-type-generation` drift** — local mirror is
  `openmetadata-ui/.../json2ts-generate-all.sh -l true && git diff --exit-code src/generated`, faithful
  but rarely run; on **fork PRs** CI *fails* if generated types are stale (65.6% pass reflects this).
- **PR-metadata gates** — `pr-metadata-validation`, `team-labeler`, the `safe to test` label, and the
  **1-approving-review** rule are CI/human-only.
- **Playwright flakiness / environmental failures** — only observable in CI.
- **`validate-jsons-yamls`** — partially mirrored by `yarn parse-schema` + JSON/YAML lint; no single
  faithful local command.

---

## 5. `claude.yml` — the in-CI agent

- **Triggers:** `issue_comment`, `pull_request_review_comment`, `issues` (opened/assigned),
  `pull_request_review` — each gated **only** on the literal `@claude` phrase (`claude.yml:15-19`).
  **No author-association gate:** any GitHub user can invoke it.
- **Permissions (`:21-26`):** `contents: read`, `pull-requests: read`, `issues: read`,
  `id-token: write`, `actions: read`. The `GITHUB_TOKEN` is **read-only** — the agent cannot push,
  merge, or edit issues/PRs with it. Secret `CLAUDE_CODE_OAUTH_TOKEN` (`:37`) is the maintainers'
  Anthropic billing identity.
- **What it's allowed to do:** read the repo (checked out at the triggering ref; `fetch-depth: 1`) and
  the PR/issue context, and respond. `claude_args` / `--allowedTools` is **commented out (`:44`)**, so
  the tool surface is the action's default, not a pinned minimal set.
- **Can its instructions drift from the repo's `CLAUDE.md`? Yes, two ways:**
  1. **By checked-out ref.** For `issue_comment`/`issues` events the checkout defaults to the base
     branch, so it reads **main's** `CLAUDE.md` — which can lag a PR's version, or (on a stale branch)
     differ from what the contributor sees. The instructions are whatever `CLAUDE.md` exists at that
     ref, not a pinned copy.
  2. **By untrusted PR content.** The action reads the PR diff/body/comments; a fork PR can include a
     modified `CLAUDE.md` (or injected directives in code comments) in its diff. Nothing in `claude.yml`
     pins the instruction set (no `prompt:` override), so the agent's guidance is exactly whatever the
     checked-out tree + PR content say.
  (Full trust-boundary write-up in `08d-hazards.md §5`; this is a hardening gap, not a live breach —
  the read-only token + base-branch checkout bound the blast radius.)

---

## 6. Maven build time (from CI job steps — not built locally)

I did **not** run a local Maven build (per the constraint). Timings are read from CI job steps:
- **Backend build + bundle** — the integration-tests workflow step *"Build and Bundle Integration Test
  Runtime"* runs `mvn -DskipTests -DskipITs -Dspring-boot.repackage.skip=true …`
  (`integration-tests-mysql-elasticsearch.yml:156`) and took **≈5.0 min** across the 4 most-recent
  successful runs, **with `~/.m2` dependency cache warm** (a "Cache Maven dependencies" step precedes
  it). This is the faithful proxy for **`mvn clean package -DskipTests -DonlyBackend -pl '!openmetadata-ui'`**
  (warm dependencies, clean workspace compile).
- **Full `mvn clean package -DskipTests`** (incl. `openmetadata-ui`) is larger — the UI module adds a
  yarn install + Vite build on top of the ~5 min backend. CI never runs the full-tree variant as an
  isolated step, so I have no single clean number; the **`maven-build-collate.yml`** workflow (a heavier
  superset: full build + packaging) has a **53 min median / 60.8 min p90**, which is an *upper bound*,
  not the `-DskipTests` figure.
- **Cold vs warm:** CI is **warm-dependencies** (cached `~/.m2`), cold-workspace. A true **cold** build
  (empty `~/.m2`, first dependency download of the full reactor) would add several minutes of network
  resolution on top of the ~5 min — **estimated, not measured** (no local build was run).

**Bottom line for an agent:** budget **~5 min** for a warm backend package (`-DonlyBackend`), and treat
a full-tree `mvn clean package -DskipTests` as meaningfully longer once the UI module is included.

---

## Recommended pre-PR local sequence — ordered by cost-to-confidence

Cheapest commands that catch the most CI failures, first. Run only the steps whose files your diff
touches (noted in brackets). Steps 1–4 are seconds-to-minutes and predict the **cheap, frequently-failing
required checks**; the heavy steps are worth it only when your diff lands in their paths.

1. **`mvn spotless:check`** *(any `.java` change; ~seconds–1m)* → predicts **java-checkstyle** (required;
   ~88% pass ⇒ a frequent failer). If it flags, `mvn spotless:apply`.
2. **`make py_format_check`** *(any Python change; ~seconds, ruff)* → predicts **py-checkstyle** (required;
   ~88% pass). If you changed a JSON schema, run **`make generate`** first (CI does).
3. **`yarn ui-checkstyle:changed`** *(any `.ts/.tsx/.json` under the UI trees; ~1–2m)* → predicts
   **ui-checkstyle** (required; runs eslint + prettier + license + i18n on changed files).
4. **`npx tsc --noEmit`** *(UI change; ~1–2m)* → catches TS type errors the lint step doesn't.
5. **`json2ts-generate-all.sh -l true && git diff --exit-code src/generated`** *(only if you edited a JSON
   schema)* → predicts **typescript-type-generation** drift (which hard-fails on fork PRs).
6. **`make unit_ingestion_dev_env`** *(Python change; ~minutes)* → predicts the unit portion of
   **py-tests-status** (the DB-integration lanes still only run in CI).
7. **`mvn test -pl openmetadata-service`** *(backend change; ~10m)* → predicts unit regressions before the
   ~15–30m required integration lanes run in CI.
8. **Heavy, only when your diff touches them:**
   `mvn verify -pl openmetadata-integration-tests -DdatabaseType=mysql` (predicts the integration-tests
   required checks; ~35–40m, Docker) and `yarn playwright:run` against `./docker/run_local_docker.sh`
   (predicts **playwright-postgresql-e2e**, the least-reliable required check at 82%; ~50m).

**No local step predicts:** the SonarCloud quality gate, PR-metadata/label gates, or the 1-review
requirement — those clear only in CI/review.

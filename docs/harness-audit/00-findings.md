# Agent-Harness Configuration Audit — Findings

**Scope:** agent-facing instruction sources in this repo — `CLAUDE.md`, `AGENTS.md`,
`DEVELOPER.md`, `openmetadata-ui-core-components/CLAUDE.md`, every `SKILL.md` under
`skills/`, `.claude/skills/`, `.agents/skills/`, `skills/standards/*`, and the hook
messages in `.claude/settings.json` and `skills/hooks/hooks.json`.

**Method:** every claim below was checked against the current tree, the root `Makefile`,
`ingestion/Makefile`, `openmetadata-ui/src/main/resources/ui/package.json`,
`eslint.config.mjs`, and the CI workflows under `.github/workflows/`. Correctness is
determined from code/CI/build config, never from which document reads as more current.
Line numbers are as of this audit. **Read-only audit — nothing was modified. No fixes are proposed.**

---

## 1. CONTRADICTIONS

### Already-confirmed (restated with the code evidence that settles them)

**KD1 — Build tool: Webpack vs Vite.** *Vite is correct.*
- `CLAUDE.md:14` — "**Frontend**: React + TypeScript, built with **Webpack** and Yarn"
- `AGENTS.md:12` — "**Frontend**: React + TypeScript + Ant Design, built with **Webpack** and Yarn"
- Code: `openmetadata-ui/.../ui/package.json` `"start": "vite"`, `"build": "... vite build"`; the only build-tool dependency is `vite` (no `webpack` package, no `webpack.config.*`). `openmetadata-ui-core-components/CLAUDE.md:9` correctly says "**Build tool**: Vite (library mode)". → Both root docs are wrong; the nested lib CLAUDE.md is right.

**KD3 — Python version ceiling: 3.10–3.11 vs 3.10–3.12.** *There shoudl not be a ceilling.*
- `AGENTS.md:13` — "Python **3.10-3.12**"
- `CLAUDE.md:15` — "Python **3.10-3.11**"; `CLAUDE.md:24` — "supports Python **3.10-3.11**; 3.11 is recommended"
- Code: `ingestion/pyproject.toml` declares `>=3.10` with **no upper bound**; every CI job pins **3.10** (`.github/workflows/py-checkstyle.yml:81` `python-version: '3.10'`). Neither the 3.11 nor the 3.12 ceiling is expressed anywhere in code. **To resolve:** the maintainers must state a supported max, or add a `python_requires`/classifier ceiling to `pyproject.toml`. Do not guess.

> KD2 (install_dev_env / unit_ingestion "not root targets") is **not** a real contradiction — it is corrected in the final section.

### New contradictions

**C-A — Ant Design: "use it" (AGENTS.md) vs "never use it" (everything else + a blocking hook).** *Never-use-for-new-work is correct.*
- `AGENTS.md:12` — "React + TypeScript + **Ant Design**"; `AGENTS.md:105` — "**Frontend**: Use React/TypeScript with **Ant Design components**"; `AGENTS.md:223` — "External libraries (React, **Ant Design**, etc.)". (AGENTS.md is even self-inconsistent: `:133` "do not use Ant Design", `:132` "gradually migrating from Ant Design".)
- `CLAUDE.md:220` — "do not use Ant Design or introduce new UI component library dependencies"; `DEVELOPER.md:63` — "Use components from `openmetadata-ui-core-components`, **never Ant Design**"; `openmetadata-ui-core-components/CLAUDE.md:11` — "react-aria-components (**NOT Ant Design**)".
- Enforcement direction confirms the ban: `.claude/settings.json:14` is a **blocking** `PreToolUse` hook — "Do not use Ant Design. Use components from openmetadata-ui-core-components"; `.claude/settings.json:66` warns on antd in new files. Ant Design remains only as a *legacy* dependency. → `AGENTS.md`'s "use Ant Design" guidance for new frontend work is contradicted by every other source and by the hooks.

**C-B — i18n locale count: "17" (CLAUDE.md + hook) vs 19 enumerated (AGENTS.md) vs 19/20 actual.** *There are 19 non-English locale files (20 total incl. `en-us.json`); "17" is wrong.*
- `CLAUDE.md:103` — "yarn i18n # Sync all **17** locale files with en-us.json"
- `.claude/settings.json:51` (hook) — "Run `yarn i18n` to sync all **17** locale files before committing"
- `AGENTS.md:117` — enumerates **19** languages: `ar-sa, de-de, es-es, fr-fr, gl-es, he-he, ja-jp, ko-kr, mr-in, nl-nl, pr-pr, pt-br, pt-pt, ru-ru, sv-se, th-th, tr-tr, zh-cn, zh-tw`.
- Code: `openmetadata-ui/.../ui/src/locale/languages/` contains **20** `*.json` files — 19 non-English + `en-us.json`. `package.json` `"i18n": "sync-i18n --files '**/locale/languages/*.json' --primary en-us ..."` syncs all 20. → `AGENTS.md`'s enumerated 19 is correct; `CLAUDE.md:103` and the `settings.json` hook are wrong.

**C-C — Python formatter: `ruff` (most sources) vs "black + isort + pycln" (`.agents` skills).** *`ruff` is correct.*
- `.agents/skills/java-checkstyle/SKILL.md:58` — "Python formatting — use `make py_format` (**black + isort + pycln**)."
- `.agents/skills/ui-checkstyle/SKILL.md:86` — "Python formatting — use `make py_format` (**black + isort + pycln**)."
- Code: `ingestion/Makefile:54-56` `py_format:` runs `ruff check --fix …` then `ruff format …` — no black/isort/pycln anywhere. `CLAUDE.md` ("Apply ruff lint-fix + format"), `AGENTS.md:55`, and `skills/standards/code_style.md:128` ("Python: `ruff`") all say ruff. → the two `.agents` skills name the wrong tools.

**C-D — `ui-checkstyle` skill: the two copies disagree on whether to auto-commit: auto-commit should be ok unless agent is unsure.**
- `.claude/skills/ui-checkstyle/SKILL.md:112-117` — "Step 4: Commit (only if the user asked to) … **Do NOT auto-commit.** Surface the list … they decide."
- `.agents/skills/ui-checkstyle/SKILL.md:76-79` — "Otherwise **commit the reformatting diff as its own `Fix UI checkstyle` commit** … unless the user asked you to fold it into the in-progress commit." (i.e. commit by default)
- The `.agents` copy contradicts (a) its Claude sibling and (b) its own `java-checkstyle` sibling, both of which say commit only on request (`.claude/skills/java-checkstyle/SKILL.md:68-74`, `.agents/skills/java-checkstyle/SKILL.md:49-52`). Repo convention (no auto-commit unless asked) matches the `.claude` copy. → the `.agents` ui-checkstyle "commit by default" instruction is the outlier.

**C-E — "UI Checkstyle runs three per-area jobs `lint-src` / `lint-playwright` / `lint-core-components`" contradicts the workflow.** *There is one `checkstyle` job with six step-ids; no jobs by those names exist.*
- `CLAUDE.md:514`, `AGENTS.md:213`, `.claude/skills/ui-checkstyle/SKILL.md:15-20`, `.agents/skills/ui-checkstyle/SKILL.md:8-9` all describe "three per-area jobs" named `lint-src` / `lint-playwright` / `lint-core-components`.
- Code: `.github/workflows/ui-checkstyle.yml` defines jobs `check-changes`, `authorize`, `checkstyle`, `ui-checkstyle`. `lint_src`/`lint_playwright`/`lint_core_components` are **step ids** (underscores) inside the single `checkstyle` job (`ui-checkstyle.yml:141,240,277`), which actually runs **six** gated checks — src lint, **license header**, **i18n sync**, **app-docs**, playwright lint, core-components lint. → the "three jobs" model is factually wrong; also listed in §3 (the `UI Checkstyle / lint-src` path won't match any real job).

**C-F — connector-scaffolding skill referenced under two different names.** *At most one resolves; in this harness the Skill registry lists it as `connector-building`.*
- Directory is `skills/connector-building/`, but its frontmatter is `name: scaffold-connector` (`skills/connector-building/SKILL.md`).
- `skills/openmetadata-workflow/SKILL.md:21` routes new connectors through **`/connector-building`**.
- `DEVELOPER.md:108,120` and `skills/commands/scaffold-connector.md:9` (`skill: "openmetadata-skills:scaffold-connector"`) use **`/scaffold-connector`**.
- The runtime Skill listing surfaces it as **`connector-building`**. → the two docs point at different names; the `/scaffold-connector` references do not match the registered skill name in this harness (also §3).

**C-G — the Playwright test-gen skill is referenced under three conflicting names.** *Registered/invoked name is `playwright`.*
- `.claude/skills/playwright/SKILL.md:2` declares `name: playwright-test` and its Usage (`:15,:30`) tells the user to invoke `/playwright-test`.
- But the directory and the runtime Skill registration are **`playwright`**, and `skills/test-enforcement/SKILL.md:212` cross-references it as **`/playwright`**.
- → the skill's own self-name (`playwright-test`) disagrees with both its registration (`playwright`) and the `test-enforcement` cross-reference. At most one of `/playwright` and `/playwright-test` resolves (in this harness, `/playwright`). Also §3.

---

## 2. DUPLICATION

**Dup-1 — `java-checkstyle` skill exists twice** (`.claude/skills/java-checkstyle/SKILL.md` ← real dir; `.agents/skills/java-checkstyle/SKILL.md`). **Diverged.** Same core `mvn spotless:apply` procedure and both agree "commit only if asked", but: the `.claude` copy has YAML frontmatter (`user-invocable: true`, `argument-hint`, `allowed-tools`), an "Arguments"/`--check` section, and Notes pointing at the `test-locally` skill + `yarn pretty`; the `.agents` copy is "Codex agent"-flavored, has no such frontmatter, and adds an "Out of scope" section containing the **wrong** Python-tooling claim (§C-C).

**Dup-2 — `ui-checkstyle` skill exists twice** (`.claude/skills/ui-checkstyle/SKILL.md`; `.agents/skills/ui-checkstyle/SKILL.md`). **Diverged.** Identical three-step `organize-imports → eslint --fix → prettier` sequence, but they diverge on (a) auto-commit behavior (§C-D) and (b) the `.agents` copy repeats the wrong "black + isort + pycln" (§C-C). The `.claude` copy adds `--check` mode + a longer Notes block (tsc caveat, warnings note) absent from `.agents`.

**Dup-3 — hooks defined in BOTH `.claude/settings.json` and `skills/hooks/hooks.json`. Diverged sub/superset.**
| Hook | `.claude/settings.json` | `skills/hooks/hooks.json` |
|---|---|---|
| PreToolUse Bash `--no-verify` block | present (`:9`), identical command | present (`:22`), identical command |
| PreToolUse Bash **antd** block | present (`:14`) | **absent** |
| SessionStart (cat `openmetadata-workflow/SKILL.md`) | **absent** | present (`:9`) |
| PostToolUse Java spotless reminder | present (`:26`,`:61`), identical message | present (`:34`), identical message |
| PostToolUse `make generate` reminder | `:31` "Remember to run `make generate` to regenerate **Pydantic models and rebuild dependent modules**." | `:44` "Run `make generate` to **regenerate models**." — **shorter, diverged wording** |
| PostToolUse parse-schema / any-type / console×2 / i18n / antd-write / license (8 more) | present (`:36–77`) | **absent** |
| Matcher shape | split `"Edit"` (6) and `"Write"` (4) | combined `"Edit|Write"` (2) |

`.claude/settings.json` is the active Claude Code project config; `skills/hooks/hooks.json` is the plugin's hook set (`skills/.claude-plugin/plugin.json:22` `"hooks": "./hooks/hooks.json"`). If both are active an agent gets duplicate reminders, with the `make generate` message differing in wording between them.

**Dup-4 — "Comments Policy" is near-verbatim duplicated.** `CLAUDE.md:307-321` and `AGENTS.md:179-192` — identical bullets ("Do NOT add unnecessary comments", same four bad examples). Copies are in sync.

**Dup-5 — "Testing Philosophy" duplicated verbatim.** `CLAUDE.md:580-587` and `AGENTS.md:243-249`. In sync.

**Dup-6 — "Python Code Requirements" (pytest, not unittest) duplicated verbatim.** `CLAUDE.md:557-565` and `AGENTS.md:229-236`. In sync.

**Dup-7 — "Python Ingestion Connector Guidelines" duplicated but diverged.** `CLAUDE.md:566-571` and `AGENTS.md:238-241` share the Redshift-IAM example, but `CLAUDE.md` adds a `model_str()` bullet (RootModel→string) that `AGENTS.md` lacks.

**Dup-8 — UI-checkstyle command sequence guidance repeated across five places** (`CLAUDE.md:508-532`, `AGENTS.md:209-216`, both `ui-checkstyle` skills, `skills/openmetadata-workflow/SKILL.md:60`). The `organize-imports → eslint → prettier` ordering is consistent everywhere; only the (wrong) job-name framing (§C-E) travels with it.

**Dup-9 — `make generate` cross-layer reminder repeated** in `.claude/settings.json:31`, `skills/hooks/hooks.json:44`, `skills/openmetadata-workflow/SKILL.md:53`, `CLAUDE.md:158-168`, `AGENTS.md:74-83`, `DEVELOPER.md:156-161`. Content consistent; wording varies (see Dup-3).

**Dup-10 — `test-locally` exists as two full, diverged copies (highest drift risk of the command set).** Unlike the other command files (thin ~11-line launchers), `skills/commands/test-locally.md` is a **107-line standalone** copy of the instructions, parallel to the **200-line** `skills/test-locally/SKILL.md`. They advertise **different flag surfaces**:
- `skills/commands/test-locally.md:4` — `argument-hint: "[--skip-maven] [--database mysql|postgresql]"` (but its body only ever uses `-d mysql`; postgresql is never exercised).
- `skills/test-locally/SKILL.md:5` — `argument-hint: "[--skip-maven] [--rebuild] [--teardown]"` (with a dedicated "Step 0: Handle Teardown").
→ two divergent instruction sets for the same operation.

**Dup-11 — command-vs-SKILL are launchers, except where noted.** `skills/commands/pr-checklist.md` (11 lines) vs `skills/pr-checklist/SKILL.md` (166 lines), `skills/commands/connector-standards.md` vs its SKILL, and `skills/commands/connector-review.md` vs its SKILL are **thin launchers by design** — not content duplication. Minor drift only: `skills/commands/connector-review.md:4` arg-hint `"[PR number, branch name, or connector path]"` differs from `skills/connector-review/SKILL.md:5` `"[PR number or connector path] [--local-only]"`.

---

## 3. DEAD REFERENCES

**DR-A — `make generate` invoked from the wrong directory.** `generate` is a **root-only** target (`Makefile:52`); it does **not** exist in `ingestion/Makefile` (targets there: `install*`, `static-checks`, `precommit_install`, `py_format`, `py_format_check`, `generate_settings_docs`, `unit_ingestion*`, `run_*`, `sonar_ingestion`, `coverage*`, `clean-nox` — no `generate`). Yet:
- `CLAUDE.md:117-120` — "### Python Ingestion Development … `cd ingestion` … `make generate`"
- `AGENTS.md:49-53` — "### Python Ingestion Development … `cd ingestion` … `make generate`"
Run from `ingestion/`, this fails `No rule to make target 'generate'`. (It works only from repo root.)

**DR-B — CI job names `lint-src` / `lint-playwright` / `lint-core-components` do not exist as jobs.** Referenced in `CLAUDE.md:514`, `AGENTS.md:213`, `.claude/skills/ui-checkstyle/SKILL.md:15-20`, `.agents/skills/ui-checkstyle/SKILL.md:8-9`. Actual `ui-checkstyle.yml` jobs are `check-changes`/`authorize`/`checkstyle`/`ui-checkstyle`; those tokens are **step ids** inside `checkstyle`. A required-check path of `UI Checkstyle / lint-src` matches nothing. (Cross-listed §C-E.)

**DR-C — `/scaffold-connector` does not match the registered skill name.** `DEVELOPER.md:108,120` and `skills/commands/scaffold-connector.md:9` reference `scaffold-connector`; the runtime Skill registry exposes it as **`connector-building`** (directory name), and `skills/openmetadata-workflow/SKILL.md:21` uses `/connector-building`. The frontmatter `name: scaffold-connector` disagrees with the directory. Depending on how the harness registers skills, one of these two names is always dead; in this session's listing, `/scaffold-connector` is the dead one. (Cross-listed §C-F.)

**DR-D — `/playwright-test` does not match the registered skill name.** `.claude/skills/playwright/SKILL.md:2,15,30` self-declare and invoke `playwright-test`, but the skill registers as `playwright` (the name `test-enforcement/SKILL.md:212` uses). `/playwright-test` resolves to nothing in this harness. (Cross-listed §C-G.)

**DR-E — stale MCP tool namespace `mcp__playwright__*`.** `.claude/skills/playwright-validation/SKILL.md:59,63,67,68` call `mcp__playwright__browser_navigate`, `mcp__playwright__browser_fill_form`, `mcp__playwright__browser_click`, `mcp__playwright__browser_snapshot`. The MCP server actually exposed is **`playwright-test`** — the real tools are `mcp__playwright-test__browser_*`. No `mcp__playwright__*` (without `-test`) server exists, so these four tool names do not resolve. This is a genuine dead reference an agent would hit at runtime, not just a doc typo.

**Checked and NOT dead** (the audit context flagged suspicion; these resolve):
- `openmetadata-ui/.../ui/src/locale/languages/*.json` — **exists** (20 files).
- `docs/formutils.md` (`CLAUDE.md:216`), `docs/colors.md` (`CLAUDE.md:230,236`), `src/styles/tokens.css`, `specs/README.md`, `specs/tokens/token-reference.md`, `specs/foundations/*.md` — all **exist**.
- All `yarn token-*` scripts (`token-audit`, `token-audit:report`, `token-migrate`, `token-gen`, `token-test`) referenced in `CLAUDE.md:237-269` — all **exist** in `package.json`.
- `.claude/skills/{java,ui}-checkstyle/SKILL.md` (from `CLAUDE.md`) and `.agents/skills/{java,ui}-checkstyle/SKILL.md` (from `AGENTS.md:200,216`) — all **exist**.
- "23 connector standards" (`DEVELOPER.md:106`) = 12 core + 11 source-type files under `skills/standards/` — **correct**.
- `make install_dev_env`, `make unit_ingestion` at root — **resolve** (see corrections).

---

## 4. PATH-SCOPE ANALYSIS of `CLAUDE.md` (591 lines)

Verdict key: **ROOT** = repo-wide, must stay always-loaded · **RULE** = applies only under a path glob, path-scopeable · **SKILL** = a procedure, load on invoke · **DEAD** = stale/contradicted content embedded in the section.

| Section (heading) | Lines | Applies-to glob | Verdict |
|---|---|---|---|
| Title / intro | 1–4 | `**` | ROOT |
| About OpenMetadata | 5–10 | `**` | ROOT |
| Architecture Overview | 11–19 | `**` | ROOT (line 14 Webpack = DEAD; line 15 py-version = contested) |
| Environment Setup (hdr) | 20–21 | `**` | ROOT |
| Python Virtual Environment (REQUIRED) | 22–40 | `ingestion/**`, any `make generate` | ROOT (bootstrap) |
| Initial Dev Environment Setup | 41–61 | `**` | SKILL (one-time setup) |
| Other Environment Notes | 62–70 | `**` | ROOT |
| Essential Development Commands (hdr) | 71–72 | `**` | SKILL |
| Prerequisites and Setup | 73–81 | `**` | SKILL |
| Frontend Development | 82–94 | `openmetadata-ui/src/main/resources/ui/**` | RULE |
| Frontend CI Checkstyle | 95–107 | `openmetadata-ui/.../ui/**` | SKILL (line 103 "17 locale" = DEAD) |
| Backend Development | 108–116 | `**/*.java`, `openmetadata-service/**` | RULE |
| Python Ingestion Development | 117–127 | `ingestion/**` | RULE (line 120 `cd ingestion && make generate` = DEAD) |
| Full Local Environment | 128–134 | `docker/**` | SKILL |
| Testing | 135–141 | `**` (tests) | SKILL |
| Backend Integration Tests | 142–157 | `openmetadata-integration-tests/**`, `*IT.java` | RULE |
| Code Generation and Schemas | 158–168 | `openmetadata-spec/**` | RULE |
| Schema Architecture | 169–174 | `openmetadata-spec/**` | RULE |
| Key Directories | 175–184 | `**` | ROOT |
| Development Workflow | 185–192 | `**` | ROOT |
| Frontend Architecture Patterns (hdr) | 193–194 | `openmetadata-ui/.../ui/**` | RULE |
| React Component Patterns | 195–208 | `openmetadata-ui/.../ui/src/**/*.tsx` | RULE |
| State Management | 209–213 | `openmetadata-ui/.../ui/src/**` | RULE |
| Forms | 214–217 | `openmetadata-ui/.../ui/src/**` | RULE |
| Styling | 218–236 | `openmetadata-ui/.../ui/src/**` | RULE |
| Design system tokens & specs | 237–269 | `openmetadata-ui/.../ui/**/*.{less,css,tsx}` | RULE |
| UI considerations | 270–274 | `openmetadata-ui/.../ui/src/**` | RULE |
| Application Configuration | 275–279 | `openmetadata-ui/.../ui/src/**` | RULE |
| Service Utilities | 280–284 | `openmetadata-ui/.../ui/src/**` | RULE |
| Type Safety | 285–290 | `openmetadata-ui/.../ui/src/**/*.ts` | RULE |
| Database and Migrations | 291–297 | `bootstrap/sql/migrations/**` | RULE |
| Security and Authentication | 298–304 | `**` (secrets), `conf/**` | ROOT |
| Code Generation Standards (hdr) | 305–306 | `**` | ROOT |
| Comments Policy | 307–321 | `**` | ROOT |
| Java Code Requirements | 322–332 | `**/*.java` | RULE |
| Method Size and Complexity | 333–390 | `**/*.java` | RULE |
| Naming and Readability | 391–398 | `**/*.java` | RULE |
| Immutability and Defensive Design | 399–405 | `**/*.java` | RULE |
| Error Handling | 406–413 | `**/*.java` | RULE |
| No Magic Strings | 414–429 | `**/*.java` | RULE |
| No Convoluted if/else Chains | 430–450 | `**/*.java` | RULE |
| No Code Duplication | 451–455 | `**/*.java` | RULE |
| Class Size | 456–461 | `**/*.java` | RULE |
| Modern Java (Java 21) | 462–483 | `**/*.java` | RULE |
| Common Bug Patterns to Avoid | 484–493 | `**/*.java` | RULE |
| Testing (Java) | 494–500 | `**/*.java`, `openmetadata-integration-tests/**` | RULE |
| Structure | 501–507 | `**/*.java` | RULE |
| TypeScript/Frontend Code Requirements | 508–532 | `openmetadata-ui/.../ui/src/**/*.{ts,tsx}` | RULE (line 514 job names = DEAD) |
| CI Checkstyle Rules | 533–548 | `openmetadata-ui/.../ui/src/**` | RULE |
| Playwright Test Rules | 549–556 | `openmetadata-ui/.../ui/playwright/**` | RULE |
| Python Code Requirements | 557–565 | `ingestion/**/*.py` | RULE |
| Python Ingestion Connector Guidelines | 566–571 | `ingestion/src/metadata/ingestion/source/**` | RULE |
| Caching | 572–579 | `**` (Java+Python+TS) | ROOT |
| Testing Philosophy | 580–587 | `**` | ROOT |
| Response Format | 588–591 | `**` | ROOT |

**Bucket totals (approx. lines):**
- **ROOT** (always-load): ~111 lines (~19%) — About, Architecture, Environment/venv, Key Directories, Dev Workflow, Security, Comments Policy, Caching, Testing Philosophy, Response Format.
- **RULE** (path-scopeable): ~421 lines (~71%) — the entire Java-standards block (`#### Method Size` … `#### Structure` alone is ~230 lines, all `**/*.java`) plus every UI/Frontend and ingestion/Python section.
- **SKILL** (load on invoke): ~59 lines (~10%) — setup/prereq/local-env/testing-command procedures.
- **DEAD lines embedded** (not standalone sections): line 14 (Webpack), line 103 ("17 locale files"), line 120 (`cd ingestion && make generate`), line 514 (job names). No section is wholly dead.

**Headline:** ~71% of `CLAUDE.md` is path-scoped RULE content (dominated by the Java "Kafka-grade" block, which only applies to `**/*.java`) and would never need to load for, say, a pure-UI or pure-Python change. Only ~19% is genuinely repo-wide ROOT material.

---

## 5. ENFORCEMENT GAP — the 10 advisory `PostToolUse` hooks

Hooks are in `.claude/settings.json`; the `Edit` matcher block has 6 (`:26,:31,:36,:41,:46,:51`), the `Write` matcher block has 4 (`:61,:66,:71,:76`).

| # | Hook (message gist) | `settings.json` | Enforced elsewhere? (workflow file · job/step) | Invariant or preference? | Cost if an agent ignores it |
|---|---|---|---|---|---|
| E1 | Edit `.java` → run `mvn spotless:apply` | `:26` | **Yes** — `java-checkstyle.yml` · job `java-checkstyle`, step "Run checkstyle" (`mvn spotless:apply`) + "Save checkstyle outcome" (`git diff-files --quiet` → `exit 1`) | Hard invariant | PR fails Java Checkstyle; bot auto-comments the exact fix. Low effort (auto-fixable). |
| E2 | Edit schema `.json` → run `make generate` | `:31` | **Partial** — UI side enforced by `typescript-type-generation.yml` · job `generate-types` (regenerates `src/generated/**`; auto-commits for same-repo PRs, **fails fork PRs** at "Fail workflow for fork PRs"). Python side **not drift-checked** (generated dir is gitignored; `py-checkstyle.yml:103` runs `make generate` only as a build prereq, no diff). Java POJOs regenerated by the Maven build (`target/`, uncommitted). | Hard for UI; auto-handled for Python/Java | Committed UI types drift → fork PR fails / same-repo PR gets a bot commit. Python: harmless (regenerated). See generated-output note below. |
| E3 | Edit connection schema `.json` → run `yarn parse-schema` | `:36` | **No** — output `src/jsons/connectionSchemas/**` is **gitignored** (build artifact) and **no** workflow runs `parse-schema`. | Local convenience only | UI forms locally stale until next build; **zero** CI/merge impact. |
| E4 | Edit `.ts/.tsx` containing `any` → use proper types | `:41` | **No** — `eslint.config.mjs:188,272` sets `@typescript-eslint/no-explicit-any` to **`'warn'`**, and `lint:base` runs eslint with **no `--max-warnings`**, so the `lint_src` step passes with `any` present. | Preference (contradicts CLAUDE.md's "NEVER use `any`") | `any` merges freely. Only this advisory hook + human review catch it. **This is the sharpest gap.** |
| E5 | Edit `.ts/.tsx` containing `console.*` → remove | `:46` | **Yes** — `no-console` is `'error'` (`eslint.config.mjs:106`); `ui-checkstyle.yml` · job `checkstyle`, step `lint_src` runs `yarn lint:base --fix` under `bash -eo pipefail`, so an unfixable error exits non-zero → final gate (`Check final results`) fails. | Hard invariant | PR fails UI Checkstyle (`lint_src`). |
| E6 | Edit `en-us.json` → run `yarn i18n` | `:51` | **Partial** — `ui-checkstyle.yml` · job `checkstyle`, step `i18n` runs `yarn i18n` + `git status` → `exit 1` on diff. Enforces **key sync only**, *not* that placeholders were translated. | Hard for sync; the "must translate" rule is **unenforced** | Out-of-sync keys → PR fails. Untranslated English-under-a-locale-key ships undetected by CI (reviewer-only). Message also says "17 locale files" (wrong, §C-B). |
| W1 | Write `.java` → run `mvn spotless:apply` | `:61` | **Yes** — same as E1 (`java-checkstyle.yml`). | Hard invariant | Same as E1. |
| W2 | Write `.ts/.tsx` with `antd` import → use core-components | `:66` | **No CI rule** — `eslint.config.mjs` has **no** `no-restricted-imports`/antd rule (only `no-restricted-syntax` for `ring-*`). The `PreToolUse` antd **block** (`settings.json:14`) matches `"Bash"` only, so it never fires on `Edit`/`Write`. | Preference (CLAUDE.md forbids for new work) | Ant Design imports merge with no CI failure; only this advisory Write hook + review catch them. **Second-sharpest gap.** |
| W3 | Write `.ts/.tsx/.js/.jsx` missing Apache-2.0 header | `:71` | **Yes** — `ui-checkstyle.yml` · job `checkstyle`, step `license` runs `yarn license-header-fix` + `git status` → `exit 1` on diff. | Hard invariant | PR fails UI Checkstyle (Licence Header). |
| W4 | Write `.ts/.tsx` containing `console.*` | `:76` | **Yes** — same as E5 (`no-console` = error). | Hard invariant | Same as E5. |

**Summary:** 6 of 10 are backed by a hard CI gate (E1, E5, W1, W3, W4, plus E6's *sync* half). **Three have no CI backstop and are the real gaps: E4 (`any` is only an eslint `warn`), W2 (no eslint antd rule; the blocking hook is Bash-only), and E3 (`parse-schema` output is a gitignored build artifact).** E2 and E6 are split — enforced for one concern (UI type drift; key sync) but not the other (Python drift is moot; translation quality is unchecked). The `any` ban (E4) is *restated* as a manual review checklist item in `skills/code-review/SKILL.md:95` ("No `any` types"), but a checklist is not a gate — nothing fails CI on `any`.

### The `make generate` reminder (E2) — can an agent edit generated output instead of the schema?

**Nothing in the harness prevents it.** `.claude/settings.json` and `.claude/settings.local.json` contain **no** `PreToolUse`/`Edit`/`Write` matcher that guards the off-limits generated paths; `settings.local.json` is permissions-only with `"deny": []`. An agent can freely `Edit`/`Write` `ingestion/src/metadata/generated/**` or `openmetadata-ui/.../ui/src/generated/**`.

The only things that make such an edit *not matter* live **outside** the harness, and they differ by language:
- **Python generated** (`ingestion/src/metadata/generated/**`) — **gitignored** (`git ls-files` → 0 tracked; `git check-ignore` confirms). `make generate` (`Makefile:56`) does `rm -rf ingestion/src/metadata/generated` before regenerating. So a hand-edit is (a) uncommittable and (b) destroyed on the next `make generate`. There is **no CI drift check** because there is nothing committed to diff.
- **UI generated** (`openmetadata-ui/.../ui/src/generated/**`) — **committed** (887 files tracked). The drift guard is `.github/workflows/typescript-type-generation.yml` (triggered by changes to `openmetadata-spec/.../schema/**` or `.../generated/**`): it re-runs `json2ts-generate-all.sh`, then **auto-commits** the regenerated types for same-repo PRs, or **fails the workflow** for fork PRs (`:207-209`). A hand-edited UI generated file that doesn't match the schema is silently overwritten (same-repo) or blocks the PR (fork).
- **Java POJOs** — generated into `openmetadata-spec/target/` by the Maven build (uncommitted); regenerated every build.

So the mechanism preventing "edit the generated output instead of the schema" is **gitignore + `rm -rf` on regenerate (Python)** and **a CI regenerate/drift workflow (UI)** — never a harness-level guard. The `make generate` hook itself is a pure reminder with no blocking power.

---

## Corrections to the prior inventory (EXISTING HARNESS / KNOWN DISCREPANCIES block)

1. **KD2 is largely wrong.** The block says `make install_dev_env` and `make unit_ingestion` "do not exist in the root Makefile … CLAUDE.md gets this right [by using `cd ingestion`]." But `Makefile:3` is `include ingestion/Makefile`, so **both targets resolve from the repo root** (`ingestion/Makefile` auto-selects `INGESTION_DIR := ingestion` when `CURDIR` ≠ `ingestion`, per its lines 1–10). AGENTS.md's root-level `make install_dev_env` (`:23`) and `make unit_ingestion` (`:70`) therefore **work**. The genuinely broken direction is the opposite one the block missed: **`make generate` from `ingestion/`** fails, because `generate` is root-only (§DR-A) — and *both* CLAUDE.md and AGENTS.md instruct it after `cd ingestion`.

2. **The "17 locale files" figure is authoritative in neither direction the block implies.** The tree has 19 non-English locale files (20 total). AGENTS.md's enumerated 19 (`:117`) is correct; `CLAUDE.md:103` and the `settings.json:51` hook ("17") are wrong (§C-B).

3. **Both CLAUDE.md and AGENTS.md say Webpack** — the block's KD1 is right that both are wrong, and code (`package.json` `vite`, no webpack dep/config) confirms Vite. Adding: the nested `openmetadata-ui-core-components/CLAUDE.md:9` already states Vite correctly, so the repo is internally split, not uniformly stale.

4. **Hook count confirmed but composition clarified.** `.claude/settings.json` has exactly **12** hooks (2 blocking `PreToolUse` on `Bash`, 10 advisory `PostToolUse`). Note the second blocking `PreToolUse` (antd) uses matcher **`"Bash"`**, so it cannot fire on `Edit`/`Write` — it is effectively inert for the normal file-writing path (§W2).

5. **`.claude/settings.local.json` exists** (not mentioned in the block) — it is **permissions-only** (`allow` list + MCP toggles), `"deny": []`, **no hooks**. It adds no path guard over generated output.

6. **The connector-scaffolding skill has a name mismatch** the block didn't flag: directory `connector-building`, frontmatter `name: scaffold-connector`, referenced as both `/connector-building` and `/scaffold-connector` (§C-F / §DR-C).

7. **`skills/hooks/hooks.json` is a diverged subset+SessionStart of `.claude/settings.json`**, not a copy — notably it carries a `SessionStart` hook (loads `openmetadata-workflow/SKILL.md`) that `.claude/settings.json` lacks, and a shorter `make generate` message (§Dup-3). Whether the `openmetadata-workflow` "loaded at session start" claim (`DEVELOPER.md:113`, `openmetadata-workflow/SKILL.md:8`) holds depends on the plugin's `hooks.json` being active — it is **not** in `.claude/settings.json`.

8. **Two more skill-name/registration mismatches beyond the connector one** (block listed none): the Playwright test-gen skill self-names `playwright-test` but registers as `playwright` (§C-G / §DR-D), and `skills/commands/test-locally.md` is a second full copy of the `test-locally` SKILL with a conflicting flag surface (§Dup-10), not a launcher like the other command files.

9. **A runtime-breaking dead reference the block did not surface:** `.claude/skills/playwright-validation/SKILL.md` calls MCP tools under the non-existent `mcp__playwright__*` namespace; the live server is `mcp__playwright-test__*` (§DR-E). This is the only reference in the corpus that would fail *at tool-call time*, not just at doc-read time.

10. **"Almost no true dead file/target references."** Every `make` target, `yarn` script, and file/dir path referenced across all 19 instruction files was verified to exist (aided by the `Makefile:3` include, which makes ingestion targets resolve from root). The real defects are naming/registration mismatches, a stale MCP namespace, wrong tooling/counts, and command/SKILL divergence — not broken paths. The one path-context exception is `make generate` from `ingestion/` (§DR-A).

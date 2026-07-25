# Promotion List — which lints are now safe to make BLOCKING

**This changes what blocks other contributors' PRs. It is a human decision.** Every row is keyed to a
**measured adherence number from `08b-adherence.md`**, not to how important the rule sounds.

**Rule applied:** promote to blocking only at **≥ ~95% adherence** with small/zero cleanup. Under ~95%
stays a **warning**. **08d hazards block regardless of adherence** (a hazard is unsafe at any rate).

## A. Promote to blocking now (≥95%, ungated today)

| Lint | 08b | Adherence | Cleanup first | Mechanism to add | Notes |
|---|---|---|---|---|---|
| No wildcard imports | J1 | **98.8%** (21 files, 29 stmts) | fix 21 files | checkstyle `AvoidStarImport` (spotless/GJF does **not** catch it) | violations are in files edited this month → will regress without a gate |
| No bare `except:` | P3 | **99.95%** (1 file) | fix 1 file (`hive/custom_hive_connection.py:181`) | enable ruff **`E722`** in `ingestion/pyproject.toml` | cheapest promotion in the repo |
| Functional components only | F4 | **100%** (0) | none | eslint `no-restricted-syntax` on `extends (React.)?Component` | 0-cleanup, 0-risk |
| Connector `service_spec.py` present | P6 | **100%** (96/96) | none (whitelist `query`, `dbt`) | a structural CI check per connector dir | enforces Golden Principle #2 |
| Parameterized logging | J3 | **100%** (0/5,989) | none | checkstyle/`grep` gate on concatenated `LOG.x("…" + …)` | Golden Principle #8; lowest cost — optional |

## B. Stay a WARNING (under ~95%, or not cleanly measurable)

| Lint | 08b | Adherence | Why it stays a warning |
|---|---|---|---|
| No `any` | F2 | **90.2%** (461 files) | under 95%, and actively re-introduced; **exclude `generated/` and re-measure** before revisiting |
| Broad-except must log/re-raise | P5 | **94.5%** (~86 silent) | just under 95%; the ~86 silent swallows need per-site judgment, not a blanket block |
| `.component.tsx` naming | F5 | **36.4%** (proxy) | proxy over-counts; not a real violation count |
| Wrap JSX strings in `t()` | F6 | not measurable | needs an AST tool (eslint `i18next/no-literal-string`); no trustworthy count |
| Non-en locale translation | F8 | **~90–94%** | under 95%, and some identity is legitimate (acronyms/product names) — not a clean lint |
| Comments explain *why* | X1 | impressionistic | unmeasurable |
| 90% test coverage | X2 | ungated, unmeasured | **no jacoco rule / no Jest `coverageThreshold` / no `fail_under`** — can't promote a number nobody measures in-repo |

## C. Never promote (measured against)

| Lint | 08b | Adherence | Verdict |
|---|---|---|---|
| Avoid broad `except Exception` | P4 | **24.5%** | **DROP** — 75.5% of Python handlers are broad *by design*; a ban would fail everywhere |
| Avoid Ant Design (blanket) | F1 | **81.7%** antd-free | **DOCUMENT** — 864 files, migration stalled; a blanket block breaks legit legacy edits (see 04 §antd) |

## D. Already blocking (no promotion needed)
J2 spotless, P1 ruff (`py_format_check`), F3 no-console, F7 UI license header — all CI-gated and green
(08b). The pre-commit additions in `04-enforcement.md` also now gate UI prettier + new-file UI license
locally.

## E. Block REGARDLESS of adherence — 08d hazards

Hazards are unsafe at *any* adherence rate; these do not wait for a 95% threshold.

| Hazard | 08d | Status |
|---|---|---|
| Editing **generated output** | §3 | **DONE** — `PreToolUse` blocker (04 §generated) |
| Editing **`.github/workflows/**`** without authorization | §5 (CI-agent surface) | **DONE** — `PreToolUse` blocker (04 §workflow) |
| **Committing a secret** | §4 | **GAP** — no gitleaks/trufflehog in CI, no `*.pem/*.key/*.p12` gitignore rule → add a secret scanner + ignore rules |
| **Editing an applied migration** (append-only) | §2 | **GAP** — nothing enforces it (no CI check, no runtime checksum-abort) → add a CI check blocking edits to already-shipped `bootstrap/sql/migrations/**` files |

> Items E-secret and E-migration require **CI-workflow edits**, which are themselves now gated — apply
> them with explicit authorization (`CLAUDE_ALLOW_WORKFLOW_EDITS=1`) or by a maintainer.

## Cleanup budget to unlock Section A
- J1: 21 Java files (mechanical — replace `import x.*;` with explicit imports).
- P3: 1 Python file.
- F4, P6, J3: **zero** files. → three of the five promotions are free today.

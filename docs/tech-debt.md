# Tech Debt Ledger

Findings from a one-time repository audit worth fixing. **Ordered by impact ÷ size** (biggest payoff
per unit of effort first) — so small fixes that unblock a golden principle or close a hazard rank above
large architectural refactors.

**Agent?** = can an agent fix it *unsupervised* (mechanical, verifiable) vs. supervised (needs
judgment/review) vs. no (human/native-speaker/architectural).

## Tier 1 — Quick wins (high impact, tiny size) — do first

| # | Finding | Location | Why it matters | Size | Agent? |
|---|---|---|---|---|---|
| 1 | 1 file with a bare `except:` | `ingestion/.../database/hive/custom_hive_connection.py:181` | The only blocker to gating ruff `E722` (Golden Principle #5) | 1 line | **unsupervised** |
| 2 | 3 hand-written UI files missing the Apache header | `LineageTable.interface.ts`, `mocks/rests/applicationAPI.mock.ts`, `EntityLineage/.../LineageLayers.interface.ts` | Trips the license gate; `yarn license-header-fix` fixes it | trivial | **unsupervised** |
| 3 | 21 Java files with wildcard imports | `attachments/AzureAssetService.java` (3), `PersonaResource.java`, `StoredProcedureResource.java`, … | Unblocks making no-wildcard blocking; violations are in files edited *this month* (will regress) | ~21 files, mechanical | **unsupervised** |
| 4 | POM hygiene: duplicate deps + declared-order inversion | `openmetadata-spec/pom.xml` (declares `common` twice), `openmetadata-dist/pom.xml` (declares `openmetadata-ui` twice); `<modules>` lists `spec` before its dep `common` | Minor, but `spec→common` contradicts the "foundation is first" reading of the reactor list | tiny | **unsupervised** |
| 5 | Stale MCP namespace in a skill | `.claude/skills/playwright-validation/SKILL.md:59,63,67,68` — `mcp__playwright__*` (real server is `mcp__playwright-test__*`) | The only reference that fails **at tool-call time**, not just read time | 4 lines | **unsupervised** |
| 6 | `AGENTS.md` still carries contradictions corrected in CLAUDE.md | `AGENTS.md:12` (Webpack→Vite), `:105/:223` (use Ant Design), `:13` (Python 3.10-3.12) | CLAUDE.md was fixed; AGENTS.md (Codex's entry doc) still misleads | small doc edit | **unsupervised** |
| 7 | `openmetadata-shaded-deps` has no "do not edit" marker | module has only POMs + a build artifact; not in any instruction doc | An agent "upgrading" it breaks the `es.*`/`os.*` relocation → cascading compile failures | 1 rule/note | **unsupervised** |

## Tier 2 — Medium (real value, bounded but not trivial)

| # | Finding | Location | Why it matters | Size | Agent? |
|---|---|---|---|---|---|
| 8 | No secret scanner + no key-extension gitignore | CI (`.github/workflows`), `.gitignore` | Nothing catches a committed secret; fixture dirs are Snyk-excluded — an agent could commit a real key undetected | medium | **supervised** (workflow edit needs auth) |
| 9 | Migration append-only is unenforced | `bootstrap/sql/migrations/**`; no CI check, no runtime checksum-abort | Editing an applied migration silently no-ops on existing DBs / drifts on fresh installs, with no error | medium | **supervised** (workflow edit needs auth) |
| 10 | CodeQL runs on `workflow_dispatch` only | `.github/workflows/codeql.yml` | SAST does not run on PRs — a whole class of checks never gates contributions | small config | **supervised** (workflow edit needs auth) |
| 11 | ~86 broad-excepts that silently swallow | `ingestion/src/metadata/**` (the ~5.5% with no log/re-raise) | The genuinely risky subset of the (sanctioned) broad-except idiom | ~86 sites, per-site judgment | **supervised** |
| 12 | `mssql ↔ azuresql` circular sibling import | `database/mssql/connection.py:44` ↔ `database/azuresql/connection.py` | The one connector import cycle; the rest are clean (`timescale→postgres` is legit subclassing) | small | **supervised** |
| 13 | `any` outside `generated/` | 461 files (top-5 are generated) | Erodes type safety; blocked from becoming a blocking lint until `generated/` is excluded and re-measured | large but incremental | **supervised** |
| 14 | basedpyright baseline of 11,927 findings | `.basedpyright/baseline.json` (926 files) | The ratchet holds (no new errors) but the debt is large; each burn-down shrinks it | very large, incremental | **supervised** |

## Tier 3 — Large / architectural (high impact, large size) — plan, don't rush

| # | Finding | Location | Why it matters | Size | Agent? |
|---|---|---|---|---|---|
| 15 | Java package cycles: `resources ↔ jdbi3` (130/99), 18/21 pairs cyclic | `openmetadata-service/src/main/java/org/openmetadata/service/**` | The repo's **own** #1 principle (acyclic layering) is violated *inside* the core backend; much is misplaced value types (`resources.feeds.MessageParser.EntityLink`) that belong in a shared package | large refactor | **no** (architectural) |
| 16 | Frontend `components ↔ utils` cycle (130-module SCC) | `openmetadata-ui/.../src` (28 cyclic SCCs, 50 direct 2-cycles) | No import-boundary tooling; barrel/`*.interface.ts` mutual references + `utils` importing components | large | **no** (architectural) |
| 17 | Generated-type leakage: 1,292 direct importers vs 93 in `rest/` | `openmetadata-ui/.../src/components`,`pages` | No anti-corruption layer; the stricter form of Golden Principle #3 sits at ~7% | large | **no** (architectural) |
| 18 | Ant Design migration stalled | 864 UI files (18.3%), 68.5% edited ≤90d | The stated "use ui-core-components" direction isn't progressing; can't be a blocking rule until it does | very large, ongoing | **no** (program of work) |
| 19 | ~250–396 untranslated English strings per non-en locale × 19 | `openmetadata-ui/.../src/locale/languages/*.json` | Reviewable defect CLAUDE.md flags; CI checks key-sync, not translation | large | **no** (native speakers) |
| 20 | `py-tests` required check ≈ 69 min work-median | CI | The dominant PR wall-clock (ranked #1 by cost in the CI run-history analysis); a candidate for sharding/scoping | large CI work | **supervised** |
| 21 | `playwright-postgresql-e2e` 82% pass (least-reliable required check) | CI | The required check most likely to fail for non-code reasons; re-run flakiness is ~0-measurable (fixed by new commits), so it hides as a low pass rate | investigation | **no** |

## Conflicts surfaced (not resolved here)
- **"Lint-clean" ≠ "well-layered."** `openmetadata-service` is 100% on spotless/logging and ~99% on
  wildcard imports, yet is the **most** internally tangled module (18/21 cyclic package pairs). The two
  signals disagree about the module's health — see `quality.md`.
- **Generated is model citizen and worst offender at once.** #3 (pure sink, 100%) and #17 (leakage,
  ~7%) are about the same `generated/` tree from opposite directions. Fixing #17 is a large refactor;
  #3 is already true. Don't let "#3 holds" imply the generated boundary is clean.
- **Broad-except: Python idiom vs Java ban.** #11 (fix silent swallows) must not become "ban broad
  except" — that idiom is 75.5% of Python handlers, by design.

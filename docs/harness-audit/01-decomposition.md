# CLAUDE.md Decomposition — old → new mapping

Split the 591-line CLAUDE.md three ways so a Java session never loads React guidance and vice versa:
- **new CLAUDE.md** — always-loaded orientation + hard cross-cutting constraints + pointer index.
- **`.claude/rules/*.md`** — path-scoped constraint sets (auto-load only on matching files).
- **skills** — procedures (load on invoke); duplicated sections were deleted and now point at the skill.

Nothing was dropped — everything moved (contradictions were corrected, not silently; see below).

## Line counts

| | Lines |
|---|---|
| CLAUDE.md **before** (always-loaded) | **591** |
| CLAUDE.md **after** (always-loaded) | **136** |
| Reduction in always-loaded | **−455 (−77%)** |
| `.claude/rules/*.md` total (loaded per-path) | 454 (java 144, frontend-react 88, frontend-styling 52, python-ingestion 39, schema-first 34, i18n 28, component-library 26, migrations 24, frontend-playwright 19) |

A Java-only session now loads **136 (CLAUDE.md) + 144 (java.md) = 280** lines instead of 591, and none
of the ~230 lines of frontend guidance. A UI-only session loads CLAUDE.md + the frontend rules that
match, and none of the Java block.

## Old → new mapping (every original line range)

| Orig lines | Section | New home |
|---|---|---|
| 1–3 | Title / intro | CLAUDE.md header (rewritten as the map) |
| 5–9 | About OpenMetadata | CLAUDE.md · About |
| 11–18 | Architecture Overview | CLAUDE.md · Stack at a glance **[corrected: 14 Webpack→Vite; 15/24 Python ceiling]** |
| 20–35 | Python venv (REQUIRED) | CLAUDE.md · Environment setup |
| 37–39 | Worktree venv note | CLAUDE.md · Environment setup |
| 41–60 | Initial Dev Env Setup | CLAUDE.md · Environment setup **[corrected: make generate is root-only]** |
| 62–69 | Other Env Notes (Java/yarn/docker) | CLAUDE.md · Environment setup |
| 71–80 | Prerequisites and Setup | CLAUDE.md · Environment setup |
| 82–93 | Frontend Development cmds | `frontend-react.md` · Commands (+ `ui-checkstyle` skill) |
| 95–106 | Frontend CI Checkstyle cmds | **`ui-checkstyle` skill** (procedure) + `frontend-react.md` **[103 "17 locale"→`i18n.md`, corrected]** |
| 108–115 | Backend Development cmds | `java.md` · Commands |
| 117–126 | Python Ingestion Development cmds | `python-ingestion.md` · Formatting & checks |
| 128–133 | Full Local Environment | **`test-locally` skill** (deleted here; pointer in CLAUDE.md index) |
| 135–140 | Testing cmds | **`test-enforcement`/`verification` skills** + per-rule command notes |
| 142–156 | Backend Integration Tests | `java.md` · Testing + Commands (+ `test-enforcement` skill) |
| 158–167 | Code Generation and Schemas | `schema-first.md` **[corrected: make generate root-only]** |
| 169–173 | Schema Architecture | `schema-first.md` |
| 175–183 | Key Directories | CLAUDE.md · Repository layout |
| 185–191 | Development Workflow | CLAUDE.md · pointer index (+ `openmetadata-workflow`/`planning`/`tdd` skills) |
| 193–194 | Frontend Arch Patterns (header) | dropped header; content relocated below |
| 195–207 | React Component Patterns | `frontend-react.md` **[201 i18n → `i18n.md`]** |
| 209–212 | State Management | `frontend-react.md` |
| 214–216 | Forms | `frontend-react.md` · Forms (216 antd-getField also flagged in `component-library.md`) |
| 218–235 | Styling | **split:** 220/221/231 → `component-library.md`; 222–230/234/235 → `frontend-styling.md`; **233 (Java wildcards) → `java.md`**; 232 (spacing) → CLAUDE.md · Output style |
| 237–268 | Design system tokens & specs | `frontend-styling.md` |
| 270–272 | UI considerations (no string literals) | `i18n.md` |
| 275–278 | Application Configuration | `frontend-react.md` |
| 280–283 | Service Utilities | `frontend-react.md` |
| 285–289 | Type Safety | `frontend-react.md` |
| 291–296 | Database and Migrations | `migrations.md` |
| 298–303 | Security and Authentication | CLAUDE.md · Cross-cutting (Secrets & security) |
| 305–306 | Code Generation Standards (header) | dropped header |
| 307–320 | Comments Policy | CLAUDE.md · Cross-cutting (Comments) |
| 322–331 | Java Code Requirements (spotless) | `java.md` · Formatting (+ `java-checkstyle` skill) |
| 333–389 | Method Size & Complexity | `java.md` |
| 391–397 | Naming and Readability | `java.md` |
| 399–404 | Immutability | `java.md` |
| 406–412 | Error Handling | `java.md` |
| 414–428 | No Magic Strings | `java.md` |
| 430–449 | No Convoluted if/else | `java.md` |
| 451–454 | No Code Duplication | `java.md` |
| 456–460 | Class Size | `java.md` |
| 462–482 | Modern Java (21) | `java.md` |
| 484–492 | Common Bug Patterns | `java.md` |
| 494–499 | Testing (Java) | `java.md` · Testing (+ `test-enforcement` skill) |
| 501–506 | Structure | `java.md` |
| 508–520 | TypeScript/Frontend Code Req | `frontend-react.md` (constraints) + **`ui-checkstyle` skill** (procedure) **[514 job names corrected]** |
| 522–531 | No `any`, import organization | `frontend-react.md` |
| 533–547 | CI Checkstyle Rules | `frontend-react.md` (code-rules); **544 JSON-keys + 546 i18n → `i18n.md`**; 545 license → CLAUDE.md cross-cutting + `frontend-react.md` |
| 549–555 | Playwright Test Rules | `frontend-playwright.md` (+ `playwright`/`writing-playwright-tests` skills) |
| 557–564 | Python Code Requirements | `python-ingestion.md` · Test style |
| 566–570 | Python Ingestion Connector Guidelines | `python-ingestion.md` · Connector guidelines (+ `connector-standards` skill) |
| 572–578 | Caching | CLAUDE.md · Cross-cutting (Caching) |
| 580–586 | Testing Philosophy | CLAUDE.md · Cross-cutting (Testing philosophy) |
| 588–591 | Response Format | CLAUDE.md · Output style (line 232 folded in here) |

## Contradictions resolved (not silently) — code-supported version used, with a note in-file

| Was (old CLAUDE.md) | Now | Where noted | Audit finding |
|---|---|---|---|
| L14 "built with **Webpack**" | **Vite** (`package.json` `vite`, no webpack) | CLAUDE.md · Stack | 00-findings §KD1 |
| L15/L24 "Python **3.10-3.11**" | `>=3.10`, **no pinned ceiling**, CI runs 3.10 | CLAUDE.md · Stack | 00-findings §KD3 |
| L103 "Sync all **17** locale files" | **19** non-English (**20** total) | `i18n.md` note | 00-findings §C-B |
| L56/L120 "`cd ingestion` … `make generate`" | `make generate` is **root-only** | CLAUDE.md · Env + `schema-first.md` note | 00-findings §DR-A |
| L514 "**three** jobs `lint-src`/`lint-playwright`/`lint-core-components`" | one `checkstyle` job, **six** gated steps | `frontend-react.md` note | 00-findings §C-E |

The AGENTS.md "use Ant Design" contradiction is not in CLAUDE.md (which already said "never Ant
Design"), but `component-library.md` records it and states the code-supported rule.

## Removed as stale → for the PR description

**Nothing substantive was dropped.** The only removals are the five **incorrect claims** above, each
replaced by the code-supported value with an in-file note and audit citation (list them under
"Removed as stale" in the PR description, citing the finding IDs). Two verbatim phrasings were lightly
reworded on relocation, preserving intent:
- L232 "Do not add unnecessary spacing between logs and code" → CLAUDE.md Output style: "Do not add
  unnecessary blank lines between prose and code blocks."
- L324–331 spotless *procedure* → replaced by a pointer to the `java-checkstyle` skill (the constraint
  "always run spotless / CI fails otherwise" is preserved in `java.md`).

## Part C — procedures → skills (no new skill created)

Every procedural section mapped to an **existing** skill; per the constraint, no new skill was created
and no skill content was edited (only CLAUDE.md/rules point at them):

| Old procedural content | Existing skill it now points to |
|---|---|
| Frontend CI checkstyle sequence (95–106, 508–520) | `ui-checkstyle` |
| Java spotless procedure (322–331) | `java-checkstyle` |
| Full local Docker stack (128–133) | `test-locally` |
| Coverage / IT enforcement (135–140, 494–499) | `test-enforcement`, `verification` |
| Connector build/review (566–570) | `connector-standards`, `connector-building`, `connector-review` |
| Playwright authoring (549–555) | `playwright`, `writing-playwright-tests`, `playwright-validation` |
| High-level task routing (185–191) | `openmetadata-workflow`, `planning`, `tdd`, `systematic-debugging`, `code-review` |

## Verification
- New CLAUDE.md = **136 lines** (< 200 target); all cross-cutting constraints (secrets, caching,
  comments, testing philosophy, license header, schema-first meta, output style) preserved in full.
- 9 rule files created, each with `paths:` frontmatter and a real compliant example path.
- Every original line 1–591 has a row above.

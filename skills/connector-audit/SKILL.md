---
name: connector-audit
description: Deep reliability audit for OpenMetadata connectors — runs 7 investigation prompts (metadata, errors, auth, lineage, scale, synthesis, implementation) against connector standards
---

# OpenMetadata Connector Reliability Audit

## When to Activate

When a user asks to audit a connector, run a reliability audit, or investigate connector quality in depth.

## STEP 1 — DO THIS FIRST, BEFORE ANYTHING ELSE

When this skill is invoked, your VERY FIRST action — before responding to the user, before summarizing anything, before checking any state — is:

1. List all files in `.claude/audit-results/` (if the directory exists)
2. List `.claude/connector-audit.json` (if it exists)
3. Present the file list to the user and ask: *"These files exist from a previous audit. Which should I keep and which should I delete?"*
4. Wait for the user's answer. Do NOT proceed until they respond.

If no files exist, skip to Step 2.

**NEVER** summarize existing results, say "the audit is complete", or suggest the user doesn't need to run anything. The user invoked the skill — execute it.

## Arguments

- **Connector name** (e.g., `mysql`, `snowflake`, `tableau`): Full 7-prompt audit
- **`--prompt N`** (e.g., `--prompt 3`): Run a single prompt (1-7) — useful for re-running after fixes
- **`--prompts N,M`** (e.g., `--prompts 1,4`): Run specific prompts only
- **`--from N`** (e.g., `--from 6`): Run prompts N through 7 — useful for continuing after P1-P5
- **`--setup-only`**: Run setup only (writes connector-audit.json)
- **`--dry-run`**: When used with P7, produce a detailed implementation plan (before/after diffs, tests, risk flags) without actually writing code — for review before execution

## Relationship to connector-review

| | connector-audit | connector-review |
|---|---|---|
| **Purpose** | Deep reliability investigation | Breadth check for PRs |
| **Depth** | 7 focused prompts, hours of analysis | 5 parallel agents, minutes |
| **Output** | `.claude/audit-results/` (7 reports) | PR comment or local report |
| **When** | Before major work on a connector | During PR review |
| **Scope** | Full connector + base classes + shared code | Changed files only |

## Workflow Overview

```
Setup → P1-P5 (investigation, parallelizable) → P6 (synthesis) → P7 (implementation)
```

### Phase 1: Setup

After the stale results check (Step 1 above), run the setup prompt to establish connector context. This writes `.claude/connector-audit.json` which all subsequent prompts read.

### Phase 2: Static Pre-Check

Run the static analyzer from the connector-review skill to get a mechanical baseline:
```bash
python skills/connector-review/scripts/analyze_connector.py {service_type} {name} --json
```
Save the output — prompts reference it to avoid duplicating mechanical checks.

### Phase 3: Investigation (P1-P5)

These 5 prompts are **independent** and can run in any order. For efficiency, dispatch them in parallel:
- **Pair A**: P1 (Metadata & Ingestion) + P2 (Error Handling)
- **Pair B**: P3 (Connection & Auth) + P4 (Lineage)
- **Solo**: P5 (Scale & Performance)

Each prompt:
1. Reads `.claude/connector-audit.json` for context
2. Loads connector standards via `/connector-standards`
3. Investigates its focus area in depth
4. Presents a summary for user review
5. Saves its report under `.claude/audit-results/` using the fixed filename for that prompt described in the **Output Structure** section (for example, `01-metadata-ingestion.md` for P1) after user approval

**User review gate**: Each prompt presents findings and asks for confirmation before saving. This catches errors early instead of propagating them to P6.

### Phase 4: Synthesis (P6)

Reads all 5 reports from `.claude/audit-results/`, cross-validates findings, clusters root causes, checks git history, and produces a prioritized implementation plan with PR scoping.

### Phase 5: Implementation (P7)

Reads the P6 plan and implements the fixes — writes code, runs tests, creates commits. With `--dry-run`, produces a detailed plan (before/after diffs, test code, risk flags) without writing code.

## Prompt Files

Each prompt is a self-contained investigation guide in `prompts/`:

| # | File | Focus | Standards |
|---|---|---|---|
| 0 | `00-setup.md` | Set target connector, write context file | — |
| 1 | `01-metadata-ingestion.md` | Metadata coverage by tier, ingestion completeness | Tiers 1-3, Standard 1 |
| 2 | `02-error-handling.md` | Error handling, fault tolerance, observability | Standards 4, 5, 7 |
| 3 | `03-connection-auth.md` | Auth methods, test connection, SSL/TLS | Standard 3 |
| 4 | `04-lineage.md` | SQL dialect, FQN resolution, column lineage | Standard 2 |
| 5 | `05-scale-performance.md` | Memory patterns, pagination, generators, lookups | Standard 6 |
| 6 | `06-refactor-plan.md` | Cross-validate, cluster root causes, PR scoping | All standards |
| 7 | `07-implementation.md` | Implement fixes (or `--dry-run` for plan only) | All standards |

## How to Run

### Full Audit

```
/connector-audit mysql
```

1. **Stale results check**: List existing files in `.claude/audit-results/`, ask user what to keep/delete, wait for answer
2. **Setup**: Ask user for connector name (if not provided), find source directory, write `.claude/connector-audit.json`
3. **Static pre-check**: Run `analyze_connector.py` for mechanical baseline
4. **P1-P5**: For each prompt:
   a. Read the prompt file from `prompts/0N-*.md`
   b. Follow its instructions — read the actual connector source code, analyze it against the standards, produce findings with file:line references
   c. Present a summary to the user for review
   d. Save the report to `.claude/audit-results/` after user approval
5. **P6**: Read all reports from `.claude/audit-results/`, synthesize, present implementation plan, save after approval
6. **P7**: Read P6 plan, implement fixes (or `--dry-run` for plan only), save after approval

Each prompt is a detailed investigation guide — it tells you exactly which files to read, what to look for, how to rate findings, and what format to present them in. You must actually read the connector's source code and do the analysis, not summarize previous results.

### Single Prompt

```
/connector-audit mysql --prompt 3
```

Verify `.claude/connector-audit.json` exists, then read the prompt file and execute only that investigation.

### Parallel Dispatch

When running the full audit, dispatch P1-P5 using Agent subagents for parallelism:
- Each agent gets: the prompt content, connector-audit.json values, and the static analyzer output
- Each agent saves its report independently
- P6 runs only after all 5 reports exist

**Important**: Each agent must present its summary and get user approval before saving. When running in parallel pairs, present both summaries together.

## Standards Reference

All prompts reference connector standards loaded via `/connector-standards`. The standards live at:
- `skills/connector-review/standards/` — shared standards (main.md, patterns.md, etc.)
- `skills/connector-review/standards/source_types/` — per-service-type standards

The static analyzer at `skills/connector-review/scripts/analyze_connector.py` provides mechanical checks that complement the deeper investigation in each prompt.

## Output Structure

```
.claude/
├── connector-audit.json          # Connector context (written by Setup)
└── audit-results/
    ├── 01-metadata-ingestion.md  # P1 report
    ├── 02-error-handling.md      # P2 report
    ├── 03-connection-auth.md     # P3 report
    ├── 04-lineage.md             # P4 report
    ├── 05-scale-performance.md   # P5 report
    ├── 06-refactor-plan.md       # P6 consolidated plan
    └── 07-implementation.md      # P7 implementation report (or 07-dry-run-implementation.md with --dry-run)
```

## Report Template

Each prompt report follows the template in `templates/audit-report.md`. Key sections:
- Header with connector name, prompt number, standards assessed, and rating
- Findings with file:line references and severity
- Rating calibration evidence
- Present & Validate summary for user review


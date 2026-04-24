# Prompt 6: Refactor Assessment

Consolidate findings from all parallel audits, cluster root causes, and produce a prioritized implementation plan.

---

**Context:** Read `.claude/connector-audit.json` for the connector name, service type, and source path. Use these for [CONNECTOR_NAME] and [SERVICE_TYPE] throughout.

Consolidate all audit results for this connector and decide the implementation approach.

## Input: Audit Results

Read **all `.md` files** from `.claude/audit-results/` (excluding any previous `06-refactor-plan.md` or `07-*.md`). The core prompts produce files `01` through `05`, but additional reports may exist from standalone prompts run outside the skill. Include every report found.

List the files you found and their focus area before proceeding.

For each finding across all reports, capture: what's wrong, where (file:line), severity (❌/⚠️), which standard it violates, and **which Metadata Tier (1/2/3) it affects** — Tier 1 gaps are critical, Tier 3 gaps can wait.

## Analysis

### 0. Cross-Prompt Validation

Before clustering, scan ALL reports for **contradictions**:
- Does one report list a feature as working while another found it broken? (e.g., SSL found unwired in connection audit but assumed working in scale audit)
- Do two reports give conflicting severity ratings for the same code path?
- Flag and resolve contradictions before proceeding.

**File coverage check**: List every file in the connector directory. For each file, verify that at least one prompt analyzed it substantively. If a connector-specific file was only mentioned in passing or not covered by any prompt, flag the gap — it may contain issues no prompt caught.

### 1. Root Cause Clustering

Group issues that share a common root cause. Ask:
- Do multiple findings trace back to the same code pattern? (e.g., missing Either pattern in 10 places = 1 root cause)
- Are issues caused by a wrong architectural choice? (e.g., wrong base class, missing mixin)
- Could a single shared-code change fix issues across this connector AND others?

### 2. Git History Check

Before proposing refactors, check:
- `git log --oneline -20 -- ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/`
- Is this connector actively being modified? By whom?
- Are there open PRs touching the same files? (check with `gh pr list`)
- Avoid refactoring code that's in active development — coordinate or wait.

### 3. Classify Each Finding

For each issue (or issue cluster), classify using this decision framework:

| Situation | Approach | Risk |
|-----------|----------|------|
| Bug in one connector, clean code around it | **Fix in place** | Low |
| Same bug in 3+ connectors | **Fix in shared base class** | Medium — needs broader testing |
| Code works but is hard to follow | **Refactor only if touching it anyway** | Low if isolated |
| Connector duplicates logic from another connector | **Extract shared logic, then fix** | Medium |
| Wrong base class or missing mixin | **Refactor first, then address standards** | High — architectural change |
| Missing feature identified during audit | **New feature** — scope separately | Varies |

### 4. Effort & Risk Estimation

For each classified item, estimate:
- **Effort**: S (< 1 hour), M (1-4 hours), L (4+ hours)
- **Risk**: Low (isolated to this connector), Medium (touches shared code), High (architectural change)
- **Testing**: What tests need to run? (unit only, integration, manual verification)

### 5. PR Scoping

Decide how to split work into PRs:
- **One PR per concern** — don't mix bug fixes with refactors, don't mix connector-specific with shared changes
- **Shared code changes first** — if a base class fix resolves issues in multiple connectors, do that PR first
- **Order by dependency** — if fix B depends on refactor A, refactor A goes first

## Output

Present as:
1. **Consolidated findings table**: | # | Finding | Severity | Standard | Tier | File:Line | Root Cause Cluster |
2. **Source system constraints**: List items rated N/A across any audit because the source system cannot provide the data — these are not bugs and should not appear in the implementation plan
3. **Implementation plan**: Ordered list of work items, each with: approach (fix/extract/refactor/new), effort, risk, PR scope, testing strategy
4. **Recommended PR sequence**: Which PRs to create and in what order
5. **Deferred items**: Anything that should be tracked but not fixed now (with reason)

## Present & Validate

Before saving, present a summary to the user for review:
1. **Cross-prompt contradictions** — any contradictions found and how you resolved them
2. **Findings count** — total findings, how many HIGH/MEDIUM/LOW, how many root cause clusters
3. **Recommended PR sequence** — the PR list with effort and risk per PR
4. **Source system constraints** — items rated N/A (confirming these are NOT in the implementation plan)
5. **Deferred items** — what you're recommending to skip and why

Then ask: *"Ready to save to `.claude/audit-results/06-refactor-plan.md`? Any changes to the plan?"*

If the user requests changes (e.g., different PR grouping, different severity, items to add/remove), revise and re-present. Once the user confirms, **save the full plan** to `.claude/audit-results/06-refactor-plan.md` — Prompt 7 reads this file.

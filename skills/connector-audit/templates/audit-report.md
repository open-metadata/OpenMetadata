# Audit {PROMPT_NUMBER} — {PROMPT_TITLE}: {CONNECTOR_NAME} Connector

**Connector**: {CONNECTOR_NAME}
**Service type**: {SERVICE_TYPE}
**Source path**: `ingestion/src/metadata/ingestion/source/{SERVICE_TYPE}/{CONNECTOR_NAME}/`
**Rating**: **{RATING}**

---

## 1. {FIRST_SECTION_TITLE}

<!-- Primary analysis section — varies by prompt -->
<!-- Use tables with file:line references for all findings -->

| # | Severity | Finding | File | Line(s) |
|---|----------|---------|------|---------|
| 1 | {HIGH/MEDIUM/LOW} | {Description} | `{file_path}` | {lines} |

---

## 2. {SECOND_SECTION_TITLE}

<!-- Secondary analysis section -->

---

## 3. Rating Justification

### Rating: {RATING}

**What works well**:
- {Positive finding with file:line reference}

**What needs fixing**:
- **{Issue}** — {description with file:line reference}

---

## 4. Issues Summary

| # | Severity | Issue | File | Line(s) |
|---|----------|-------|------|---------|
| 1 | HIGH | {Description} | `{file_path}` | {lines} |
| 2 | MEDIUM | {Description} | `{file_path}` | {lines} |

---

## 5. Recommended Fixes (Prioritized by Customer Impact)

### P0 — {Most critical fix}

{Description of the fix with code examples if helpful}

### P1 — {Next priority fix}

{Description}

---

## 6. Source System Constraints

<!-- Items rated N/A because the source system cannot provide the data -->
<!-- These are NOT connector bugs — they clarify what's impossible vs what's missing -->

- **{Metadata type}**: N/A — {reason the source system cannot provide this}

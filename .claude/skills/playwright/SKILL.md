---
name: playwright-test
description: Generate robust, zero-flakiness Playwright E2E tests following OpenMetadata patterns. Creates comprehensive test files with proper waits, API validation, multi-role permissions, and complete entity lifecycle management.
user-invocable: true
---

# Playwright Test Generator - OpenMetadata

Generate production-ready, zero-flakiness Playwright tests following OpenMetadata conventions.

## Usage

```
/playwright-test
Feature: <feature name>
Category: <Features|Pages|Flow|VersionPages>
Entity: <Table|Dashboard|Pipeline|Topic|Database|User|Team|Glossary|Other>
Domain: <Governance|Discovery|Platform|Observability|Integration>
Scenarios:
  - <scenario 1 description>
  - <scenario 2 description>
  - <scenario 3 description>
Roles: <admin|dataConsumer|dataSteward|owner> (optional, defaults to admin)
```

## Quick Example

```
/playwright-test
Feature: Data Quality Rules
Category: Features
Entity: Table
Domain: Observability
Scenarios:
  - Admin can create and configure data quality rules
  - Data consumer can view test results but not edit rules
  - Test results are persisted after page reload
Roles: admin, dataConsumer
```

---

## Instructions

### Step 1: Read the Handbook FIRST

**CRITICAL**: Before generating any tests, read and apply ALL patterns from:

```
openmetadata-ui/src/main/resources/ui/playwright/PLAYWRIGHT_DEVELOPER_HANDBOOK.md
```

The handbook contains:
- Testing philosophy (user-centric, behavior-focused)
- Anti-flakiness patterns (the :visible selector chain pattern, etc.)
- Test timeout strategies (test.slow() vs test.setTimeout())
- Common test patterns (form submission, dropdowns, multi-role testing)
- Locator priority guidelines
- Support classes reference
- Domain tags
- Validation checklist

**Apply ALL handbook principles before proceeding.**

---

### Step 2: Generate Test Using Handbook Template

Use the **Test File Structure Template** from the handbook. It includes:
- Proper imports (performAdminLogin, entity classes, utilities)
- test.describe with domain tags
- beforeAll/afterAll for entity lifecycle via API
- test.slow() for timeout handling
- test.step() for clear organization
- API response validation pattern

---

### Step 3: Apply Common Test Patterns from Handbook

Reference the **Common Test Patterns** section for:
- Form submission with API validation
- Dropdown selection (with :visible chain pattern)
- Multi-role permission testing
- Data persistence verification
- Navigation patterns
- Search and filter patterns

---

### Step 4: Validate Against Handbook Checklist

Before returning the generated test, verify ALL items from the handbook's **Validation Checklist**:

- ✅ Structure & Organization (test.step, domain tags, imports, beforeAll/afterAll)
- ✅ Anti-Flakiness (no waitForTimeout, no networkidle, no force: true, no positional selectors, no stored :visible locators)
- ✅ API & Network (waitForResponse before actions, status code validation)
- ✅ Waits & Assertions (waitForAllLoadersToDisappear, semantic locators, proper assertions)
- ✅ Coverage & Roles (multi-role tests, data persistence, error handling)

---

## Key Reminders

**All patterns, rules, and best practices are in the handbook.**

Read and apply the handbook sections in order:
1. **Anti-Flakiness Patterns** (CRITICAL - #1 cause of flaky tests)
2. **Test File Structure Template** (for proper test structure)
3. **Common Test Patterns** (for specific scenarios)
4. **Validation Checklist** (before returning generated test)

---

## Final Notes

- Generate **production-ready** tests that pass 10/10 times
- Follow ALL patterns from the handbook exactly
- No comments for obvious code (e.g., `// Create entity` before `entity.create()`)
- Test independence - each test runs in any order
- Reference examples: `playwright/e2e/Pages/DataContractInheritance.spec.ts`, `playwright/e2e/Features/Table.spec.ts`

**Generate tests that are production-ready, maintainable, and zero-flakiness by following the handbook patterns exactly.**

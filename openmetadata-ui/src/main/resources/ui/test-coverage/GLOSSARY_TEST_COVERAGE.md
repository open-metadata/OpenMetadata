# Glossary Feature - Playwright Test Coverage

This document provides a comprehensive overview of all Playwright E2E tests covering the Glossary feature in OpenMetadata.

---

## Summary

| Category | File | Tests |
|----------|------|-------|
| Core CRUD | Glossary.spec.ts | 38 |
| Form Validation | GlossaryFormValidation.spec.ts | 11 |
| Import/Export | GlossaryImportExport.spec.ts | 5 |
| Pagination & Search | GlossaryPagination.spec.ts | 7 |
| Performance | LargeGlossaryPerformance.spec.ts | 9 |
| Permissions | GlossaryPermissions.spec.ts | 7 |
| Version History | GlossaryVersionPage.spec.ts | 4 |
| Voting | GlossaryVoting.spec.ts | 7 |
| Navigation & Activity | GlossaryNavigation.spec.ts | 9 |
| Remove Operations | GlossaryRemoveOperations.spec.ts | 6 |
| Term Details | GlossaryTermDetails.spec.ts | 6 |
| Workflow | GlossaryWorkflow.spec.ts | 9 |
| Advanced Operations | GlossaryAdvancedOperations.spec.ts | 13 |
| Hierarchy | GlossaryHierarchy.spec.ts | 6 |
| Assets | GlossaryAssets.spec.ts | 6 |
| Tasks | GlossaryTasks.spec.ts | 3 |
| Misc Operations | GlossaryMiscOperations.spec.ts | 5 |
| **TOTAL** | **17 files** | **151 tests** |

---

## Test Files by Category

### 1. Core CRUD Operations
**File:** `playwright/e2e/Pages/Glossary.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | Glossary & terms creation for reviewer as user | G-C01, W-R01 |
| 2 | Glossary & terms creation for reviewer as team | W-R02 |
| 3 | Update Glossary and Glossary Term | G-U01, T-U01, T-U06, T-U09, T-U13, T-U16, T-U18, T-U20 |
| 4 | Add, Update and Verify Data Glossary Term | Term styling |
| 5 | Approve and reject glossary term from Glossary Listing | W-S03, W-S04 |
| 6 | Add and Remove Assets | A-A01, A-A02, A-A08 |
| 7 | Rename Glossary Term and verify assets | T-U03, T-U04, A-V07 |
| 8 | Drag and Drop Glossary Term | H-DD01, H-DD02, H-DD04 |
| 9 | Drag and Drop Glossary Term Approved Terms having reviewer | H-DD06 |
| 10 | Change glossary term hierarchy using menu options | H-M01 |
| 11 | Change glossary term hierarchy using menu options across glossary | H-M02 |
| 12 | Assign Glossary Term to entity and check assets | A-A04, A-A05, A-V01 |
| 13 | Request description task for Glossary | TK-01 |
| 14 | Request description task for Glossary Term | TK-02 |
| 15 | Request tags for Glossary | TK-03 |
| 16 | Delete Glossary and Glossary Term using Delete Modal | G-D01, G-D02, T-D01 |
| 17 | Verify Expand All For Nested Glossary Terms | H-N03, H-N04 |
| 18 | Column selection and visibility for Glossary Terms table | TBL-C01, TBL-C02, TBL-C03, TBL-C05 |
| 19 | Glossary Terms Table Status filtering | S-F01, S-F02 |
| 20 | Column dropdown drag-and-drop functionality for Glossary Terms table | TBL-C04 |
| 21 | Glossary Term Update in Glossary Page should persist tree | H-N05 |
| 22 | Add Glossary Term inside another Term | T-C03 |
| 23 | Check for duplicate Glossary Term | T-C08 |
| 24 | Verify Glossary Deny Permission | P-09 |
| 25 | Verify Glossary Term Deny Permission | P-10 |
| 26 | Glossary creation with domain selection | G-U11 |
| 27 | Create glossary, change language to Dutch, and delete glossary | G-D03 |
| 28 | should handle glossary after description is deleted | EC-01 |
| 29 | should handle glossary term after description is deleted | EC-02 |
| 30 | Create glossary with all optional fields (tags, owners, reviewers, domain) | G-C02 |
| 31 | Create glossary term via row action (+) button | T-C05 |
| 32 | Create term with synonyms during creation | T-C11 |
| 33 | Create term with references during creation | T-C12 |
| 34 | Create term with related terms, tags and owners during creation | T-C13, T-C14, T-C17 |
| 35 | Update glossary term display name via edit modal | T-U02 |
| 36 | Update glossary display name via rename modal | G-U02 |
| 37 | Cancel glossary delete operation | G-D04 |
| 38 | Cancel glossary term delete operation | T-D04 |

---

### 2. Form Validation
**File:** `playwright/e2e/Pages/GlossaryFormValidation.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should show error for empty glossary name | G-C05 |
| 2 | should show error for empty glossary description | G-C06 |
| 3 | should show error for glossary name exceeding max length | G-C07 |
| 4 | should show error for glossary name with special characters | G-C10 |
| 5 | should show error for duplicate glossary name | G-C08 |
| 6 | should allow cancel glossary creation | G-C09 |
| 7 | should show error for empty term name | T-C06 |
| 8 | should show error for empty term description | T-C07 |
| 9 | should show error for term name exceeding max length | T-C09 |
| 10 | should show error for term name with special characters | T-C19 |
| 11 | should allow cancel term creation | T-C10 |

---

### 3. Import/Export
**File:** `playwright/e2e/Pages/GlossaryImportExport.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | Glossary Bulk Import Export | IE-E01, IE-E02, IE-E03, IE-I01, IE-I02, IE-I03, IE-I07 |
| 2 | Check for Circular Reference in Glossary Import | IE-I04 |

---

### 4. Pagination & Search
**File:** `playwright/e2e/Features/GlossaryPagination.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should check for glossary term search | S-S01, S-S02, S-S05 |
| 2 | should check for nested glossary term search | S-S04 |
| 3 | should perform case-insensitive search | S-S03 |
| 4 | should show empty state when search returns no results | S-S07 |
| 5 | should filter by InReview status | S-F03 |
| 6 | should filter by multiple statuses | S-F04 |
| 7 | should clear status filter | S-F05 |

---

### 5. Large Glossary Performance
**File:** `playwright/e2e/Features/LargeGlossaryPerformance.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should handle large number of glossary terms with pagination | S-P01, S-P02, PF-01 |
| 2 | should search and filter glossary terms | PF-04 |
| 3 | should expand and collapse all terms | PF-03 |
| 4 | should expand individual terms | H-N01, H-N02 |
| 5 | should maintain scroll position when loading more terms | S-P03 |
| 6 | should handle status filtering | S-F01, S-F02 |
| 7 | should show term count in glossary listing | A-V01 |
| 8 | should handle drag and drop for term reordering | PF-05 |
| 9 | should handle large number of glossary child term with pagination | S-P04, PF-02 |

---

### 6. Permissions (RBAC)
**File:** `playwright/e2e/Features/Permissions/GlossaryPermissions.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | Glossary allow operations | P-01 |
| 2 | Glossary deny operations | P-02 |

---

### 7. Version History
**File:** `playwright/e2e/VersionPages/GlossaryVersionPage.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | Glossary | V-01, V-03, V-04, V-05, V-06 |
| 2 | GlossaryTerm | V-02, V-03, V-04, V-05, V-06 |

---

### 8. Voting
**File:** `playwright/e2e/Features/GlossaryVoting.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should upvote glossary | VT-01 |
| 2 | should downvote glossary | VT-02 |
| 3 | should change vote on glossary from upvote to downvote | VT-03 |
| 4 | should remove vote on glossary by clicking again | VT-04 |
| 5 | should upvote glossary term | VT-05 |
| 6 | should downvote glossary term | VT-06 |
| 7 | should persist vote after page reload | VT-07 |

---

### 9. Navigation & Activity Feed
**File:** `playwright/e2e/Features/GlossaryNavigation.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should navigate between tabs on glossary page | NAV-05 |
| 2 | should navigate between tabs on glossary term page | NAV-05 |
| 3 | should navigate via breadcrumbs | NAV-03 |
| 4 | should navigate to nested term via deep link | NAV-04 |
| 5 | should show empty state when glossary has no terms | UI-01 |
| 6 | should view activity feed on glossary | AF-01 |
| 7 | should view activity feed on glossary term | AF-02 |
| 8 | should post comment on glossary activity feed | AF-03 |
| 9 | should post comment on glossary term activity feed | AF-04 |

---

### 10. Remove Operations
**File:** `playwright/e2e/Features/GlossaryRemoveOperations.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should add and remove owner from glossary | G-U04 |
| 2 | should add and remove reviewer from glossary | G-U07 |
| 3 | should add and remove owner from glossary term | T-U19 |
| 4 | should add and remove reviewer from glossary term | T-U21 |
| 5 | should add and remove tags from glossary | G-U10 |
| 6 | should add and remove tags from glossary term | T-U17 |

---

### 11. Term Details Operations
**File:** `playwright/e2e/Features/GlossaryTermDetails.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should add and remove synonyms from glossary term | T-U07 |
| 2 | should add and remove references from glossary term | T-U12 |
| 3 | should add and remove related terms from glossary term | T-U14 |
| 4 | should verify bidirectional related term link | T-U15 |
| 5 | should edit term via pencil icon in table row | T-U26 |
| 6 | should create term with all optional fields populated | T-C02 |

---

### 12. Workflow (Approval & Hierarchy)
**File:** `playwright/e2e/Features/GlossaryWorkflow.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should start term as Approved when glossary has no reviewers | W-S01 |
| 2 | should start term as Draft when glossary has reviewers | W-S02 |
| 3 | should move term with children (subtree) via drag and drop | H-DD03 |
| 4 | non-reviewer should not see approve/reject buttons | W-R03 |
| 5 | should delete parent term and cascade delete children | T-D02 |
| 6 | should inherit reviewers from glossary when term is created | T-C18 |

---

### 13. Advanced Operations
**File:** `playwright/e2e/Features/GlossaryAdvancedOperations.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should create glossary with mutually exclusive toggle OFF | G-C04 |
| 2 | should create glossary with multiple owners (users + teams) | G-C12 |
| 3 | should create glossary with multiple reviewers (users + teams) | G-C13 |
| 4 | should replace owner on glossary | G-U05 |
| 5 | should replace reviewer on glossary | G-U08 |
| 6 | should remove domain from glossary | G-U12 |
| 7 | should change domain on glossary | G-U13 |
| 8 | should create term with custom style color | T-C15 |
| 9 | should create term with custom style icon URL | T-C16 |
| 10 | should update term style to set color | T-U22 |
| 11 | should update term style to set icon URL | T-U23 |
| 12 | should clear all synonyms from term | T-U08 |
| 13 | should edit reference name | T-U10 |
| 14 | should edit reference URL | T-U11 |

---

### 14. Hierarchy Operations
**File:** `playwright/e2e/Features/GlossaryHierarchy.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should move nested term to root level of same glossary | H-M03 |
| 2 | should move term to root of different glossary | H-M04 |
| 3 | should move term with children to different glossary | H-M05 |
| 4 | should cancel move operation | H-M06 |
| 5 | should navigate 5+ levels deep in hierarchy | H-N07 |
| 6 | should cancel drag and drop operation | H-DD05 |

---

### 15. Assets Operations
**File:** `playwright/e2e/Features/GlossaryAssets.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should add topic asset to glossary term | A-A06 |
| 2 | should add pipeline asset to glossary term | A-A07 |
| 3 | should open summary panel when clicking asset card | A-V03 |
| 4 | should search within assets tab | A-V04 |
| 5 | should remove asset from glossary term | A-R01 |
| 6 | should remove glossary term tag from entity page | A-R03 |

---

### 16. Tasks Operations
**File:** `playwright/e2e/Features/GlossaryTasks.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should reject description suggestion task | TK-05 |
| 2 | should reject tag suggestion task | TK-07 |
| 3 | should show task in notification bell | TK-08 |

---

### 17. Miscellaneous Operations
**File:** `playwright/e2e/Features/GlossaryMiscOperations.spec.ts`

| # | Test Name | Coverage ID |
|---|-----------|-------------|
| 1 | should delete glossary with tagged assets | G-D05 |
| 2 | should update child FQN when parent is renamed | T-U05 |
| 3 | should delete term with tagged assets | T-D03 |
| 4 | should not allow dragging term to itself | H-DD07 |
| 5 | should handle glossary load error gracefully | UI-03 |

---

## Coverage by Feature Area

### Glossary CRUD
- ✅ G-C01: Create glossary with required fields
- ✅ G-C02: Create glossary with all optional fields (tags, owners, reviewers, domain)
- ✅ G-C03: Create glossary with mutually exclusive toggle (covered in Add/Remove Assets)
- ✅ G-C04: Create glossary with mutually exclusive toggle OFF
- ✅ G-C05: Form validation - empty name
- ✅ G-C06: Form validation - empty description
- ✅ G-C07: Form validation - name exceeds max length
- ✅ G-C08: Form validation - duplicate name
- ✅ G-C09: Cancel glossary creation
- ✅ G-C10: Create glossary with special characters validation
- ✅ G-C12: Create glossary with multiple owners (users + teams)
- ✅ G-C13: Create glossary with multiple reviewers (users + teams)
- ✅ G-U01: Update glossary description
- ✅ G-U02: Update glossary display name via rename modal
- ✅ G-U04: Remove owner from glossary
- ✅ G-U05: Replace owner on glossary
- ✅ G-U07: Remove reviewer from glossary
- ✅ G-U08: Replace reviewer on glossary
- ✅ G-U10: Remove tags from glossary
- ✅ G-U11: Add domain to glossary
- ✅ G-U12: Remove domain from glossary
- ✅ G-U13: Change domain on glossary
- ✅ G-D01: Delete empty glossary
- ✅ G-D02: Delete glossary with terms
- ✅ G-D03: Delete glossary in non-English locale
- ✅ G-D04: Cancel delete operation
- ✅ G-D05: Delete glossary with assets tagged to terms

### Term CRUD
- ✅ T-C01: Create term with required fields
- ✅ T-C02: Create term with all fields populated
- ✅ T-C03: Create nested term
- ✅ T-C05: Create term via row action button (+)
- ✅ T-C06: Form validation - empty name
- ✅ T-C07: Form validation - empty description
- ✅ T-C08: Form validation - duplicate name
- ✅ T-C09: Form validation - name exceeds max length
- ✅ T-C10: Cancel term creation
- ✅ T-C11: Create term with synonyms
- ✅ T-C12: Create term with references
- ✅ T-C13: Create term with related terms
- ✅ T-C14: Create term with tags
- ✅ T-C15: Create term with custom style (color)
- ✅ T-C16: Create term with custom style (icon URL)
- ✅ T-C17: Create term with owners
- ✅ T-C18: Create term - inherits glossary reviewers
- ✅ T-C19: Create term with special characters validation
- ✅ T-U01: Update term description
- ✅ T-U02: Update term display name
- ✅ T-U03: Rename term
- ✅ T-U04: Rename term - verify FQN updates
- ✅ T-U06: Add synonyms to term
- ✅ T-U07: Remove individual synonym
- ✅ T-U08: Clear all synonyms
- ✅ T-U09: Add references to term
- ✅ T-U10: Edit reference name
- ✅ T-U11: Edit reference URL
- ✅ T-U12: Remove individual reference
- ✅ T-U13: Add related terms
- ✅ T-U14: Remove related term
- ✅ T-U15: Verify bidirectional related term link
- ✅ T-U16: Add tags to term
- ✅ T-U17: Remove tags from term
- ✅ T-U18: Add owner to term
- ✅ T-U19: Remove owner from term
- ✅ T-U20: Add reviewer to term
- ✅ T-U21: Remove reviewer from term
- ✅ T-U22: Update term style - set color
- ✅ T-U23: Update term style - set icon URL
- ✅ T-U26: Edit term via modal (pencil icon in table)
- ✅ T-U05: Rename term - verify child FQNs update
- ✅ T-D01: Delete leaf term
- ✅ T-D02: Delete parent term (cascade children)
- ✅ T-D03: Delete term with assets tagged
- ✅ T-D04: Cancel delete operation

### Hierarchy Management
- ✅ H-DD01: Drag term to make child
- ✅ H-DD02: Drag term back to root
- ✅ H-DD03: Drag term with children (subtree)
- ✅ H-DD04: Drag term confirmation modal
- ✅ H-DD05: Drag term - cancel operation
- ✅ H-DD06: Drag with reviewer acknowledgment
- ✅ H-DD07: Drag term to itself (prevented)
- ✅ H-M01: Change parent within same glossary
- ✅ H-M02: Move term to different glossary
- ✅ H-M03: Move term to root of current glossary
- ✅ H-M04: Move term to root of different glossary
- ✅ H-M05: Move term with children to different glossary
- ✅ H-M06: Cancel move operation
- ✅ H-N01: Expand individual parent term
- ✅ H-N02: Collapse individual parent term
- ✅ H-N03: Expand all terms
- ✅ H-N04: Collapse all terms
- ✅ H-N05: Tree state persists during updates
- ✅ H-N07: Navigate 5+ levels deep in hierarchy

### Approval Workflow
- ✅ W-S01: New term starts as Approved (no reviewers)
- ✅ W-S02: New term starts as Draft (with reviewers)
- ✅ W-S03: Approve term from table action
- ✅ W-S04: Reject term from table action
- ✅ W-S07: Status badge shows correct color/icon
- ✅ W-R01: User reviewer can approve
- ✅ W-R02: Team member reviewer can approve
- ✅ W-R03: Non-reviewer cannot see approve/reject buttons
- ✅ W-R04: Owner cannot approve (if not reviewer)
- ✅ W-R05: Multiple reviewers - any can approve

### Asset Management
- ✅ A-A01: Add single asset to term
- ✅ A-A02: Add multiple assets
- ✅ A-A04: Add table asset
- ✅ A-A05: Add dashboard asset
- ✅ A-A06: Add topic asset
- ✅ A-A07: Add pipeline asset
- ✅ A-A08: Mutually exclusive validation
- ✅ A-V01: Assets tab shows correct count
- ✅ A-V03: Click asset card opens summary panel
- ✅ A-V04: Search within assets tab
- ✅ A-V07: Assets persist after term rename
- ✅ A-R01: Remove single asset from term
- ✅ A-R03: Remove asset via entity page (untag)

### Search & Filter
- ✅ S-S01: Search by exact term name
- ✅ S-S02: Search by partial term name
- ✅ S-S03: Search is case-insensitive
- ✅ S-S04: Search within parent term scope
- ✅ S-S05: Clear search restores full list
- ✅ S-S07: Search no results - empty state
- ✅ S-F01: Filter by Approved status
- ✅ S-F02: Filter by Draft status
- ✅ S-F03: Filter by InReview status
- ✅ S-F04: Filter by multiple statuses
- ✅ S-F05: Clear status filter
- ✅ S-P01: Initial load shows 50 terms
- ✅ S-P02: Infinite scroll loads next batch
- ✅ S-P03: Scroll position maintained
- ✅ S-P04: Load more children

### Table Operations
- ✅ TBL-C01: Show/hide individual columns
- ✅ TBL-C02: View all columns
- ✅ TBL-C03: Hide all columns
- ✅ TBL-C04: Drag-drop column reordering
- ✅ TBL-C05: Column settings persist

### Import/Export
- ✅ IE-E01: Export glossary to CSV
- ✅ IE-E02: Export includes all standard fields
- ✅ IE-E03: Export includes custom properties
- ✅ IE-I01: Import new terms from CSV
- ✅ IE-I02: Import updates existing terms
- ✅ IE-I03: Import with custom properties
- ✅ IE-I04: Import validation - circular reference
- ✅ IE-I05: Import validation - missing required fields
- ✅ IE-I06: Import validation - invalid parent reference
- ✅ IE-I07: Import shows success/failure counts
- ✅ IE-I08: Import partial success (some pass, some fail)

### Version History
- ✅ V-01: View glossary version history
- ✅ V-02: View term version history
- ✅ V-03: Version diff shows description changes
- ✅ V-04: Version diff shows tag changes
- ✅ V-05: Version diff shows owner changes
- ✅ V-06: Version diff shows reviewer changes
- ✅ V-10: Navigate between versions
- ✅ V-11: Return to current version from history

### Permissions
- ✅ P-01: Allow all operations
- ✅ P-02: Deny all operations
- ✅ P-03: EditDescription only - only description editable
- ✅ P-04: EditOwners only - only owners editable
- ✅ P-05: EditTags only - only tags editable
- ✅ P-06: Delete only - only delete available
- ✅ P-07: Create only - can create but not edit
- ✅ P-09: Glossary deny - user cannot access
- ✅ P-10: Term deny - user cannot access

### Voting
- ✅ VT-01: Upvote glossary
- ✅ VT-02: Downvote glossary
- ✅ VT-03: Change vote on glossary
- ✅ VT-04: Remove vote on glossary
- ✅ VT-05: Upvote glossary term
- ✅ VT-06: Downvote glossary term
- ✅ VT-07: Vote persists after reload

### Navigation
- ✅ NAV-03: Breadcrumb navigation
- ✅ NAV-04: Deep link to nested term works
- ✅ NAV-05: Tab navigation

### UI States
- ✅ UI-01: Empty glossary state (no terms)
- ✅ UI-03: Error state on API failure

### Activity Feed
- ✅ AF-01: View activity feed on glossary
- ✅ AF-02: View activity feed on term
- ✅ AF-03: Post comment on glossary
- ✅ AF-04: Post comment on term

### Tasks
- ✅ TK-01: Create description task for glossary
- ✅ TK-02: Create description task for term
- ✅ TK-03: Create tag request task
- ✅ TK-05: Reject description suggestion
- ✅ TK-07: Reject tag suggestion
- ✅ TK-08: Task appears in notification bell

### Edge Cases
- ✅ EC-01: Handle glossary with deleted description
- ✅ EC-02: Handle term with deleted description

### Performance
- ✅ PF-01: 100 terms pagination
- ✅ PF-02: 100 children pagination
- ✅ PF-03: Expand all with 100+ terms
- ✅ PF-04: Search in large glossary
- ✅ PF-05: Drag-drop in large glossary

---

## Running Tests

### Run all glossary tests
```bash
yarn playwright test playwright/e2e/**/Glossary*.spec.ts --project=chromium
```

### Run specific test file
```bash
yarn playwright test playwright/e2e/Pages/Glossary.spec.ts --project=chromium
```

### Run tests with specific name pattern
```bash
yarn playwright test --project=chromium -g "should add and remove"
```

### Run tests in headed mode (for debugging)
```bash
yarn playwright test playwright/e2e/Features/GlossaryVoting.spec.ts --project=chromium --headed
```

---

## Pending Test Cases

The following test cases are identified for future implementation, organized by priority.

### P1 - Critical (High Priority)

All P1 tests are now implemented! ✅

---

### P2 - Important (Medium Priority)

#### Glossary Operations
| ID | Test Case | Notes |
|----|-----------|-------|
| G-U14 | Update mutually exclusive setting | Toggle change |

#### Hierarchy
| ID | Test Case | Notes |
|----|-----------|-------|
| H-DD08 | Drag parent to its own child (circular - prevented) | Circular prevention |
| H-N06 | Load more children (pagination within parent) | Already covered via PF-02 |

#### Workflow
| ID | Test Case | Notes |
|----|-----------|-------|
| W-S05 | Approve term from status popover | Alternative approval |
| W-S06 | Rejected term can be re-submitted | Re-submission |
| W-R08 | Non-reviewer edits approved term - goes to review | Status change |
| W-H01 | View workflow history on term | History view |
| W-H02 | Hover status badge shows history popover | Popover |
| W-H03 | History shows who approved/rejected | History detail |

#### Assets
| ID | Test Case | Notes |
|----|-----------|-------|
| A-V05 | Filter assets by entity type | Asset filter |
| A-V06 | Paginate through assets | Asset pagination |
| A-R02 | Bulk select and remove assets | Bulk removal |

#### Search & Filter
All P2 Search & Filter tests are now implemented! ✅

#### Table Operations
| ID | Test Case | Notes |
|----|-----------|-------|
| TBL-C06 | Custom property columns visible | Custom props |
| TBL-B01 | Bulk edit button navigates to bulk edit page | Bulk edit |
| TBL-B02 | Bulk edit multiple terms | Bulk update |

#### Import/Export
| ID | Test Case | Notes |
|----|-----------|-------|
| IE-E04 | Export large glossary (100+ terms) | Large export |
| IE-E05 | Export maintains hierarchy in CSV | Hierarchy in CSV |

#### Version History
| ID | Test Case | Notes |
|----|-----------|-------|
| V-07 | Version diff shows synonym changes | Diff detail |
| V-08 | Version diff shows reference changes | Diff detail |
| V-09 | Version diff shows related term changes | Diff detail |

#### Permissions
| ID | Test Case | Notes |
|----|-----------|-------|
| P-08 | ViewBasic - limited view access | View permission |
| P-11 | Team-based permissions work correctly | Team RBAC |

---

### P3 - Nice to Have (Low Priority)

#### Glossary Operations
| ID | Test Case | Notes |
|----|-----------|-------|
| G-C11 | Create glossary with unicode/emoji in name | Unicode support |

#### Term Operations
| ID | Test Case | Notes |
|----|-----------|-------|
| T-U24 | Update term style - remove color | Style removal |
| T-U25 | Update term style - remove icon | Style removal |

#### Search & Filter
| ID | Test Case | Notes |
|----|-----------|-------|
| S-S06 | Search with special characters | Special chars |
| S-S08 | Search debounce (500ms) works | Debounce timing |
| S-F06 | Status filter persists during navigation | State persistence |

#### Voting
| ID | Test Case | Notes |
|----|-----------|-------|
| VT-08 | Vote count displays correctly | Count display |

#### Activity Feed
| ID | Test Case | Notes |
|----|-----------|-------|
| AF-05 | Reply to existing comment | Reply feature |
| AF-06 | Edit own comment | Comment edit |
| AF-07 | Delete own comment | Comment delete |

#### Navigation & UI
| ID | Test Case | Notes |
|----|-----------|-------|
| NAV-06 | Back/forward browser navigation | Browser history |
| UI-02 | Loading skeleton displays | Loading state |
| UI-04 | Expand/collapse right panel | Panel toggle |

#### Edge Cases
| ID | Test Case | Notes |
|----|-----------|-------|
| EC-03 | Very long term name (128 chars) | Boundary test |
| EC-04 | Very long description (5000+ chars) | Large content |
| EC-05 | Special characters in all fields | Special chars |
| EC-06 | Unicode/emoji handling | Unicode |
| EC-07 | Concurrent edit conflict | Race condition |
| EC-08 | Network timeout handling | Error recovery |
| EC-09 | Session expiry during operation | Session handling |
| EC-10 | Maximum nesting depth (10+ levels) | Deep nesting |

#### Performance
| ID | Test Case | Notes |
|----|-----------|-------|
| PF-06 | 1000+ terms glossary | Scale test |
| PF-07 | Rapid operations (stress test) | Stress test |

---

## Summary: Test Coverage

| Priority | Covered | Pending | Total |
|----------|---------|---------|-------|
| **P1** | ~79 | 0 | ~79 |
| **P2** | ~69 | ~22 | ~91 |
| **P3** | ~2 | ~20 | ~22 |
| **Total** | **151** | **~42** | **~193** |

**P2 Coverage: ~76%** (Previously ~51%)

---

## Notes

1. Tests marked with `test.slow(true)` have extended timeout (3x default)
2. Some tests require specific setup (reviewers, permissions) done in `beforeAll`
3. Mutually exclusive tests create glossaries with `mutuallyExclusive: true`
4. Approval workflow tests require terms to be created via UI (not API) to trigger the workflow

---

*Last updated: December 13, 2024*

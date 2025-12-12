# Glossary Feature - Playwright Test Coverage

This document provides a comprehensive overview of all Playwright E2E tests covering the Glossary feature in OpenMetadata.

---

## Summary

| Category | File | Tests |
|----------|------|-------|
| Core CRUD | Glossary.spec.ts | 29 |
| Form Validation | GlossaryFormValidation.spec.ts | 11 |
| Import/Export | GlossaryImportExport.spec.ts | 2 |
| Pagination & Search | GlossaryPagination.spec.ts | 2 |
| Performance | LargeGlossaryPerformance.spec.ts | 9 |
| Permissions | GlossaryPermissions.spec.ts | 2 |
| Version History | GlossaryVersionPage.spec.ts | 2 |
| Voting | GlossaryVoting.spec.ts | 7 |
| Navigation | GlossaryNavigation.spec.ts | 3 |
| Remove Operations | GlossaryRemoveOperations.spec.ts | 6 |
| Term Details | GlossaryTermDetails.spec.ts | 5 |
| Workflow | GlossaryWorkflow.spec.ts | 5 |
| Assets | GlossaryAssets.spec.ts | 2 |
| **TOTAL** | **13 files** | **85 tests** |

---

## Test Files by Category

### 1. Core CRUD Operations
**File:** `playwright/e2e/Pages/Glossary.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | Glossary & terms creation for reviewer as user | Glossary creation, term creation, reviewer approval workflow |
| 2 | Glossary & terms creation for reviewer as team | Team-based reviewer approval workflow |
| 3 | Update Glossary and Glossary Term | Update description, add synonyms, references, related terms, tags, owners, reviewers |
| 4 | Add, Update and Verify Data Glossary Term | Data type glossary terms, term styling |
| 5 | Approve and reject glossary term from Glossary Listing | Approval workflow from listing page |
| 6 | Add and Remove Assets | Asset association, mutually exclusive validation |
| 7 | Rename Glossary Term and verify assets | FQN update propagation |
| 8 | Drag and Drop Glossary Term | Hierarchy changes via drag-drop |
| 9 | Drag and Drop Glossary Term Approved Terms having reviewer | Drag-drop with reviewer acknowledgment |
| 10 | Change glossary term hierarchy using menu options | Menu-based hierarchy changes |
| 11 | Change glossary term hierarchy using menu options across glossary | Cross-glossary term movement |
| 12 | Assign Glossary Term to entity and check assets | Entity tagging with glossary terms |
| 13 | Request description task for Glossary | Task creation for glossary description |
| 14 | Request description task for Glossary Term | Task creation for term description |
| 15 | Request tags for Glossary | Tag suggestion tasks |
| 16 | Delete Glossary and Glossary Term using Delete Modal | Deletion workflow |
| 17 | Verify Expand All For Nested Glossary Terms | Tree expansion functionality |
| 18 | Column selection and visibility for Glossary Terms table | Table column management |
| 19 | Glossary Terms Table Status filtering | Status-based filtering |
| 20 | Column dropdown drag-and-drop functionality for Glossary Terms table | Column reordering |
| 21 | Glossary Term Update in Glossary Page should persist tree | Tree state persistence |
| 22 | Add Glossary Term inside another Term | Nested term creation |
| 23 | Check for duplicate Glossary Term | Duplicate name validation |
| 24 | Verify Glossary Deny Permission | Access control - deny |
| 25 | Verify Glossary Term Deny Permission | Access control - term deny |
| 26 | Glossary creation with domain selection | Domain association |
| 27 | Create glossary, change language to Dutch, and delete glossary | Internationalization (i18n) |
| 28 | should handle glossary after description is deleted | Edge case - deleted description |
| 29 | should handle glossary term after description is deleted | Edge case - term deleted description |

---

### 2. Form Validation
**File:** `playwright/e2e/Pages/GlossaryFormValidation.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should show error for empty glossary name | Required field validation |
| 2 | should show error for empty glossary description | Required field validation |
| 3 | should show error for glossary name exceeding max length | Max length validation (128 chars) |
| 4 | should show error for glossary name with special characters | Special character validation |
| 5 | should show error for duplicate glossary name | Uniqueness validation |
| 6 | should allow cancel glossary creation | Cancel operation |
| 7 | should show error for empty term name | Term required field validation |
| 8 | should show error for empty term description | Term required field validation |
| 9 | should show error for term name exceeding max length | Term max length validation |
| 10 | should show error for term name with special characters | Term special character validation |
| 11 | should allow cancel term creation | Term cancel operation |

---

### 3. Import/Export
**File:** `playwright/e2e/Pages/GlossaryImportExport.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | Glossary Bulk Import Export | CSV import/export with custom properties |
| 2 | Check for Circular Reference in Glossary Import | Circular reference detection |

---

### 4. Pagination & Search
**File:** `playwright/e2e/Features/GlossaryPagination.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should check for glossary term search | Root-level term search |
| 2 | should check for nested glossary term search | Nested term search |

---

### 5. Large Glossary Performance
**File:** `playwright/e2e/Features/LargeGlossaryPerformance.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should handle large number of glossary terms with pagination | 100+ terms pagination |
| 2 | should search and filter glossary terms | Search in large glossary |
| 3 | should expand and collapse all terms | Expand/collapse with many terms |
| 4 | should expand individual terms | Individual term expansion |
| 5 | should maintain scroll position when loading more terms | Infinite scroll behavior |
| 6 | should handle status filtering | Status filter with many terms |
| 7 | should show term count in glossary listing | Count display accuracy |
| 8 | should handle drag and drop for term reordering | Drag-drop in large glossary |
| 9 | should handle large number of glossary child term with pagination | 100+ children pagination |

---

### 6. Permissions (RBAC)
**File:** `playwright/e2e/Features/Permissions/GlossaryPermissions.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | Glossary allow operations | All operations visible when allowed |
| 2 | Glossary deny operations | Operations hidden when denied |

---

### 7. Version History
**File:** `playwright/e2e/VersionPages/GlossaryVersionPage.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | Glossary | Glossary version diff (description, tags, owners, reviewers) |
| 2 | GlossaryTerm | Term version diff |

---

### 8. Voting
**File:** `playwright/e2e/Features/GlossaryVoting.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should upvote glossary | Glossary upvote |
| 2 | should downvote glossary | Glossary downvote |
| 3 | should change vote on glossary from upvote to downvote | Vote change |
| 4 | should remove vote on glossary by clicking again | Vote removal |
| 5 | should upvote glossary term | Term upvote |
| 6 | should downvote glossary term | Term downvote |
| 7 | should persist vote after page reload | Vote persistence |

---

### 9. Navigation
**File:** `playwright/e2e/Features/GlossaryNavigation.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should navigate between tabs on glossary page | Glossary page tab navigation (Terms, Activity Feed) |
| 2 | should navigate between tabs on glossary term page | Term page tab navigation (Overview, Assets) |
| 3 | should navigate via breadcrumbs | Breadcrumb navigation |

---

### 10. Remove Operations
**File:** `playwright/e2e/Features/GlossaryRemoveOperations.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should add and remove owner from glossary | Glossary owner removal |
| 2 | should add and remove reviewer from glossary | Glossary reviewer removal |
| 3 | should add and remove owner from glossary term | Term owner removal |
| 4 | should add and remove reviewer from glossary term | Term reviewer removal |
| 5 | should add and remove tags from glossary | Glossary tag removal |
| 6 | should add and remove tags from glossary term | Term tag removal (with confirmation modal) |

---

### 11. Term Details Operations
**File:** `playwright/e2e/Features/GlossaryTermDetails.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should add and remove synonyms from glossary term | Synonym management |
| 2 | should add and remove references from glossary term | Reference management |
| 3 | should add and remove related terms from glossary term | Related term management |
| 4 | should verify bidirectional related term link | Bidirectional relationship verification |
| 5 | should create term with all optional fields populated | Full term creation (synonyms, references, icon) |

---

### 12. Workflow (Approval & Hierarchy)
**File:** `playwright/e2e/Features/GlossaryWorkflow.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should start term as Approved when glossary has no reviewers | Auto-approval without reviewers |
| 2 | should start term as Draft when glossary has reviewers | Draft status with reviewers |
| 3 | should move term with children (subtree) via drag and drop | Subtree movement |
| 4 | non-reviewer should not see approve/reject buttons | Reviewer permission check |
| 5 | should delete parent term and cascade delete children | Cascade deletion |

---

### 13. Asset Management
**File:** `playwright/e2e/Features/GlossaryAssets.spec.ts`

| # | Test Name | Coverage |
|---|-----------|----------|
| 1 | should add asset to glossary term via Assets tab | Asset addition via dropdown menu |
| 2 | should add and remove asset from glossary term | Asset removal with checkbox selection |

---

## Coverage by Feature Area

### Glossary CRUD
- ✅ Create glossary with required fields
- ✅ Create glossary with optional fields (tags, owners, reviewers, domain)
- ✅ Create glossary with mutually exclusive toggle
- ✅ Update glossary description
- ✅ Add/remove owners
- ✅ Add/remove reviewers
- ✅ Add/remove tags
- ✅ Delete glossary
- ✅ Domain association

### Term CRUD
- ✅ Create term with required fields
- ✅ Create term with all optional fields (synonyms, references, icon)
- ✅ Create nested terms
- ✅ Update term description
- ✅ Rename term (FQN update)
- ✅ Add/remove synonyms
- ✅ Add/remove references
- ✅ Add/remove related terms
- ✅ Add/remove tags
- ✅ Add/remove owners
- ✅ Add/remove reviewers
- ✅ Delete term (including cascade)

### Hierarchy Management
- ✅ Drag and drop term movement
- ✅ Subtree movement
- ✅ Menu-based hierarchy changes
- ✅ Cross-glossary term movement
- ✅ Tree expansion/collapse
- ✅ Tree state persistence

### Approval Workflow
- ✅ Draft status with reviewers
- ✅ Approved status without reviewers
- ✅ Approve from listing
- ✅ Reject from listing
- ✅ Reviewer permission check
- ✅ Team reviewer workflow

### Asset Management
- ✅ Add asset via Assets tab
- ✅ Remove asset
- ✅ Mutually exclusive validation
- ✅ Asset count display

### Search & Filter
- ✅ Term search (root level)
- ✅ Nested term search
- ✅ Status filtering
- ✅ Large glossary search

### Table Operations
- ✅ Column visibility
- ✅ Column reordering
- ✅ Column settings persistence

### Import/Export
- ✅ CSV export
- ✅ CSV import
- ✅ Custom properties in import/export
- ✅ Circular reference detection

### Version History
- ✅ Glossary version diff
- ✅ Term version diff

### Permissions
- ✅ Allow all operations
- ✅ Deny all operations
- ✅ Glossary-level deny
- ✅ Term-level deny

### Voting
- ✅ Upvote/downvote glossary
- ✅ Upvote/downvote term
- ✅ Change vote
- ✅ Remove vote
- ✅ Vote persistence

### Navigation
- ✅ Tab navigation (glossary page)
- ✅ Tab navigation (term page)
- ✅ Breadcrumb navigation

### Form Validation
- ✅ Empty name validation
- ✅ Empty description validation
- ✅ Max length validation
- ✅ Special characters validation
- ✅ Duplicate name validation
- ✅ Cancel operation

### Edge Cases
- ✅ Deleted description handling
- ✅ Large glossary (100+ terms)
- ✅ Large children (100+ children)
- ✅ Internationalization (German/Dutch)

---

## Running Tests

### Run all glossary tests
```bash
yarn playwright test playwright/e2e/**/Glossary*.spec.ts playwright/e2e/**/*lossary*.spec.ts --project=chromium
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

## Test Dependencies

Most glossary tests use these support classes:
- `Glossary` - Creates and manages glossary entities
- `GlossaryTerm` - Creates and manages glossary term entities
- `UserClass` - Creates test users for permission testing
- `TableClass`, `DashboardClass` - Creates assets for tagging tests

---

## Notes

1. Tests marked with `test.slow(true)` have extended timeout (3x default)
2. Some tests require specific setup (reviewers, permissions) done in `beforeAll`
3. Mutually exclusive tests create glossaries with `mutuallyExclusive: true`
4. Approval workflow tests require terms to be created via UI (not API) to trigger the workflow

---

## Pending Test Cases

The following test cases are identified for future implementation, organized by priority.

### P1 - Critical (High Priority)

#### Glossary Creation
| ID | Test Case | Notes |
|----|-----------|-------|
| G-C02 | Create glossary with all optional fields (tags, owners, reviewers, domain) | Full form test |

#### Term Creation
| ID | Test Case | Notes |
|----|-----------|-------|
| T-C05 | Create term via row action button (+) | Alternative creation method |
| T-C11 | Create term with synonyms | During creation (not update) |
| T-C12 | Create term with references | During creation |
| T-C13 | Create term with related terms | During creation |
| T-C14 | Create term with tags | During creation |
| T-C17 | Create term with owners | During creation |
| T-C18 | Create term - inherits glossary reviewers | Verify inheritance |

#### Term Updates
| ID | Test Case | Notes |
|----|-----------|-------|
| T-U02 | Update term display name | Via edit modal |
| T-U26 | Edit term via modal (pencil icon in table) | In-table edit |

#### Assets
| ID | Test Case | Notes |
|----|-----------|-------|
| A-V02 | Asset cards display correctly | Verify card content |

---

### P2 - Important (Medium Priority)

#### Glossary Operations
| ID | Test Case | Notes |
|----|-----------|-------|
| G-C04 | Create glossary with mutually exclusive toggle OFF | Explicit OFF test |
| G-C10 | Create glossary with special characters in name | Edge case |
| G-C12 | Create glossary with multiple owners (users + teams) | Mixed owners |
| G-C13 | Create glossary with multiple reviewers (users + teams) | Mixed reviewers |
| G-U02 | Update glossary display name via rename modal | Rename feature |
| G-U05 | Replace owner on glossary | Owner replacement |
| G-U08 | Replace reviewer on glossary | Reviewer replacement |
| G-U12 | Remove domain from glossary | Domain removal |
| G-U13 | Change domain on glossary | Domain change |
| G-U14 | Update mutually exclusive setting | Toggle change |
| G-D04 | Cancel delete operation | Cancel flow |
| G-D05 | Delete glossary with assets tagged to terms | Cleanup verification |

#### Term Operations
| ID | Test Case | Notes |
|----|-----------|-------|
| T-C09 | Form validation - name exceeds 128 characters | Max length |
| T-C10 | Cancel term creation | Cancel flow |
| T-C15 | Create term with custom style (color) | Style feature |
| T-C16 | Create term with custom style (icon URL) | Style feature |
| T-C19 | Create term with special characters in name | Edge case |
| T-U05 | Rename term - verify child FQNs update | Cascading FQN |
| T-U08 | Clear all synonyms | Bulk clear |
| T-U10 | Edit reference name | Reference edit |
| T-U11 | Edit reference URL | Reference edit |
| T-U22 | Update term style - set color | Style update |
| T-U23 | Update term style - set icon URL | Style update |
| T-D03 | Delete term with assets tagged | Cleanup verification |
| T-D04 | Cancel delete operation | Cancel flow |

#### Hierarchy
| ID | Test Case | Notes |
|----|-----------|-------|
| H-DD05 | Drag term - cancel operation | Cancel drag |
| H-DD07 | Drag term to itself (should be prevented) | Self-drag prevention |
| H-DD08 | Drag parent to its own child (circular - prevented) | Circular prevention |
| H-M03 | Move term to root of current glossary | Root movement |
| H-M04 | Move term to root of different glossary | Cross-glossary root |
| H-M05 | Move term with children to different glossary | Subtree cross-glossary |
| H-M06 | Cancel move operation | Cancel flow |
| H-N07 | Navigate 5+ levels deep in hierarchy | Deep navigation |

#### Workflow
| ID | Test Case | Notes |
|----|-----------|-------|
| W-S05 | Approve term from status popover | Alternative approval |
| W-S06 | Rejected term can be re-submitted | Re-submission |
| W-S07 | Status badge shows correct color/icon | Visual verification |
| W-R04 | Owner cannot approve (if not reviewer) | Permission check |
| W-R05 | Multiple reviewers - any can approve | Multi-reviewer |
| W-R08 | Non-reviewer edits approved term - goes to review | Status change |
| W-H01 | View workflow history on term | History view |
| W-H02 | Hover status badge shows history popover | Popover |
| W-H03 | History shows who approved/rejected | History detail |

#### Assets
| ID | Test Case | Notes |
|----|-----------|-------|
| A-A06 | Add topic asset | Topic type |
| A-A07 | Add pipeline asset | Pipeline type |
| A-V03 | Click asset card opens summary panel | Panel interaction |
| A-V04 | Search within assets tab | Asset search |
| A-V05 | Filter assets by entity type | Asset filter |
| A-V06 | Paginate through assets | Asset pagination |
| A-R02 | Bulk select and remove assets | Bulk removal |
| A-R03 | Remove asset via entity page (untag) | Reverse removal |

#### Search & Filter
| ID | Test Case | Notes |
|----|-----------|-------|
| S-S03 | Search is case-insensitive | Case handling |
| S-S07 | Search no results - empty state | Empty state |
| S-F03 | Filter by InReview status | Additional status |
| S-F04 | Filter by multiple statuses | Multi-filter |
| S-F05 | Clear status filter | Filter clear |

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
| IE-I05 | Import validation - missing required fields | Validation |
| IE-I06 | Import validation - invalid parent reference | Validation |
| IE-I08 | Import partial success (some pass, some fail) | Partial import |

#### Version History
| ID | Test Case | Notes |
|----|-----------|-------|
| V-07 | Version diff shows synonym changes | Diff detail |
| V-08 | Version diff shows reference changes | Diff detail |
| V-09 | Version diff shows related term changes | Diff detail |
| V-10 | Navigate between versions | Version nav |
| V-11 | Return to current version from history | Return nav |

#### Permissions
| ID | Test Case | Notes |
|----|-----------|-------|
| P-03 | EditDescription only - only description editable | Granular permission |
| P-04 | EditOwners only - only owners editable | Granular permission |
| P-05 | EditTags only - only tags editable | Granular permission |
| P-06 | Delete only - only delete available | Granular permission |
| P-07 | Create only - can create but not edit | Granular permission |
| P-08 | ViewBasic - limited view access | View permission |
| P-11 | Team-based permissions work correctly | Team RBAC |

#### Activity Feed & Tasks
| ID | Test Case | Notes |
|----|-----------|-------|
| AF-01 | View activity feed on glossary | Feed view |
| AF-02 | View activity feed on term | Feed view |
| AF-03 | Post comment on glossary | Comment |
| AF-04 | Post comment on term | Comment |
| TK-05 | Reject description suggestion | Task rejection |
| TK-07 | Reject tag suggestion | Task rejection |
| TK-08 | Task appears in notification bell | Notification |

#### Navigation & UI
| ID | Test Case | Notes |
|----|-----------|-------|
| NAV-03 | Breadcrumb navigation up hierarchy | Already partial (GlossaryNavigation.spec.ts) |
| NAV-04 | Deep link to nested term works | URL navigation |
| UI-01 | Empty glossary state (no terms) | Empty state |
| UI-03 | Error state on API failure | Error handling |

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

## Summary: Pending Tests by Priority

| Priority | Count | Description |
|----------|-------|-------------|
| **P1** | ~10 | Critical gaps in term creation fields |
| **P2** | ~65 | Important feature coverage |
| **P3** | ~20 | Nice-to-have edge cases |
| **Total** | ~95 | Remaining test cases |

---

*Last updated: December 2024*

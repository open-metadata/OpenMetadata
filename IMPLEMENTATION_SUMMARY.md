# Implementation Summary: Multi-Select Test Cases Feature

## Problem Statement
Users needed to add test cases to Bundle Suites one by one, which was inefficient. The feature request was to enable:
1. Filtering test cases using existing filters (Table, Type, Status, Tags, etc.)
2. Selecting multiple test cases using checkboxes
3. Adding all selected test cases to a Bundle Suite in bulk

## Solution Overview
Implemented a multi-select checkbox feature in the Test Cases table with bulk actions to add selected test cases to Bundle Suites.

## Files Created

### 1. AddToBundleSuiteModal Component
**Files:**
- `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/AddToBundleSuiteModal/AddToBundleSuiteModal.component.tsx`
- `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/AddToBundleSuiteModal/AddToBundleSuiteModal.interface.ts`

**Purpose:** Modal dialog for bulk adding test cases to Bundle Suites

**Key Features:**
- Radio buttons to choose between existing or new Bundle Suite
- Searchable dropdown to select from existing Bundle Suites
- Debounced search with API integration
- Option to create new Bundle Suite (stores selected test case IDs in session storage and redirects)
- Form validation
- Success/error toast notifications

## Files Modified

### 2. DataQualityTab Component
**File:** `openmetadata-ui/src/main/resources/ui/src/components/Database/Profiler/DataQualityTab/DataQualityTab.tsx`

**Changes:**
- Added `enableBulkActions` prop (defaults to false for backward compatibility)
- Added state management for selected test cases (`selectedTestCaseIds`)
- Added checkbox column with "Select All" functionality
- Added bulk action bar showing:
  - Selected count
  - "Add to Bundle Suite" button
  - "Clear Selection" button
- Integrated AddToBundleSuiteModal component
- Added handlers:
  - `handleSelectAll`: Select/deselect all test cases
  - `handleSelectTestCase`: Toggle individual test case selection
  - `handleAddToBundleSuite`: Open modal
  - `handleAddToBundleSuiteSuccess`: Clear selection and refresh

### 3. DataQualityTab Interface
**File:** `openmetadata-ui/src/main/resources/ui/src/components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface.ts`

**Changes:**
- Added `enableBulkActions?: boolean` to `DataQualityTabProps` interface

### 4. TestCases Component
**File:** `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/TestCases/TestCases.component.tsx`

**Changes:**
- Enabled bulk actions by passing `enableBulkActions={true}` to DataQualityTab

## Technical Implementation Details

### State Management
```typescript
const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set());
const [isAddToBundleSuiteModalVisible, setIsAddToBundleSuiteModalVisible] = useState(false);
```

### Checkbox Column
- Added as first column when `enableBulkActions` is true
- Header checkbox supports:
  - Fully checked (all selected)
  - Indeterminate (some selected)
  - Unchecked (none selected)
- Individual row checkboxes toggle selection

### Bulk Action Bar
- Only visible when `selectedTestCaseIds.size > 0`
- Shows count in real-time
- Styled with padding and border for visual distinction

### API Integration
- Uses existing `addTestCaseToLogicalTestSuite` API for adding to existing suites
- Uses `getListTestSuitesBySearch` API to fetch Bundle Suites (filtered by `TestSuiteType.logical`)
- Debounced search (500ms) to reduce API calls

### User Experience Considerations
1. **Persistence**: Selection persists across pages (until action is taken)
2. **Feedback**: Clear visual feedback for selected items
3. **Flexibility**: Can add to existing suite or create new one
4. **Validation**: Requires at least one test case and valid suite selection
5. **Error Handling**: Shows toast messages for errors
6. **Success Flow**: Clears selection and refreshes list after successful addition

## Translation Keys Used
All translations use existing keys:
- `label.selected-lowercase`: "selected"
- `label.add-entity`: "Add {{entity}}"
- `label.clear-entity`: "Clear {{entity}}"
- `label.bundle-suite`: "Bundle Suite"
- `label.test-case-plural`: "Test Cases"
- `label.create`: "Create"
- `label.add`: "Add"
- `server.entity-added-successfully`: Success message

Hardcoded strings (for first implementation):
- Modal title: "Add Test Cases to Bundle Suite"
- Radio options: "Use existing Bundle Suite" / "Create new Bundle Suite"
- Create mode message: "You will be redirected..."

## Backward Compatibility
- Feature is opt-in via `enableBulkActions` prop
- Default is `false` to maintain existing behavior
- Only enabled in main Test Cases tab, not in entity-specific views

## Future Enhancements
1. Add internationalization for hardcoded strings
2. Add unit tests for the new components
3. Add E2E Playwright tests
4. Consider adding keyboard shortcuts (Ctrl+A for select all)
5. Consider adding "Add to" menu for other bulk operations
6. Persist selection state in URL or session for cross-page consistency

## Testing Checklist
- [ ] Checkbox selection works correctly
- [ ] Select All / Deselect All functions properly
- [ ] Indeterminate state displays correctly
- [ ] Bulk action bar appears/disappears correctly
- [ ] Modal opens with correct test case count
- [ ] Search in Bundle Suite dropdown works
- [ ] Adding to existing Bundle Suite succeeds
- [ ] Creating new Bundle Suite redirects correctly
- [ ] Success toasts appear
- [ ] Error handling works (API failures, validation)
- [ ] Selection clears after successful operation
- [ ] Feature doesn't break existing functionality

## Deployment Notes
- No database migrations required
- No backend changes required
- Frontend-only feature
- Requires standard frontend build and deployment

## Screenshots Required
1. Test Cases table with checkboxes
2. Some test cases selected (showing indeterminate state)
3. All test cases selected (showing bulk action bar)
4. Add to Bundle Suite modal (existing suite option)
5. Add to Bundle Suite modal (new suite option)
6. Success toast message
7. Bundle Suite detail page showing added test cases

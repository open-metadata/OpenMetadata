# Visual Guide: Multi-Select Test Cases Feature

## Current Page View (Before Feature)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Data Quality                                    [Add a Test Case]       │
├─────────────────────────────────────────────────────────────────────────┤
│ Build trust in your data with quality tests...                         │
│                                                                         │
│ Summary │ Test Cases │ Test Suites                                     │
│          ───────────                                                    │
│                                                                         │
│ [Advanced ▼] Table: [All ▼] Type: [All ▼] Status: [All ▼]            │
│                                                                         │
│ Test Case Insights                              [Search test case]     │
│ Access a centralized view of your dataset's health...                  │
│                                                                         │
│ Status │ Reason │ Last Run │ Name │ Table │ Column │ Incident │ ⋮    │
├────────┼────────┼──────────┼──────┼───────┼────────┼──────────┼─────┤
│ ✗ Failed│ rowCo..│ Sep 23...│ order│ Meetup│  --    │  New ▼   │ ⋮  │
│ ✗ Failed│ rowCo..│ Sep 23...│ custo│ Meetup│  --    │  New ▼   │ ⋮  │
│ ✗ Failed│ hello │ Aug 13...│ Test │ redshi│  --    │  Ack ▼   │ ⋮  │
└─────────────────────────────────────────────────────────────────────────┘
```

## New Page View (With Feature Enabled)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Data Quality                                    [Add a Test Case]       │
├─────────────────────────────────────────────────────────────────────────┤
│ Build trust in your data with quality tests...                         │
│                                                                         │
│ Summary │ Test Cases │ Test Suites                                     │
│          ───────────                                                    │
│                                                                         │
│ [Advanced ▼] Table: [All ▼] Type: [All ▼] Status: [All ▼]            │
│                                                                         │
│ Test Case Insights                              [Search test case]     │
│ Access a centralized view of your dataset's health...                  │
│                                                                         │
│ ☐ │ Status │ Reason │ Last Run │ Name │ Table │ Column │ Incident │ ⋮│
├───┼────────┼────────┼──────────┼──────┼───────┼────────┼──────────┼───┤
│ ☑ │ ✗ Failed│ rowCo..│ Sep 23...│ order│ Meetup│  --    │  New ▼   │ ⋮│
│ ☑ │ ✗ Failed│ rowCo..│ Sep 23...│ custo│ Meetup│  --    │  New ▼   │ ⋮│
│ ☐ │ ✗ Failed│ hello │ Aug 13...│ Test │ redshi│  --    │  Ack ▼   │ ⋮│
└─────────────────────────────────────────────────────────────────────────┘
     ↑
     Checkboxes added to each row and header
```

## With Items Selected

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Data Quality                                    [Add a Test Case]       │
├─────────────────────────────────────────────────────────────────────────┤
│ Build trust in your data with quality tests...                         │
│                                                                         │
│ Summary │ Test Cases │ Test Suites                                     │
│          ───────────                                                    │
│                                                                         │
│ [Advanced ▼] Table: [All ▼] Type: [All ▼] Status: [All ▼]            │
│                                                                         │
│ Test Case Insights                              [Search test case]     │
│ Access a centralized view of your dataset's health...                  │
│                                                                         │
│ ╔═══════════════════════════════════════════════════════════════════╗  │
│ ║ 2 selected  [Add to Bundle Suite]  [Clear Selection]             ║  │
│ ╚═══════════════════════════════════════════════════════════════════╝  │
│                                                  ↑                      │
│                                         Bulk Action Bar                │
│                                                                         │
│ ☐ │ Status │ Reason │ Last Run │ Name │ Table │ Column │ Incident │ ⋮│
├───┼────────┼────────┼──────────┼──────┼───────┼────────┼──────────┼───┤
│ ☑ │ ✗ Failed│ rowCo..│ Sep 23...│ order│ Meetup│  --    │  New ▼   │ ⋮│
│ ☑ │ ✗ Failed│ rowCo..│ Sep 23...│ custo│ Meetup│  --    │  New ▼   │ ⋮│
│ ☐ │ ✗ Failed│ hello │ Aug 13...│ Test │ redshi│  --    │  Ack ▼   │ ⋮│
└─────────────────────────────────────────────────────────────────────────┘
```

## Modal - Add to Bundle Suite (Existing)

```
┌────────────────────────────────────────────────────────────┐
│  Add Test Cases to Bundle Suite                      [X]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  2 Test Cases selected                                    │
│                                                            │
│  Select Option:                                           │
│    ○ Use existing Bundle Suite                            │
│    ○ Create new Bundle Suite                              │
│                                                            │
│  Bundle Suite: *                                          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Search Bundle Suite                            [▼]   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│                                    [Cancel]     [Add]     │
└────────────────────────────────────────────────────────────┘
```

## Modal - Add to Bundle Suite (New)

```
┌────────────────────────────────────────────────────────────┐
│  Add Test Cases to Bundle Suite                      [X]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  2 Test Cases selected                                    │
│                                                            │
│  Select Option:                                           │
│    ○ Use existing Bundle Suite                            │
│    ● Create new Bundle Suite                              │
│                                                            │
│  You will be redirected to create a new Bundle Suite     │
│  with the selected test cases.                           │
│                                                            │
│                                    [Cancel]   [Create]    │
└────────────────────────────────────────────────────────────┘
```

## User Flow Diagram

```
┌───────────────┐
│   Test Cases  │
│     Page      │
└───────┬───────┘
        │
        ├─ Apply Filters (Table, Type, Status, Tags, etc.)
        │
        ├─ Select Test Cases
        │  ├─ Click individual checkboxes
        │  └─ OR click "Select All" checkbox
        │
        ▼
┌───────────────┐
│  2 selected   │ ◄── Bulk Action Bar Appears
│ [Add to Bndl] │
│ [Clear Sel]   │
└───────┬───────┘
        │
        ├─ Click "Clear Selection" → Clear all and hide bar
        │
        ├─ Click "Add to Bundle Suite"
        │
        ▼
┌───────────────────────┐
│  Add to Bundle Suite  │
│       Modal           │
└───────┬───────────────┘
        │
        ├─ Option 1: Use Existing Bundle Suite
        │  ├─ Search and select bundle suite
        │  ├─ Click "Add"
        │  ├─ API Call: addTestCaseToLogicalTestSuite
        │  ├─ Show success toast
        │  ├─ Clear selection
        │  └─ Refresh test cases list
        │
        └─ Option 2: Create New Bundle Suite
           ├─ Click "Create"
           ├─ Store selected test case IDs in session storage
           ├─ Navigate to Bundle Suite creation page
           └─ Pre-fill with selected test cases
```

## State Management

```
Component: DataQualityTab
├─ State: selectedTestCaseIds (Set<string>)
│  ├─ Add ID: handleSelectTestCase(id, true)
│  ├─ Remove ID: handleSelectTestCase(id, false)
│  ├─ Add All: handleSelectAll(true)
│  └─ Clear All: handleSelectAll(false)
│
├─ State: isAddToBundleSuiteModalVisible (boolean)
│  ├─ Open: handleAddToBundleSuite()
│  └─ Close: onCancel() or onSuccess()
│
└─ Computed: selectedTestCaseObjects (TestCase[])
   └─ Filter testCases by selectedTestCaseIds
```

## API Interactions

```
┌─────────────────────────────────────────────────────────────┐
│                     AddToBundleSuiteModal                   │
└─────────────────────────────────────────────────────────────┘
        │
        ├─ On Mount / On Search
        │  └─ API: getListTestSuitesBySearch
        │     ├─ Request: { q: search, testSuiteType: 'logical' }
        │     └─ Response: TestSuite[]
        │
        └─ On Submit (Existing Suite)
           └─ API: addTestCaseToLogicalTestSuite
              ├─ Request: { testCaseIds: string[], testSuiteId: string }
              └─ Response: TestSuite (updated)
```

## Edge Cases Handled

1. **No test cases selected**: Bulk action bar not shown
2. **All selected → Deselect all**: Checkbox shows checked → click → all unchecked
3. **Some selected**: Checkbox shows indeterminate state
4. **API failure**: Shows error toast, keeps selection
5. **Empty search results**: Shows "No results" in dropdown
6. **Modal closed without action**: Selection preserved
7. **Successful addition**: Selection cleared, list refreshed

## Keyboard Shortcuts (Future Enhancement)

```
Ctrl/Cmd + A     → Select all visible test cases
Escape           → Close modal / Clear selection
Enter            → Submit modal when focused
```

## Accessibility Considerations

- ✅ Checkboxes have aria-labels
- ✅ Modal has proper focus management
- ✅ Buttons have descriptive text
- ✅ Form fields have associated labels
- ✅ Error messages are announced
- ✅ Success toasts are visible
```

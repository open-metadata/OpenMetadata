# Multi-Select Test Cases Feature

## Overview
This feature allows users to select multiple test cases from the Test Cases list and add them in bulk to a Bundle Suite, improving the workflow from having to add test cases one by one.

## Changes Made

### New Components

#### AddToBundleSuiteModal
- **Location**: `src/components/DataQuality/AddToBundleSuiteModal/`
- **Purpose**: Modal dialog for adding selected test cases to a bundle suite
- **Features**:
  - Select existing Bundle Suite from dropdown
  - Option to create a new Bundle Suite (redirects to creation page with pre-selected test cases)
  - Search functionality for finding Bundle Suites
  - Validates input before submission

### Modified Components

#### DataQualityTab
- **Location**: `src/components/Database/Profiler/DataQualityTab/`
- **Changes**:
  - Added checkbox column for multi-select
  - Added "Select All" checkbox in table header
  - Added bulk action bar showing selected count
  - Added "Add to Bundle Suite" and "Clear Selection" buttons
  - New prop `enableBulkActions` to enable/disable this feature

#### TestCases Component
- **Location**: `src/components/DataQuality/TestCases/`
- **Changes**:
  - Enabled `enableBulkActions={true}` for the DataQualityTab component

### Interface Updates

#### DataQualityTabProps
- **Location**: `src/components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface.ts`
- **Changes**:
  - Added optional `enableBulkActions?: boolean` property

## User Flow

1. User navigates to Data Quality > Test Cases tab
2. User sees checkboxes next to each test case
3. User can:
   - Click individual checkboxes to select specific test cases
   - Click "Select All" checkbox in header to select all visible test cases
4. When test cases are selected, a bulk action bar appears showing:
   - Count of selected test cases
   - "Add to Bundle Suite" button
   - "Clear Selection" button
5. Clicking "Add to Bundle Suite":
   - Opens modal dialog
   - User chooses to either:
     - Add to existing Bundle Suite (select from dropdown)
     - Create new Bundle Suite (redirects to creation form)
6. Upon successful addition, user sees success message and selection is cleared

## API Calls

- `getListTestSuitesBySearch`: Fetches Bundle Suites for selection
- `addTestCaseToLogicalTestSuite`: Adds test cases to selected Bundle Suite

## Notes

- Feature is only enabled in the main Test Cases tab (not in entity-specific views)
- Selection state is cleared after successful operation
- Session storage is used to pass pre-selected test case IDs when creating a new Bundle Suite
- All user-facing text uses existing translation keys where possible

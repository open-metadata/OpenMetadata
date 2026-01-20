# Observability Permission & Role Implementation Plan

## 1. Objective

Achieve 100% test coverage for Observability permissions by implementing a dedicated test suite `DataQualityPermissions.spec.ts`. This plan details the strategy for specific system roles and granular permissions defined in `permissions.md`.

## 2. Role-Based Coverage Strategy

### 2.1 Data Consumer Role

- **Role Definition**: Default `DataConsumer` system role.
- **Expected Access**: Read-only access to quality data. No creation or deletion capabilities.
- **Test Scenarios**:
  - **Verify Creation Blocked**: Ensure API returns 403 Forbidden when attempting to **create** a TestCase.
  - **Verify Deletion Blocked**: Ensure API returns 403 Forbidden when attempting to **delete** a TestCase.
  - **Verify Suite Management Blocked**: Ensure API returns 403 Forbidden when attempting to **create/delete** a Logical Test Suite.
  - **Verify View Access**: Ensure API/UI allows **viewing** Test Cases (via `VIEW_ALL` implied default).

### 2.2 Data Steward Role

- **Role Definition**: Default `DataSteward` system role.
- **Expected Access**: Generally has edit rights on entities, but strict checks needed for Data Quality specific operations versus generic Table edits.
- **Test Scenarios**:
  - **Verify Creation Blocked**: Ensure API returns 403 Forbidden when attempting to **create** a TestCase (unless `TABLE.CREATE_TESTS` is explicitly granted, standard steward usually doesn't have it on all tables by default).
  - **Verify Deletion Blocked**: Ensure API returns 403 Forbidden when attempting to **delete** a TestCase.
  - **Verify Suite Management**: Check access for Logical Test Suite creation/deletion (should be blocked default).

### 2.3 Admin Role

- **Role Definition**: Super Admin.
- **Expected Access**: Full Create, Read, Update, Delete (CRUD) access on all resources.
- **Test Scenarios**:
  - **Full Lifecycle**: Successfully **create**, **edit**, **view**, and **delete** Test Cases and Logical Test Suites.
  - **Sample Data**: Successfully **view** and **delete** Failed Rows Samples.

## 3. Specific Permission Coverage (Mapped to `permissions.md`)

This section details how each granular permission from `permissions.md` will be tested using custom policies to ensure isolation.

| Resource      | Permission                            | Coverage Strategy                                                                                             |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **TestCase**  | `TEST_CASE.CREATE`                    | **Positive**: Create User (with perm) successfully creates test.<br>**Negative**: User without perm gets 403. |
|               | `TEST_CASE.DELETE`                    | **Positive**: Delete User (with perm) successfully deletes test.<br>**Negative**: User without perm gets 403. |
|               | `TEST_CASE.VIEW_BASIC`                | **Positive**: Verify minimal view access.<br>**Negative**: Verify 403 on details page.                        |
|               | `TEST_CASE.VIEW_ALL`                  | **Positive**: Verify full view access (already partially covered, will reinforce).                            |
|               | `TEST_CASE.EDIT_ALL`                  | **Covered**: Existing `Permission.spec.ts`.                                                                   |
|               | `VIEW_TEST_CASE_FAILED_ROWS_SAMPLE`   | **Positive**: User sees sample data grid.<br>**Negative**: User sees "No Permission" or masked data.          |
|               | `DELETE_TEST_CASE_FAILED_ROWS_SAMPLE` | **Positive**: User can delete sample data.<br>**Negative**: User sees no delete option/403.                   |
| **TestSuite** | `TEST_SUITE.CREATE`                   | **Positive**: User creates Logical Test Suite.<br>**Negative**: API 403.                                      |
|               | `TEST_SUITE.DELETE`                   | **Positive**: User deletes Logical Test Suite.<br>**Negative**: API 403.                                      |
|               | `TEST_SUITE.EDIT_ALL`                 | **Positive**: User updates Logical Test Suite description.<br>**Negative**: API 403.                          |
| **Table**     | `TABLE.CREATE_TESTS`                  | **Positive**: User with **only** `TABLE.CREATE_TESTS` (no `TEST_CASE.CREATE`) can add tests to that table.    |

## 4. Implementation Steps

### 4.1 New Test File

**File**: `openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/DataQualityPermissions.spec.ts`

### 4.2 Test Structure

1.  **BeforeAll**:
    - Perform Admin Login.
    - Create standard users: `DataConsumerUser`, `DataStewardUser`.
    - Create custom roles/policies: `CreateOnlyRole`, `DeleteOnlyRole`, `SuiteManagerRole`, `FailedRowsRole`.
    - Prepare Test Data: 1 Table, 1 Test Case.
2.  **Tests**:
    - `describe('Admin Control')`: Verify full admin access.
    - `describe('Standard Roles')`: Verify restrictions for Consumer/Steward.
    - `describe('Granular Permissions')`: Verify custom policy scenarios (positive/negative).
3.  **AfterAll**:
    - Cleanup users, roles, policies, and test data.

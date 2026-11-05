[🏠 Home](./README.md) > **Governance**

# Governance

> **8 Components** | **94 Files** | **858 Tests** | **1566 Scenarios** 🚀

## Table of Contents
- [Workflows](#workflows)
- [Tags](#tags)
- [Glossary](#glossary)
- [General](#general)
- [Metrics](#metrics)
- [Domains & Data Products](#domains-data-products)
- [Data Contracts](#data-contracts)
- [Knowledge Center](#knowledge-center)

---

<div id="workflows"></div>

## Workflows

<details open>
<summary>📄 <b>WorkflowOssRestrictions.spec.ts</b> (23 tests, 23 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Workflows/WorkflowOssRestrictions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Workflows/WorkflowOssRestrictions.spec.ts)

### OSS Workflow Capabilities

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **OSS Workflow Capabilities** - create-workflow-button absent on OSS | Create-workflow-button absent on OSS |
| 2 | **OSS Workflow Capabilities** - edit-workflow-button visible; delete-workflow-button and run-workflow-button absent | Edit-workflow-button visible; delete-workflow-button and run-workflow-button absent |
| 3 | **OSS Workflow Capabilities** - clicking a node in view mode opens read-only config sidebar (no save or delete buttons) | Clicking a node in view mode opens read-only config sidebar (no save or delete buttons) |
| 4 | **OSS Workflow Capabilities** - workflow-node-sidebar (node palette) not rendered in edit mode | Workflow-node-sidebar (node palette) not rendered in edit mode |
| 5 | **OSS Workflow Capabilities** - graph canvas contains workflow nodes | Graph canvas contains workflow nodes |
| 6 | **OSS Workflow Capabilities** - save, cancel, and validate buttons visible; delete absent in edit mode | Save, cancel, and validate buttons visible; delete absent in edit mode |
| 7 | **OSS Workflow Capabilities** - cancel workflow opens confirmation modal; close-without-saving returns to view mode | Cancel workflow opens confirmation modal; close-without-saving returns to view mode |
| 8 | **OSS Workflow Capabilities** - task node config sidebar opens and save button is enabled | Task node config sidebar opens and save button is enabled |
| 9 | **OSS Workflow Capabilities** - delete-node-button absent in node config sidebar (structural edit blocked) | Delete-node-button absent in node config sidebar (structural edit blocked) |
| 10 | **OSS Workflow Capabilities** - save-node-configuration-button closes sidebar (local state update) | Save-node-configuration-button closes sidebar (local state update) |
| 11 | **OSS Workflow Capabilities** - editing a form field and saving node config then workflow fires PUT API with updated data | Editing a form field and saving node config then workflow fires PUT API with updated data |
| 12 | **OSS Workflow Capabilities** - save-workflow-button fires PUT API and returns to view mode | Save-workflow-button fires PUT API and returns to view mode |
| 13 | **OSS Workflow Capabilities** - workflow-name-input is disabled in OSS | Workflow-name-input is disabled in OSS |
| 14 | **OSS Workflow Capabilities** - workflow-description-input is enabled in OSS | Workflow-description-input is enabled in OSS |
| 15 | **OSS Workflow Capabilities** - data-asset selector is disabled in OSS | Data-asset selector is disabled in OSS |
| 16 | **OSS Workflow Capabilities** - trigger-type-select is disabled in OSS | Trigger-type-select is disabled in OSS |
| 17 | **OSS Workflow Capabilities** - event-type-select is disabled in OSS | Event-type-select is disabled in OSS |
| 18 | **OSS Workflow Capabilities** - exclude-fields-select is enabled in OSS | Exclude-fields-select is enabled in OSS |
| 19 | **OSS Workflow Capabilities** - include-fields-select is enabled in OSS | Include-fields-select is enabled in OSS |
| 20 | **OSS Workflow Capabilities** - add-event-filter-button is enabled in OSS | Add-event-filter-button is enabled in OSS |
| 21 | **OSS Workflow Capabilities** - schedule-type-select is disabled in OSS | Schedule-type-select is disabled in OSS |
| 22 | **OSS Workflow Capabilities** - batch-size-input is enabled in OSS | Batch-size-input is enabled in OSS |
| 23 | **OSS Workflow Capabilities** - execution history tab loads and API call succeeds | Execution history tab loads and API call succeeds |

</details>

<details open>
<summary>📄 <b>WorkflowExecutionHistoryEntity.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Workflows/WorkflowExecutionHistoryEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Workflows/WorkflowExecutionHistoryEntity.spec.ts)

### Workflow Execution History — Entity column

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Workflow Execution History — Entity column** - renders a clickable entity link for instances with a related entity | Renders a clickable entity link for instances with a related entity |
| 2 | **Workflow Execution History — Entity column** - navigates to the entity detail page when the link is clicked | Navigates to the entity detail page when the link is clicked |
| 3 | **Workflow Execution History — Entity column** - shows the no-data placeholder for instances without a related entity | Shows the no-data placeholder for instances without a related entity |

</details>

<details open>
<summary>📄 <b>NoOpWorkflowNodeConfig.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Workflows/NoOpWorkflowNodeConfig.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Workflows/NoOpWorkflowNodeConfig.spec.ts)

### No-Op Workflow — schema-based node config

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **No-Op Workflow — schema-based node config** - schema fields for runAppTask node render with correct labels and values | Schema fields for runAppTask node render with correct labels and values |
| 2 | **No-Op Workflow — schema-based node config** - schema fields for runAppTask node are read-only | Schema fields for runAppTask node are read-only |

</details>

<details open>
<summary>📄 <b>ArticleReviewerWorkflow.spec.ts</b> (1 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ArticleReviewerWorkflow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ArticleReviewerWorkflow.spec.ts)

### User Approval Workflow - Context Center Article

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User Approval Workflow - Context Center Article** - Context Center article reviewer approval flow | Context Center article reviewer approval flow |
| | ↳ *Navigate to Context Center Article* | |
| | ↳ *Add reviewer to Article* | |
| | ↳ *Verify In Review status* | |
| | ↳ *Reviewer - Check notification and approve task* | |
| | ↳ *Verify Approved status* | |

</details>

<details open>
<summary>📄 <b>TaskCustomFormWorkflow.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Tasks/TaskCustomFormWorkflow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Tasks/TaskCustomFormWorkflow.spec.ts)

### Task Custom Form Workflow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Task Custom Form Workflow** - renders and resolves a workflow-driven custom task end to end | Renders and resolves a workflow-driven custom task end to end |

</details>


---

<div id="tags"></div>

## Tags

<details open>
<summary>📄 <b>Tag.spec.ts</b> (21 tests, 28 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts)

### Tag Page with Admin Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Admin Roles** - Verify Tag UI | Tag UI |
| 2 | **Tag Page with Admin Roles** - Certification Page should not have Asset button | Certification Page should not have Asset button |
| 3 | **Tag Page with Admin Roles** - Rename Tag name | Rename Tag name |
| 4 | **Tag Page with Admin Roles** - Restyle Tag | Restyle Tag |
| 5 | **Tag Page with Admin Roles** - Edit Tag Description | Edit Tag Description |
| 6 | **Tag Page with Admin Roles** - Delete a Tag | Delete a Tag |
| 7 | **Tag Page with Admin Roles** - Add and Remove Assets | Add and Remove Assets |
| | ↳ *Add Asset * | |
| | ↳ *Verify EntityType Filter* | |
| | ↳ *Delete Asset* | |
| 8 | **Tag Page with Admin Roles** - Create tag with domain | Create tag with domain |
| 9 | **Tag Page with Admin Roles** - Verify Owner Add Delete | Owner Add Delete |
| 10 | **Tag Page with Admin Roles** - Verify tag enable/disable toggle | Tag enable/disable toggle |
| 11 | **Tag Page with Admin Roles** - Tag toggle should be disabled when classification is disabled | Tag toggle should be disabled when classification is disabled |

### Tag Page with Data Consumer Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Data Consumer Roles** - Verify Tag UI for Data Consumer | Tag UI for Data Consumer |
| 2 | **Tag Page with Data Consumer Roles** - Certification Page should not have Asset button for Data Consumer | Certification Page should not have Asset button for Data Consumer |
| 3 | **Tag Page with Data Consumer Roles** - Edit Tag Description for Data Consumer | Edit Tag Description for Data Consumer |
| 4 | **Tag Page with Data Consumer Roles** - Add and Remove Assets for Data Consumer | Add and Remove Assets for Data Consumer |
| | ↳ *Add Asset * | |
| | ↳ *Verify EntityType Filter* | |
| | ↳ *Delete Asset* | |
| 5 | **Tag Page with Data Consumer Roles** - Tag toggle should be disabled for user without EditAll permission | Tag toggle should be disabled for user without EditAll permission |

### Tag Page with Data Steward Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Data Steward Roles** - Verify Tag UI for Data Steward | Tag UI for Data Steward |
| 2 | **Tag Page with Data Steward Roles** - Certification Page should not have Asset button for Data Steward | Certification Page should not have Asset button for Data Steward |
| 3 | **Tag Page with Data Steward Roles** - Edit Tag Description for Data Steward | Edit Tag Description for Data Steward |
| 4 | **Tag Page with Data Steward Roles** - Add and Remove Assets for Data Steward | Add and Remove Assets for Data Steward |
| | ↳ *Add Asset * | |
| | ↳ *Verify EntityType Filter* | |
| | ↳ *Delete Asset* | |

### Tag Page with Limited EditTag Permission

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Limited EditTag Permission** - Add and Remove Assets and Check Restricted Entity | Add and Remove Assets and Check Restricted Entity |
| | ↳ *Add Asset * | |
| | ↳ *Delete Asset* | |

</details>

<details open>
<summary>📄 <b>TagPageRightPanel.spec.ts</b> (11 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/TagPageRightPanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TagPageRightPanel.spec.ts)

### Tag Page Assets - Right Panel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page Assets - Right Panel** - Should open right panel when clicking asset in tag assets page | Open right panel when clicking asset in tag assets page |
| 2 | **Tag Page Assets - Right Panel** - Should display correct tabs for table entity in tag assets page context | Display correct tabs for table entity in tag assets page context |
| 3 | **Tag Page Assets - Right Panel** - Should edit description from tag assets page context | Edit description from tag assets page context |
| 4 | **Tag Page Assets - Right Panel** - Should display entity name link in panel header in tag assets page context | Display entity name link in panel header in tag assets page context |
| 5 | **Tag Page Assets - Right Panel** - Should display overview tab content in tag assets page context | Display overview tab content in tag assets page context |
| 6 | **Tag Page Assets - Right Panel** - Panel should not be visible before any asset is selected | Panel should not be visible before any asset is selected |
| 7 | **Tag Page Assets - Right Panel** - Should edit tags from tag assets page context | Edit tags from tag assets page context |
| 8 | **Tag Page Assets - Right Panel** - Should assign tier from tag assets page context | Assign tier from tag assets page context |
| 9 | **Tag Page Assets - Right Panel** - Should edit owners from tag assets page context | Edit owners from tag assets page context |
| 10 | **Tag Page Assets - Right Panel** - Should edit domain from tag assets page context | Edit domain from tag assets page context |
| 11 | **Tag Page Assets - Right Panel** - Should edit glossary terms from tag assets page context | Edit glossary terms from tag assets page context |

</details>

<details open>
<summary>📄 <b>TagsSuggestion.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts)

### Tag Task Workflows

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Task Workflows** - should add and accept requested tags for a table asset | Add and accept requested tags for a table asset |
| 2 | **Tag Task Workflows** - should edit and accept suggested tags for a table column | Edit and accept suggested tags for a table column |
| 3 | **Tag Task Workflows** - should add and accept requested tags for a topic schema field | Add and accept requested tags for a topic schema field |
| 4 | **Tag Task Workflows** - should add and accept requested tags for an api endpoint request schema field | Add and accept requested tags for an api endpoint request schema field |
| 5 | **Tag Task Workflows** - should edit and accept suggested tags for an api endpoint response schema field | Edit and accept suggested tags for an api endpoint response schema field |
| 6 | **Tag Task Workflows** - should decline requested tags for an api endpoint request schema field | Decline requested tags for an api endpoint request schema field |
| 7 | **Tag Task Workflows** - should decline suggested tags for a container column | Decline suggested tags for a container column |

</details>

<details open>
<summary>📄 <b>Tags.spec.ts</b> (6 tests, 14 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Classification Page | Classification Page |
| | ↳ *Should render basic elements on page* | |
| | ↳ *Disabled system tags should not render* | |
| | ↳ *Create classification with validation checks* | |
| | ↳ *Create tag with validation checks* | |
| | ↳ *Verify classification term count* | |
| | ↳ *Assign tag to table* | |
| | ↳ *Assign tag using Task & Suggestion flow to DatabaseSchema* | |
| | ↳ *Delete tag* | |
| | ↳ *Remove classification* | |
| 2 | Search tag using classification display name should work | Search tag using classification display name should work |
| 3 | Verify system classification term counts | System classification term counts |
| 4 | Verify Owner Add Delete | Owner Add Delete |
| 5 | Disabled tag should not allow adding assets from Assets tab | Disabled tag should not allow adding assets from Assets tab |
| 6 | Adds one tag and removes another in the same save preserves appliedBy on the kept tag | Adds one tag and removes another in the same save preserves appliedBy on the kept tag |

</details>

<details open>
<summary>📄 <b>ClassificationImportExport.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ClassificationImportExport.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ClassificationImportExport.spec.ts)

### Classification Import Export

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Classification Import Export** - user classification manage button offers import and export | User classification manage button offers import and export |
| 2 | **Classification Import Export** - system classification hides import and export | System classification hides import and export |
| 3 | **Classification Import Export** - export starts a CSV export job for the classification | Export starts a CSV export job for the classification |
| 4 | **Classification Import Export** - import navigates to the classification bulk import page | Import navigates to the classification bulk import page |

</details>

<details open>
<summary>📄 <b>ClassificationConditionalRendering.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ClassificationConditionalRendering.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ClassificationConditionalRendering.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Should show loader then render classification content on initial page load | Show loader then render classification content on initial page load |
| 2 | Should render all classification detail sections after loading | Render all classification detail sections after loading |
| 3 | Should render correct content when switching between classifications | Render correct content when switching between classifications |
| 4 | Should render classification correctly after page reload | Render classification correctly after page reload |

</details>

<details open>
<summary>📄 <b>SystemCertificationTags.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SystemCertificationTags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SystemCertificationTags.spec.ts)

### System Level Certification Tags

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **System Level Certification Tags** - should NOT show disabled system certification tag in dropdown | NOT show disabled system certification tag in dropdown |
| 2 | **System Level Certification Tags** - should NOT show any system certification tags when classification is disabled | NOT show any system certification tags when classification is disabled |
| 3 | **System Level Certification Tags** - should show certifications after re-enabling classification | Show certifications after re-enabling classification |

</details>

<details open>
<summary>📄 <b>ClassificationTagUsage.spec.ts</b> (2 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ClassificationTagUsage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ClassificationTagUsage.spec.ts)

### Classification tag usage counts

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Classification tag usage counts** - shows how many assets carry each tag without opening them | Shows how many assets carry each tag without opening them |
| 2 | **Classification tag usage counts** - opens the tagged assets from the usage count | Opens the tagged assets from the usage count |
| | ↳ *Open the classification* | |
| | ↳ *Follow the count through to the assets* | |

</details>

<details open>
<summary>📄 <b>EditClassification.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/EditClassification.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EditClassification.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Edit a user classification from the manage button | Edit a user classification from the manage button |
| 2 | System classification name is disabled in the edit drawer | System classification name is disabled in the edit drawer |

</details>

<details open>
<summary>📄 <b>MutuallyExclusiveColumnTags.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Should show error toast when adding mutually exclusive tags to column | Show error toast when adding mutually exclusive tags to column |

</details>

<details open>
<summary>📄 <b>AutoClassification.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/nightly/AutoClassification.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/AutoClassification.spec.ts)

### Auto Classification

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Auto Classification** - should be able to auto classify data | Be able to auto classify data |

</details>

<details open>
<summary>📄 <b>ClassificationVersionPage.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Classification version page | Classification version page |

</details>


---

<div id="glossary"></div>

## Glossary

<details open>
<summary>📄 <b>Glossary.spec.ts</b> (45 tests, 70 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Glossary.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Glossary.spec.ts)

### Glossary tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary tests** - Glossary & terms creation for reviewer as user | Glossary & terms creation for reviewer as user |
| | ↳ *Create Glossary* | |
| | ↳ *Create Glossary Terms* | |
| | ↳ *Approve Glossary Term from Glossary Listing for reviewer user* | |
| 2 | **Glossary tests** - Glossary & terms creation for reviewer as team | Glossary & terms creation for reviewer as team |
| | ↳ *Create Glossary* | |
| | ↳ *Create Glossary Terms* | |
| | ↳ *Approve Glossary Term from Glossary Listing for reviewer team* | |
| 3 | **Glossary tests** - Update Glossary and Glossary Term | Update Glossary and Glossary Term |
| | ↳ *Update Glossary* | |
| | ↳ *Update Glossary Term* | |
| 4 | **Glossary tests** - Add, Update and Verify Data Glossary Term | Add, Update and Verify Data Glossary Term |
| 5 | **Glossary tests** - Approve and reject glossary term from Glossary Listing | Approve and reject glossary term from Glossary Listing |
| | ↳ *Create Glossary and Terms* | |
| | ↳ *Approve and Reject Glossary Term* | |
| 6 | **Glossary tests** - Add and Remove Assets | Add and Remove Assets |
| | ↳ *Add asset to glossary term using entity* | |
| 7 | **Glossary tests** - Rename Glossary Term and verify assets | Rename Glossary Term and verify assets |
| | ↳ *Assign Glossary Term to table column* | |
| | ↳ *Rename Glossary Term* | |
| | ↳ *Verify the entity page by clicking on asset* | |
| | ↳ *Rename the same entity again* | |
| 8 | **Glossary tests** - Verify asset selection modal filters are shown upfront | Asset selection modal filters are shown upfront |
| | ↳ *Verify filters are visible upfront and can be applied* | |
| 9 | **Glossary tests** - Drag and Drop Glossary Term | Drag and Drop Glossary Term |
| | ↳ *Drag and Drop Glossary Term* | |
| | ↳ *Drag and Drop Glossary Term back at parent level* | |
| 10 | **Glossary tests** - Drag and Drop Glossary Term Approved Terms having reviewer | Drag and Drop Glossary Term Approved Terms having reviewer |
| | ↳ *Update Glossary Term Reviewer* | |
| | ↳ *Drag and Drop Glossary Term* | |
| 11 | **Glossary tests** - Change glossary term hierarchy using menu options | Change glossary term hierarchy using menu options |
| 12 | **Glossary tests** - Change glossary term hierarchy using menu options across glossary | Change glossary term hierarchy using menu options across glossary |
| | ↳ *Delete glossary to verify broken relation* | |
| 13 | **Glossary tests** - Assign Glossary Term to entity and check assets | Assign Glossary Term to entity and check assets |
| 14 | **Glossary tests** - Request description task for Glossary | Request description task for Glossary |
| 15 | **Glossary tests** - Request description task for Glossary Term | Request description task for Glossary Term |
| 16 | **Glossary tests** - Request tags for Glossary | Request tags for Glossary |
| 17 | **Glossary tests** - Delete Glossary and Glossary Term using Delete Modal | Delete Glossary and Glossary Term using Delete Modal |
| 18 | **Glossary tests** - Async Delete - single delete success | Async Delete - single delete success |
| 19 | **Glossary tests** - Async Delete - WebSocket failure triggers recovery | Async Delete - WebSocket failure triggers recovery |
| 20 | **Glossary tests** - Async Delete - multiple deletes all succeed | Async Delete - multiple deletes all succeed |
| 21 | **Glossary tests** - Async Delete - multiple deletes with mixed results | Async Delete - multiple deletes with mixed results |
| 22 | **Glossary tests** - Verify Expand All For Nested Glossary Terms | Expand All For Nested Glossary Terms |
| 23 | **Glossary tests** - Column selection and visibility for Glossary Terms table | Column selection and visibility for Glossary Terms table |
| | ↳ *Open column dropdown and select columns and check if they are visible* | |
| | ↳ *Open column dropdown and deselect columns and check if they are hidden* | |
| | ↳ *View All columns selection* | |
| | ↳ *Hide All columns selection* | |
| 24 | **Glossary tests** - Glossary Terms Table Status filtering | Glossary Terms Table Status filtering |
| | ↳ *Deselect status and check if the table has filtered rows* | |
| | ↳ *Re-select the status and check if it appears again* | |
| 25 | **Glossary tests** - Column dropdown drag-and-drop functionality for Glossary Terms table | Column dropdown drag-and-drop functionality for Glossary Terms table |
| 26 | **Glossary tests** - Glossary Term Update in Glossary Page should persist tree | Glossary Term Update in Glossary Page should persist tree |
| 27 | **Glossary tests** - Add Glossary Term inside another Term | Add Glossary Term inside another Term |
| 28 | **Glossary tests** - Check for duplicate Glossary Term | For duplicate Glossary Term |
| | ↳ *Create Glossary Term One* | |
| | ↳ *Create Glossary Term Two* | |
| 29 | **Glossary tests** - Check for duplicate Glossary Term with Glossary having dot in name | For duplicate Glossary Term with Glossary having dot in name |
| | ↳ *Create Glossary Term One* | |
| | ↳ *Create Glossary Term Two* | |
| 30 | **Glossary tests** - Verify Glossary Deny Permission | Glossary Deny Permission |
| 31 | **Glossary tests** - Verify Glossary Term Deny Permission | Glossary Term Deny Permission |
| 32 | **Glossary tests** - Term should stay approved when changes made by reviewer | Term should stay approved when changes made by reviewer |
| | ↳ *Navigate to glossary and verify workflow widget* | |
| | ↳ *Perform Changes by reviewer* | |
| 33 | **Glossary tests** - Glossary creation with domain selection | Glossary creation with domain selection |
| | ↳ *Create domain* | |
| | ↳ *Navigate to Glossary page* | |
| | ↳ *Open Add Glossary form* | |
| | ↳ *Save glossary and verify creation with domain* | |
| 34 | **Glossary tests** - Create glossary, change language to Dutch, and delete glossary | Create glossary, change language to Dutch, and delete glossary |
| | ↳ *Create Glossary via API* | |
| | ↳ *Navigate to Glossary page* | |
| | ↳ *Change application language to German* | |
| | ↳ *Open delete modal and verify delete confirmation* | |
| | ↳ *Change language back to English* | |
| 35 | **Glossary tests** - should handle glossary after description is deleted | Tests that verify UI handles entities with deleted descriptions gracefully. The issue occurs when: 1. An entity is created with a description 2. The description is later deleted/cleared via API patch 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL)) 4. UI should handle this gracefully instead of crashing |
| 36 | **Glossary tests** - should handle glossary term after description is deleted | Handle glossary term after description is deleted |
| 37 | **Glossary tests** - Create glossary with all optional fields (tags, owners, reviewers, domain) | Create glossary with all optional fields (tags, owners, reviewers, domain) |
| 38 | **Glossary tests** - Create glossary term via row action (+) button | Create glossary term via row action (+) button |
| 39 | **Glossary tests** - Create term with synonyms during creation | Create term with synonyms during creation |
| 40 | **Glossary tests** - Create term with references during creation | Create term with references during creation |
| 41 | **Glossary tests** - Create term with related terms, tags and owners during creation | Create term with related terms, tags and owners during creation |
| 42 | **Glossary tests** - Update glossary term display name via edit modal | Update glossary term display name via edit modal |
| 43 | **Glossary tests** - Update glossary display name via rename modal | Update glossary display name via rename modal |
| 44 | **Glossary tests** - Cancel glossary delete operation | Cancel glossary delete operation |
| 45 | **Glossary tests** - Cancel glossary term delete operation | Cancel glossary term delete operation |

</details>

<details open>
<summary>📄 <b>GlossaryAdvancedOperations.spec.ts</b> (28 tests, 28 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryAdvancedOperations.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryAdvancedOperations.spec.ts)

### Glossary Advanced Operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Advanced Operations** - should create glossary with mutually exclusive toggle OFF | Create glossary with mutually exclusive toggle OFF |
| 2 | **Glossary Advanced Operations** - should create glossary with mutually exclusive toggle ON | Create glossary with mutually exclusive toggle ON |
| 3 | **Glossary Advanced Operations** - should create glossary with multiple owners (users + teams) | Create glossary with multiple owners (users + teams) |
| 4 | **Glossary Advanced Operations** - should replace owner on glossary | Replace owner on glossary |
| 5 | **Glossary Advanced Operations** - should replace reviewer on glossary | Replace reviewer on glossary |
| 6 | **Glossary Advanced Operations** - should remove domain from glossary | Remove domain from glossary |
| 7 | **Glossary Advanced Operations** - should change domain on glossary | Change domain on glossary |
| 8 | **Glossary Advanced Operations** - should create term with custom style color | Create term with custom style color |
| 9 | **Glossary Advanced Operations** - should create term with custom style icon URL | Create term with custom style icon URL |
| 10 | **Glossary Advanced Operations** - should create term with an icon picked from the picker grid | Create term with an icon picked from the picker grid |
| 11 | **Glossary Advanced Operations** - should update term style to set color | Update term style to set color |
| 12 | **Glossary Advanced Operations** - should update term style to set icon URL | Update term style to set icon URL |
| 13 | **Glossary Advanced Operations** - should clear all synonyms from term | Clear all synonyms from term |
| 14 | **Glossary Advanced Operations** - should edit reference name | Edit reference name |
| 15 | **Glossary Advanced Operations** - should edit reference URL | Edit reference URL |
| 16 | **Glossary Advanced Operations** - should remove individual reference from term | Remove individual reference from term |
| 17 | **Glossary Advanced Operations** - should remove related term | Remove related term |
| 18 | **Glossary Advanced Operations** - should remove owner from term | Remove owner from term |
| 19 | **Glossary Advanced Operations** - should remove reviewer from term | Remove reviewer from term |
| 20 | **Glossary Advanced Operations** - should create term with related terms | Create term with related terms |
| 21 | **Glossary Advanced Operations** - should remove tags from term | Remove tags from term |
| 22 | **Glossary Advanced Operations** - should cancel glossary creation without saving | Cancel glossary creation without saving |
| 23 | **Glossary Advanced Operations** - should cancel term creation without saving | Cancel term creation without saving |
| 24 | **Glossary Advanced Operations** - should update term display name via manage menu | Update term display name via manage menu |
| 25 | **Glossary Advanced Operations** - should handle term with very long name | Handle term with very long name |
| 26 | **Glossary Advanced Operations** - should handle term with very long description | Handle term with very long description |
| 27 | **Glossary Advanced Operations** - should show error when glossary name exceeds limit | Show error when glossary name exceeds limit |
| 28 | **Glossary Advanced Operations** - should show error when term name exceeds limit | Show error when term name exceeds limit |

</details>

<details open>
<summary>📄 <b>GlossaryP3Tests.spec.ts</b> (20 tests, 20 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryP3Tests.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryP3Tests.spec.ts)

### Glossary P3 Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary P3 Tests** - should create glossary with special characters in name | Create glossary with special characters in name |
| 2 | **Glossary P3 Tests** - should create glossary with unicode characters in name | Create glossary with unicode characters in name |
| 3 | **Glossary P3 Tests** - should remove color style from term via API | Remove color style from term via API |
| 4 | **Glossary P3 Tests** - should remove icon style from term via API | Remove icon style from term via API |
| 5 | **Glossary P3 Tests** - should handle special characters in search | Handle special characters in search |
| 6 | **Glossary P3 Tests** - should display vote count correctly | Display vote count correctly |
| 7 | **Glossary P3 Tests** - should handle back/forward browser navigation | Handle back/forward browser navigation |
| 8 | **Glossary P3 Tests** - should show loading state during navigation | Show loading state during navigation |
| 9 | **Glossary P3 Tests** - should toggle right panel if available | Toggle right panel if available |
| 10 | **Glossary P3 Tests** - should handle special characters and unicode in term fields | Handle special characters and unicode in term fields |
| 11 | **Glossary P3 Tests** - should handle concurrent edits gracefully | Handle concurrent edits gracefully |
| 12 | **Glossary P3 Tests** - should handle slow network gracefully | Handle slow network gracefully |
| 13 | **Glossary P3 Tests** - should maintain session during normal operations | Maintain session during normal operations |
| 14 | **Glossary P3 Tests** - should handle deep nesting | Handle deep nesting |
| 15 | **Glossary P3 Tests** - should handle rapid UI interactions | Handle rapid UI interactions |
| 16 | **Glossary P3 Tests** - should handle multiple rapid API calls | Handle multiple rapid API calls |
| 17 | **Glossary P3 Tests** - should show error state when navigating to non-existent glossary | Show error state when navigating to non-existent glossary |
| 18 | **Glossary P3 Tests** - should show error state when navigating to non-existent term | Show error state when navigating to non-existent term |
| 19 | **Glossary P3 Tests** - should validate reference URL requires http/https prefix when creating term | Validate reference URL requires http/https prefix when creating term |
| 20 | **Glossary P3 Tests** - should validate reference URL requires http/https prefix when editing term | Validate reference URL requires http/https prefix when editing term |

</details>

<details open>
<summary>📄 <b>GlossaryRelationsGraph.spec.ts</b> (17 tests, 17 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryRelationsGraph.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryRelationsGraph.spec.ts)

### Glossary — Relations Graph tab

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary — Relations Graph tab** - Relations Graph tab renders the ontology explorer for a glossary with related terms | Relations Graph tab renders the ontology explorer for a glossary with related terms |
| 2 | **Glossary — Relations Graph tab** - related terms from the glossary appear as nodes in the Relations Graph | Related terms from the glossary appear as nodes in the Relations Graph |
| 3 | **Glossary — Relations Graph tab** - an edge with the correct relationType exists between the related terms | An edge with the correct relationType exists between the related terms |
| 4 | **Glossary — Relations Graph tab** - isolated term within the same glossary IS shown in the Relations Graph by default | Isolated term within the same glossary IS shown in the Relations Graph by default |
| 5 | **Glossary — Relations Graph tab** - cross-glossary related term appears as a node in the glossary Relations Graph | Cross-glossary related term appears as a node in the glossary Relations Graph |
| 6 | **Glossary — Relations Graph tab** - cross-glossary related term has an edge to the term in the viewed glossary | Cross-glossary related term has an edge to the term in the viewed glossary |
| 7 | **Glossary — Relations Graph tab** - term from an unrelated glossary is NOT shown in the Relations Graph | Term from an unrelated glossary is NOT shown in the Relations Graph |
| 8 | **Glossary — Relations Graph tab** - clicking a node in the Relations Graph opens the entity summary panel | Clicking a node in the Relations Graph opens the entity summary panel |
| 9 | **Glossary — Relations Graph tab** - search in the Relations Graph filters to the matching node and its neighbours | Search in the Relations Graph filters to the matching node and its neighbours |
| 10 | **Glossary — Relations Graph tab** - search returns empty state when no term matches the query | Search returns empty state when no term matches the query |
| 11 | **Glossary — Relations Graph tab** - global filter toolbar is NOT shown in glossary scope | Global filter toolbar is NOT shown in glossary scope |
| 12 | **Glossary — Relations Graph tab** - zoom and fit-view controls are visible in glossary scope | Zoom and fit-view controls are visible in glossary scope |
| 13 | **Glossary — Relations Graph tab** - nested child term appears as a node in the glossary Relations Graph | Nested child term appears as a node in the glossary Relations Graph |
| 14 | **Glossary — Relations Graph tab** - a parentOf edge exists between a parent term and its child in the Relations Graph | A parentOf edge exists between a parent term and its child in the Relations Graph |
| 15 | **Glossary — Relations Graph tab** - deeply nested grandchild term appears as a node in the glossary Relations Graph | Deeply nested grandchild term appears as a node in the glossary Relations Graph |
| 16 | **Glossary — Relations Graph tab** - cross-glossary term related to a nested child appears as a node in the glossary Relations Graph | Cross-glossary term related to a nested child appears as a node in the glossary Relations Graph |
| 17 | **Glossary — Relations Graph tab** - an edge exists between a nested child and its cross-glossary related term | An edge exists between a nested child and its cross-glossary related term |

</details>

<details open>
<summary>📄 <b>GlossaryStatusFilterLargeDataset.spec.ts</b> (17 tests, 17 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryStatusFilterLargeDataset.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryStatusFilterLargeDataset.spec.ts)

### Glossary Status Filter - Large Dataset

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Status Filter - Large Dataset** - should display only Draft terms when filtered | Display only Draft terms when filtered |
| 2 | **Glossary Status Filter - Large Dataset** - should display only Approved terms when filtered | Display only Approved terms when filtered |
| 3 | **Glossary Status Filter - Large Dataset** - should display only In Review terms when filtered | Display only In Review terms when filtered |
| 4 | **Glossary Status Filter - Large Dataset** - should display only Deprecated terms when filtered | Display only Deprecated terms when filtered |
| 5 | **Glossary Status Filter - Large Dataset** - should display only Rejected terms when filtered | Display only Rejected terms when filtered |
| 6 | **Glossary Status Filter - Large Dataset** - should display terms matching multiple selected statuses | Display terms matching multiple selected statuses |
| 7 | **Glossary Status Filter - Large Dataset** - should display all terms when All is selected | Display all terms when All is selected |
| 8 | **Glossary Status Filter - Large Dataset** - should maintain filter state across pagination | Maintain filter state across pagination |
| 9 | **Glossary Status Filter - Large Dataset** - should return matching terms for search query | Return matching terms for search query |
| 10 | **Glossary Status Filter - Large Dataset** - should show no results for non-matching query | Show no results for non-matching query |
| 11 | **Glossary Status Filter - Large Dataset** - should restore all terms when search is cleared | Restore all terms when search is cleared |
| 12 | **Glossary Status Filter - Large Dataset** - should paginate through search results | Paginate through search results |
| 13 | **Glossary Status Filter - Large Dataset** - should filter search results by selected status | Filter search results by selected status |
| 14 | **Glossary Status Filter - Large Dataset** - should paginate combined search and status results | Paginate combined search and status results |
| 15 | **Glossary Status Filter - Large Dataset** - should revert changes when Cancel is clicked | Revert changes when Cancel is clicked |
| 16 | **Glossary Status Filter - Large Dataset** - should reset pagination when filter changes | Reset pagination when filter changes |
| 17 | **Glossary Status Filter - Large Dataset** - should apply status filter within acceptable time | Apply status filter within acceptable time |

</details>

<details open>
<summary>📄 <b>GlossaryStatusFilterNestedTerms.spec.ts</b> (16 tests, 19 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryStatusFilterNestedTerms.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryStatusFilterNestedTerms.spec.ts)

### Glossary Status Filter - Nested Terms

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Status Filter - Nested Terms** - filter by parent status shows parent and allows expansion to see children | Filter by parent status shows parent and allows expansion to see children |
| 2 | **Glossary Status Filter - Nested Terms** - filter shows parent when status matches and all children on expand | Filter shows parent when status matches and all children on expand |
| 3 | **Glossary Status Filter - Nested Terms** - multiple status filter shows terms matching any selected status | Multiple status filter shows terms matching any selected status |
| 4 | **Glossary Status Filter - Nested Terms** - filter by grandparent status shows only approved terms | Filter by grandparent status shows only approved terms |
| 5 | **Glossary Status Filter - Nested Terms** - expanding grandparent shows parent with any status | Expanding grandparent shows parent with any status |
| 6 | **Glossary Status Filter - Nested Terms** - search for child term name + apply non-matching status filter shows no results | Search for child term name + apply non-matching status filter shows no results |
| 7 | **Glossary Status Filter - Nested Terms** - search for child term name + matching status shows child | Search for child term name + matching status shows child |
| 8 | **Glossary Status Filter - Nested Terms** - search for parent term name with child status filter shows no results | Search for parent term name with child status filter shows no results |
| 9 | **Glossary Status Filter - Nested Terms** - clearing search maintains status filter | Clearing search maintains status filter |
| 10 | **Glossary Status Filter - Nested Terms** - clearing status filter maintains search results | Clearing status filter maintains search results |
| 11 | **Glossary Status Filter - Nested Terms** - apply filter, expand parent, verify children shown | Apply filter, expand parent, verify children shown |
| 12 | **Glossary Status Filter - Nested Terms** - change filter while expanded updates visible root terms | Change filter while expanded updates visible root terms |
| 13 | **Glossary Status Filter - Nested Terms** - expand all button loads all terms | Expand all button loads all terms |
| 14 | **Glossary Status Filter - Nested Terms** - all children have same status different from parent | All children have same status different from parent |
| 15 | **Glossary Status Filter - Nested Terms** - only leaf nodes match filter - parent chain does not | Only leaf nodes match filter - parent chain does not |
| 16 | **Glossary Status Filter - Nested Terms** - Expand All shows all children regardless of status filter | Expand All shows all children regardless of status filter |
| | ↳ *Apply Draft filter and expand all* | |
| | ↳ *Verify MixedStatusChild (Draft) appears under ApprovedParent* | |
| | ↳ *Collapse all and verify filter re-applies* | |
| | ↳ *Switch to Approved filter and expand again* | |

</details>

<details open>
<summary>📄 <b>GlossaryTermRelationsGraph.spec.ts</b> (15 tests, 15 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryTermRelationsGraph.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryTermRelationsGraph.spec.ts)

### Glossary Term — Relations Graph tab

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Term — Relations Graph tab** - Relations Graph tab renders the ontology explorer for a term with a same-glossary relation | Relations Graph tab renders the ontology explorer for a term with a same-glossary relation |
| 2 | **Glossary Term — Relations Graph tab** - the term itself appears as a node in the Relations Graph | The term itself appears as a node in the Relations Graph |
| 3 | **Glossary Term — Relations Graph tab** - the directly related term appears as a node in the Relations Graph | The directly related term appears as a node in the Relations Graph |
| 4 | **Glossary Term — Relations Graph tab** - an edge with the correct relationType exists between the term and its related term | An edge with the correct relationType exists between the term and its related term |
| 5 | **Glossary Term — Relations Graph tab** - all relation types from the same term appear as separate edges | All relation types from the same term appear as separate edges |
| 6 | **Glossary Term — Relations Graph tab** - cross-glossary related term appears as a node in the Relations Graph | Cross-glossary related term appears as a node in the Relations Graph |
| 7 | **Glossary Term — Relations Graph tab** - cross-glossary related term has an edge to the viewed term | Cross-glossary related term has an edge to the viewed term |
| 8 | **Glossary Term — Relations Graph tab** - unrelated term from the same glossary is NOT shown in the Relations Graph | Unrelated term from the same glossary is NOT shown in the Relations Graph |
| 9 | **Glossary Term — Relations Graph tab** - a term with no relations shows only itself as a node with no edges | A term with no relations shows only itself as a node with no edges |
| 10 | **Glossary Term — Relations Graph tab** - clicking a node in the Relations Graph opens the entity summary panel | Clicking a node in the Relations Graph opens the entity summary panel |
| 11 | **Glossary Term — Relations Graph tab** - search in the Relations Graph filters to matching node and its neighbours | Search in the Relations Graph filters to matching node and its neighbours |
| 12 | **Glossary Term — Relations Graph tab** - search in the term Relations Graph returns empty state when no term matches | Search in the term Relations Graph returns empty state when no term matches |

### Glossary Term — Relations Graph (nested / parent-child)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Term — Relations Graph (nested / parent-child)** - viewing a child term: parent appears as a 1-hop neighbour via parentOf edge | Viewing a child term: parent appears as a 1-hop neighbour via parentOf edge |
| 2 | **Glossary Term — Relations Graph (nested / parent-child)** - viewing the parent term: child appears as a 1-hop neighbour via parentOf edge | Viewing the parent term: child appears as a 1-hop neighbour via parentOf edge |
| 3 | **Glossary Term — Relations Graph (nested / parent-child)** - viewing the parent term: parentOf edge is rendered between parent and child | Viewing the parent term: parentOf edge is rendered between parent and child |

</details>

<details open>
<summary>📄 <b>GlossaryMutualExclusivity.spec.ts</b> (11 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryMutualExclusivity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryMutualExclusivity.spec.ts)

### Glossary Mutual Exclusivity Feature

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Mutual Exclusivity Feature** - ME-R01: Children of ME parent should render checkboxes | ME-R01: Children of ME parent should render checkboxes |
| 2 | **Glossary Mutual Exclusivity Feature** - ME-S01: Selecting ME child should auto-deselect siblings | ME-S01: Selecting ME child should auto-deselect siblings |
| 3 | **Glossary Mutual Exclusivity Feature** - ME-S02: Can select multiple children under non-ME parent | ME-S02: Can select multiple children under non-ME parent |
| 4 | **Glossary Mutual Exclusivity Feature** - ME-S03: Can deselect currently selected ME term | ME-S03: Can deselect currently selected ME term |
| 5 | **Glossary Mutual Exclusivity Feature** - ME-S05: Mixed selection - ME siblings deselect, non-ME remain | ME-S05: Mixed selection - ME siblings deselect, non-ME remain |
| 6 | **Glossary Mutual Exclusivity Feature** - ME-T01: Apply single ME glossary term to table | ME-T01: Apply single ME glossary term to table |
| 7 | **Glossary Mutual Exclusivity Feature** - ME-T02: Apply ME term to table column via detail panel | ME-T02: Apply ME term to table column via detail panel |
| 8 | **Glossary Mutual Exclusivity Feature** - ME-H04: Toggle ME flag via edit after children exist | ME-H04: Toggle ME flag via edit after children exist |
| 9 | **Glossary Mutual Exclusivity Feature** - ME-H05: ME glossary (top level) children render checkboxes with ME behavior | ME-H05: ME glossary (top level) children render checkboxes with ME behavior |
| 10 | **Glossary Mutual Exclusivity Feature** - ME-H06: Deep nesting - non-ME parent under ME grandparent allows multi-select | ME-H06: Deep nesting - non-ME parent under ME grandparent allows multi-select |
| 11 | **Glossary Mutual Exclusivity Feature** - ME-H07: Non-ME parent under ME glossary allows multi-select for its children | ME-H07: Non-ME parent under ME glossary allows multi-select for its children |

</details>

<details open>
<summary>📄 <b>GlossaryWorkflow.spec.ts</b> (10 tests, 10 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryWorkflow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryWorkflow.spec.ts)

### Term Status Transitions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Term Status Transitions** - should start term as Approved when glossary has no reviewers | Start term as Approved when glossary has no reviewers |
| 2 | **Term Status Transitions** - should not auto-approve term when glossary has reviewers | Not auto-approve term when glossary has reviewers |
| 3 | **Term Status Transitions** - should inherit reviewers from glossary when term is created | Inherit reviewers from glossary when term is created |

### Workflow History

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Workflow History** - should show workflow history popover on status badge hover | Show workflow history popover on status badge hover |
| 2 | **Workflow History** - should view workflow history on term details page | View workflow history on term details page |

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | non-reviewer should not see approve/reject buttons | Non-reviewer should not see approve/reject buttons |
| 2 | should display correct status badge color and icon | Display correct status badge color and icon |
| 3 | owner should not see approve/reject buttons if not a reviewer | Owner should not see approve/reject buttons if not a reviewer |
| 4 | should change status when non-reviewer edits approved term | Change status when non-reviewer edits approved term |
| 5 | should delete parent term and cascade delete children | Delete parent term and cascade delete children |

</details>

<details open>
<summary>📄 <b>GlossaryTermRightPanel.spec.ts</b> (10 tests, 10 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/GlossaryTermRightPanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/GlossaryTermRightPanel.spec.ts)

### Glossary Term Assets Tab - Right Panel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Term Assets Tab - Right Panel** - Should open right panel when clicking asset in glossary term assets tab | Open right panel when clicking asset in glossary term assets tab |
| 2 | **Glossary Term Assets Tab - Right Panel** - Should display correct tabs for table entity in glossary term assets context | Display correct tabs for table entity in glossary term assets context |
| 3 | **Glossary Term Assets Tab - Right Panel** - Should edit description from glossary term assets context | Edit description from glossary term assets context |
| 4 | **Glossary Term Assets Tab - Right Panel** - Should display entity name link in panel header in glossary term assets context | Display entity name link in panel header in glossary term assets context |
| 5 | **Glossary Term Assets Tab - Right Panel** - Should display overview tab content in glossary term assets context | Display overview tab content in glossary term assets context |
| 6 | **Glossary Term Assets Tab - Right Panel** - Should edit tags from glossary term assets context | Edit tags from glossary term assets context |
| 7 | **Glossary Term Assets Tab - Right Panel** - Should assign tier from glossary term assets context | Assign tier from glossary term assets context |
| 8 | **Glossary Term Assets Tab - Right Panel** - Should edit owners from glossary term assets context | Edit owners from glossary term assets context |
| 9 | **Glossary Term Assets Tab - Right Panel** - Should edit domain from glossary term assets context | Edit domain from glossary term assets context |
| 10 | **Glossary Term Assets Tab - Right Panel** - Should edit glossary terms from glossary term assets context | Edit glossary terms from glossary term assets context |

</details>

<details open>
<summary>📄 <b>LargeGlossaryPerformance.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/LargeGlossaryPerformance.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/LargeGlossaryPerformance.spec.ts)

### Large Glossary Performance Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Large Glossary Performance Tests** - should handle large number of glossary terms with pagination | Handle large number of glossary terms with pagination |
| 2 | **Large Glossary Performance Tests** - should search and filter glossary terms | Search and filter glossary terms |
| 3 | **Large Glossary Performance Tests** - should expand and collapse all terms | Expand and collapse all terms |
| 4 | **Large Glossary Performance Tests** - should expand individual terms | Expand individual terms |
| 5 | **Large Glossary Performance Tests** - should maintain scroll position when loading more terms | Maintain scroll position when loading more terms |
| 6 | **Large Glossary Performance Tests** - should handle status filtering | Handle status filtering |
| 7 | **Large Glossary Performance Tests** - should show term count in glossary listing | Show term count in glossary listing |
| 8 | **Large Glossary Performance Tests** - should handle drag and drop for term reordering | Handle drag and drop for term reordering |

### Large Glossary Child Term Performace

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Large Glossary Child Term Performace** - should handle large number of glossary child term with pagination | Handle large number of glossary child term with pagination |

</details>

<details open>
<summary>📄 <b>GlossaryPermissions.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/GlossaryPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/GlossaryPermissions.spec.ts)

### Glossary Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Permissions** - Glossary allow operations | Glossary allow operations |
| 2 | **Glossary Permissions** - Glossary deny operations | Glossary deny operations |
| 3 | **Glossary Permissions** - EditDescription only permission | EditDescription only permission |
| 4 | **Glossary Permissions** - EditOwners only permission | EditOwners only permission |
| 5 | **Glossary Permissions** - EditTags only permission | EditTags only permission |
| 6 | **Glossary Permissions** - Delete only permission | Delete only permission |
| 7 | **Glossary Permissions** - Create only permission | Create only permission |
| 8 | **Glossary Permissions** - ViewBasic permission shows read-only access | ViewBasic permission shows read-only access |
| 9 | **Glossary Permissions** - Team-based permissions work correctly | Team-based permissions work correctly |

</details>

<details open>
<summary>📄 <b>GlossaryImportExport.spec.ts</b> (9 tests, 24 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/GlossaryImportExport.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/GlossaryImportExport.spec.ts)

### Glossary Bulk Import Export

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Bulk Import Export** - Glossary Bulk Import Export | Glossary Bulk Import Export |
| | ↳ *create custom properties for extension edit* | |
| | ↳ *should export data glossary term details* | |
| | ↳ *should import and edit with one additional glossaryTerm* | |
| | ↳ *should verify bulk import details in version history* | |
| | ↳ *delete custom properties* | |
| 2 | **Glossary Bulk Import Export** - Check for Circular Reference in Glossary Import | For Circular Reference in Glossary Import |
| | ↳ *Create glossary for circular reference test* | |
| | ↳ *Import initial glossary terms* | |
| | ↳ *Import CSV with circular reference and verify error* | |
| 3 | **Glossary Bulk Import Export** - Import validation - missing required fields | Import validation - missing required fields |
| | ↳ *Create glossary for validation test* | |
| | ↳ *Import CSV with missing required name field* | |
| 4 | **Glossary Bulk Import Export** - Import validation - invalid parent reference | Import validation - invalid parent reference |
| | ↳ *Create glossary for parent ref test* | |
| | ↳ *Import CSV with invalid parent reference* | |
| 5 | **Glossary Bulk Import Export** - Import partial success - some terms pass, some fail | Import partial success - some terms pass, some fail |
| | ↳ *Create glossary for partial success test* | |
| | ↳ *Import CSV with mixed valid and invalid terms* | |
| 6 | **Glossary Bulk Import Export** - Export large glossary with many terms | Export large glossary with many terms |
| | ↳ *Create glossary with many terms* | |
| | ↳ *Export glossary and verify all terms* | |
| 7 | **Glossary Bulk Import Export** - Export maintains hierarchy structure in CSV | Export maintains hierarchy structure in CSV |
| | ↳ *Create glossary with hierarchical terms* | |
| | ↳ *Export and verify hierarchy in CSV* | |
| 8 | **Glossary Bulk Import Export** - Glossary CSV import preserves typed relations | Glossary CSV import preserves typed relations |
| | ↳ *Create glossary and three target terms* | |
| | ↳ *Import CSV with synonym/relatedTo/narrower mix* | |
| | ↳ *Verify each relation type via API* | |
| | ↳ *Export and verify CSV emits relation type prefixes* | |
| 9 | **Glossary Bulk Import Export** - Glossary CSV import rejects unknown relation type | Glossary CSV import rejects unknown relation type |
| | ↳ *Create glossary and target term* | |
| | ↳ *Import CSV with invalid relation type and assert failure* | |

</details>

<details open>
<summary>📄 <b>GlossaryAssets.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryAssets.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryAssets.spec.ts)

### Glossary Asset Operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Asset Operations** - should add topic asset to glossary term | Add topic asset to glossary term |
| 2 | **Glossary Asset Operations** - should add pipeline asset to glossary term | Add pipeline asset to glossary term |
| 3 | **Glossary Asset Operations** - should open summary panel when clicking asset card | Open summary panel when clicking asset card |
| 4 | **Glossary Asset Operations** - should search within assets tab | Search within assets tab |
| 5 | **Glossary Asset Operations** - should remove asset from glossary term | Remove asset from glossary term |
| 6 | **Glossary Asset Operations** - should bulk select and remove multiple assets | Bulk select and remove multiple assets |
| 7 | **Glossary Asset Operations** - should add asset via Add Assets dropdown button | Add asset via Add Assets dropdown button |

</details>

<details open>
<summary>📄 <b>GlossaryHierarchy.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryHierarchy.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryHierarchy.spec.ts)

### Glossary Hierarchy

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Hierarchy** - should move nested term to root level of same glossary | Move nested term to root level of same glossary |
| 2 | **Glossary Hierarchy** - should drag nested term to root level of same glossary | Drag nested term to root level of same glossary |
| 3 | **Glossary Hierarchy** - should move term to root of different glossary | Move term to root of different glossary |
| 4 | **Glossary Hierarchy** - should move term with children to different glossary | Move term with children to different glossary |
| 5 | **Glossary Hierarchy** - should cancel move operation | Cancel move operation |
| 6 | **Glossary Hierarchy** - should navigate 5+ levels deep in hierarchy | Navigate 5+ levels deep in hierarchy |
| 7 | **Glossary Hierarchy** - should cancel drag and drop operation | Cancel drag and drop operation |

</details>

<details open>
<summary>📄 <b>GlossaryMutualExclusivityDataProductTree.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryMutualExclusivityDataProductTree.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryMutualExclusivityDataProductTree.spec.ts)

### Glossary Mutual Exclusivity Feature - Data Product Tree

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Mutual Exclusivity Feature - Data Product Tree** - ME-R01: Children of ME parent should render Radio buttons | ME-R01: Children of ME parent should render Radio buttons |
| 2 | **Glossary Mutual Exclusivity Feature - Data Product Tree** - ME-R02: Children of non-ME parent should render Checkboxes | ME-R02: Children of non-ME parent should render Checkboxes |
| 3 | **Glossary Mutual Exclusivity Feature - Data Product Tree** - ME-S01: Selecting ME child should auto-deselect siblings | ME-S01: Selecting ME child should auto-deselect siblings |
| 4 | **Glossary Mutual Exclusivity Feature - Data Product Tree** - ME-S02: Can select multiple children under non-ME parent | ME-S02: Can select multiple children under non-ME parent |
| 5 | **Glossary Mutual Exclusivity Feature - Data Product Tree** - ME-S03: Can deselect currently selected ME term | ME-S03: Can deselect currently selected ME term |
| 6 | **Glossary Mutual Exclusivity Feature - Data Product Tree** - ME-T01: Apply single ME glossary term and save Data Product | ME-T01: Apply single ME glossary term and save Data Product |
| 7 | **Glossary Mutual Exclusivity Feature - Data Product Tree** - ME-H01: ME glossary (top level) children render Radio with ME behavior | ME-H01: ME glossary (top level) children render Radio with ME behavior |

</details>

<details open>
<summary>📄 <b>GlossaryNavigation.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryNavigation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryNavigation.spec.ts)

### Glossary Navigation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Navigation** - should navigate between tabs on glossary page | Navigate between tabs on glossary page |
| 2 | **Glossary Navigation** - should navigate between tabs on glossary term page | Navigate between tabs on glossary term page |
| 3 | **Glossary Navigation** - should navigate via breadcrumbs | Navigate via breadcrumbs |
| 4 | **Glossary Navigation** - should navigate to nested term via deep link | Navigate to nested term via deep link |
| 5 | **Glossary Navigation** - should show empty state when glossary has no terms | Show empty state when glossary has no terms |
| 6 | **Glossary Navigation** - should view activity feed on glossary | View activity feed on glossary |
| 7 | **Glossary Navigation** - should view activity feed on glossary term | View activity feed on glossary term |

</details>

<details open>
<summary>📄 <b>GlossaryTermDetails.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryTermDetails.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryTermDetails.spec.ts)

### Glossary Term Details Operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Term Details Operations** - should add and remove synonyms from glossary term | Add and remove synonyms from glossary term |
| 2 | **Glossary Term Details Operations** - should add and remove references from glossary term | Add and remove references from glossary term |
| 3 | **Glossary Term Details Operations** - should add and remove related terms from glossary term | Add and remove related terms from glossary term |
| 4 | **Glossary Term Details Operations** - should keep multiple relation types for the same related term across reload | Keep multiple relation types for the same related term across reload |
| 5 | **Glossary Term Details Operations** - should verify bidirectional related term link | Bidirectional related term link |
| 6 | **Glossary Term Details Operations** - should edit term via pencil icon in table row | Edit term via pencil icon in table row |
| 7 | **Glossary Term Details Operations** - should create term with all optional fields populated | Create term with all optional fields populated |

</details>

<details open>
<summary>📄 <b>GlossaryTermRelationSettings.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/GlossaryTermRelationSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/GlossaryTermRelationSettings.spec.ts)

### Glossary Term Relation Settings

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Term Relation Settings** - creates a custom relation type via the drawer | Creates a custom relation type via the drawer |
| 2 | **Glossary Term Relation Settings** - edits a custom relation type and keeps the name immutable | Edits a custom relation type and keeps the name immutable |
| 3 | **Glossary Term Relation Settings** - rejects duplicate relation-type names and keeps the drawer open | Rejects duplicate relation-type names and keeps the drawer open |
| 4 | **Glossary Term Relation Settings** - deletes a custom relation type | Deletes a custom relation type |
| 5 | **Glossary Term Relation Settings** - locks system-defined relation types from edit and delete | Locks system-defined relation types from edit and delete |
| 6 | **Glossary Term Relation Settings** - paginates relation types when they exceed a page | Paginates relation types when they exceed a page |
| 7 | **Glossary Term Relation Settings** - parallel API writers both create relationship types | Parallel API writers both create relationship types |

</details>

<details open>
<summary>📄 <b>GlossaryVersionPage.spec.ts</b> (7 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/GlossaryVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/GlossaryVersionPage.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Glossary | Glossary |
| | ↳ *Version changes* | |
| | ↳ *Should display the owner & reviewer changes* | |
| 2 | GlossaryTerm | GlossaryTerm |
| | ↳ *Version changes* | |
| | ↳ *Should display the owner & reviewer changes* | |
| 3 | Navigate between versions | Navigate between versions |
| 4 | Return to current version from history | Return to current version from history |
| 5 | Version diff shows synonym changes | Version diff shows synonym changes |
| 6 | Version diff shows reference changes | Version diff shows reference changes |
| 7 | Version diff shows related term changes | Version diff shows related term changes |

</details>

<details open>
<summary>📄 <b>GlossaryPagination.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryPagination.spec.ts)

### Glossary tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary tests** - should check for glossary term search | For glossary term search |
| 2 | **Glossary tests** - should check for nested glossary term search | For nested glossary term search |
| 3 | **Glossary tests** - should perform case-insensitive search | Perform case-insensitive search |
| 4 | **Glossary tests** - should show empty state when search returns no results | Show empty state when search returns no results |
| 5 | **Glossary tests** - should filter by InReview status | Filter by InReview status |
| 6 | **Glossary tests** - should filter by multiple statuses | Filter by multiple statuses |

</details>

<details open>
<summary>📄 <b>GlossaryRemoveOperations.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryRemoveOperations.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryRemoveOperations.spec.ts)

### Glossary Remove Operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Remove Operations** - should add and remove owner from glossary | Add and remove owner from glossary |
| 2 | **Glossary Remove Operations** - should add and remove reviewer from glossary | Add and remove reviewer from glossary |
| 3 | **Glossary Remove Operations** - should add and remove owner from glossary term | Add and remove owner from glossary term |
| 4 | **Glossary Remove Operations** - should add and remove reviewer from glossary term | Add and remove reviewer from glossary term |
| 5 | **Glossary Remove Operations** - should add and remove tags from glossary | Add and remove tags from glossary |
| 6 | **Glossary Remove Operations** - should add and remove tags from glossary term | Add and remove tags from glossary term |

</details>

<details open>
<summary>📄 <b>GlossaryTermRelatedTerms.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryTermRelatedTerms.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryTermRelatedTerms.spec.ts)

### Glossary Term — Related Terms

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Term — Related Terms** - should add multiple different target terms in a single save | Add multiple different target terms in a single save |
| 2 | **Glossary Term — Related Terms** - should edit the relation type of an existing related term | Edit the relation type of an existing related term |
| 3 | **Glossary Term — Related Terms** - should delete a specific relation while keeping others | Delete a specific relation while keeping others |
| 4 | **Glossary Term — Related Terms** - should add three relations to a single term and persist all after reload | Add three relations to a single term and persist all after reload |
| 5 | **Glossary Term — Related Terms** - should add Related To, Narrower, and Has Part to the same target term and persist all after reload | Add Related To, Narrower, and Has Part to the same target term and persist all after reload |
| 6 | **Glossary Term — Related Terms** - should reveal the related terms hidden behind the overflow toggle | Reveal the related terms hidden behind the overflow toggle |

</details>

<details open>
<summary>📄 <b>GlossaryMiscOperations.spec.ts</b> (5 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryMiscOperations.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryMiscOperations.spec.ts)

### Glossary Miscellaneous Operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Miscellaneous Operations** - should delete glossary and remove tags from assets | Delete glossary and remove tags from assets |
| 2 | **Glossary Miscellaneous Operations** - should update child FQN when parent is renamed | Update child FQN when parent is renamed |
| 3 | **Glossary Miscellaneous Operations** - should delete term and remove tag from assets | Delete term and remove tag from assets |
| 4 | **Glossary Miscellaneous Operations** - should delete parent term and remove both parent and child tags from assets | Delete parent term and remove both parent and child tags from assets |
| 5 | **Glossary Miscellaneous Operations** - should not allow dragging term to itself | Not allow dragging term to itself |

</details>

<details open>
<summary>📄 <b>GlossaryFormValidation.spec.ts</b> (5 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/GlossaryFormValidation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/GlossaryFormValidation.spec.ts)

### Glossary Form Validation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Form Validation** - should show error when glossary name is empty | Show error when glossary name is empty |
| 2 | **Glossary Form Validation** - should show error when glossary description is empty | Show error when glossary description is empty |
| 3 | **Glossary Form Validation** - should show error when creating glossary with duplicate name | Show error when creating glossary with duplicate name |
| 4 | **Glossary Form Validation** - should show error when term name is empty | Show error when term name is empty |
| 5 | **Glossary Form Validation** - should show error when term description is empty | Show error when term description is empty |

</details>

<details open>
<summary>📄 <b>GlossaryTermInverseRelation.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryTermInverseRelation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryTermInverseRelation.spec.ts)

### Glossary Term — Inverse Relation Display (#29687)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Term — Inverse Relation Display (#29687)** - source term shows the authored relation type | Source term shows the authored relation type |
| 2 | **Glossary Term — Inverse Relation Display (#29687)** - target term shows the inverse relation type | Target term shows the inverse relation type |
| 3 | **Glossary Term — Inverse Relation Display (#29687)** - inverse relation type persists after page reload | Inverse relation type persists after page reload |
| 4 | **Glossary Term — Inverse Relation Display (#29687)** - hasPart and partOf show on opposite sides of the relation | HasPart and partOf show on opposite sides of the relation |

</details>

<details open>
<summary>📄 <b>GlossaryBulkAssetPermissions.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryBulkAssetPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryBulkAssetPermissions.spec.ts)

### Glossary Term Bulk Asset Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Term Bulk Asset Permissions** - view-only user cannot bulk remove the term from an asset | View-only user cannot bulk remove the term from an asset |
| 2 | **Glossary Term Bulk Asset Permissions** - view-only user cannot bulk add the term to an asset | View-only user cannot bulk add the term to an asset |
| 3 | **Glossary Term Bulk Asset Permissions** - admin can bulk remove and re-add the term | Admin can bulk remove and re-add the term |

</details>

<details open>
<summary>📄 <b>GlossaryPersonaCustomization.spec.ts</b> (3 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryPersonaCustomization.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryPersonaCustomization.spec.ts)

### Glossary persona customization

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary persona customization** - Customize UI lists every documented Glossary Term tab including Relations Graph | Customize UI lists every documented Glossary Term tab including Relations Graph |
| 2 | **Glossary persona customization** - Customize UI lists Relations Graph at the Glossary parent level | Customize UI lists Relations Graph at the Glossary parent level |
| 3 | **Glossary persona customization** - Saving a persona Glossary Term customization keeps Relations Graph visible on the term page | Saving a persona Glossary Term customization keeps Relations Graph visible on the term page |
| | ↳ *open Glossary Term customize UI and save without touching tabs* | |
| | ↳ *visit glossary term as persona user and assert all tabs render* | |
| | ↳ *Relations Graph tab is clickable and opens the ontology explorer* | |

</details>

<details open>
<summary>📄 <b>GlossaryVoting.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryVoting.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryVoting.spec.ts)

### Glossary Voting

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Voting** - should upvote, downvote, and remove vote on glossary | Upvote, downvote, and remove vote on glossary |
| 2 | **Glossary Voting** - should upvote, downvote, and remove vote on glossary term | Upvote, downvote, and remove vote on glossary term |
| 3 | **Glossary Voting** - should persist vote after page reload | Persist vote after page reload |

</details>

<details open>
<summary>📄 <b>ColumnBulkOperationsTagsGlossary.spec.ts</b> (2 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ColumnBulkOperationsTagsGlossary.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ColumnBulkOperationsTagsGlossary.spec.ts)

### Column Bulk Operations - Tags & Glossary Select in Drawer

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Column Bulk Operations - Tags & Glossary Select in Drawer** - should select a classification tag from the dropdown inside the drawer | Select a classification tag from the dropdown inside the drawer |
| | ↳ *Open the tags dropdown and search* | |
| | ↳ *Option renders inside the drawer top layer* | |
| | ↳ *Clicking the option selects the tag* | |
| | ↳ *Close drawer* | |
| 2 | **Column Bulk Operations - Tags & Glossary Select in Drawer** - should select a glossary term from the tree dropdown inside the drawer | Select a glossary term from the tree dropdown inside the drawer |
| | ↳ *Open the glossary tree dropdown and search* | |
| | ↳ *Term option renders inside the drawer top layer* | |
| | ↳ *Clicking the term selects it* | |
| | ↳ *Close drawer* | |

</details>

<details open>
<summary>📄 <b>GlossaryApprovalAfterMove.spec.ts</b> (2 tests, 10 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryApprovalAfterMove.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryApprovalAfterMove.spec.ts)

### Glossary - Approval After Move

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary - Approval After Move** - approving an open task succeeds after the parent term is moved under a sibling | Approving an open task succeeds after the parent term is moved under a sibling |
| | ↳ *Verify exactly one open approval task exists for Eligible Securities* | |
| | ↳ *Move Securities Lending under Product and Service* | |
| | ↳ *Wait for task accessible at new FQN: count=1, same task ID (no duplicate or replacement)* | |
| | ↳ *Reviewer: expand tree and approve Eligible Securities* | |
| | ↳ *Verify Approved status and zero remaining open tasks* | |
| 2 | **Glossary - Approval After Move** - rejecting an open task succeeds after the parent term is moved under a sibling | Rejecting an open task succeeds after the parent term is moved under a sibling |
| | ↳ *Verify exactly one open approval task exists for Eligible Securities* | |
| | ↳ *Move Securities Lending under Product and Service* | |
| | ↳ *Wait for task accessible at new FQN: count=1, same task ID (no duplicate or replacement)* | |
| | ↳ *Reviewer: expand tree and reject Eligible Securities* | |
| | ↳ *Verify term reaches Rejected status and zero remaining open tasks* | |

</details>

<details open>
<summary>📄 <b>GlossaryInheritedReviewerApproval.spec.ts</b> (2 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryInheritedReviewerApproval.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryInheritedReviewerApproval.spec.ts)

### Glossary Approval - inherited reviewers

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Approval - inherited reviewers** - term inherits reviewer added to the glossary after an earlier term ran the workflow | Term inherits reviewer added to the glossary after an earlier term ran the workflow |
| | ↳ *A term created before any reviewer exists is auto-approved* | |
| | ↳ *Add a reviewer to the glossary* | |
| | ↳ *Every term created afterwards inherits the reviewer and gets an approval task* | |
| 2 | **Glossary Approval - inherited reviewers** - inherited reviewer is shown on the term page and it is not left in Draft | Inherited reviewer is shown on the term page and it is not left in Draft |
| | ↳ *A term created before any reviewer exists is auto-approved* | |
| | ↳ *Add a reviewer to the glossary* | |
| | ↳ *Term exposes the inherited reviewer and reaches In Review* | |
| | ↳ *Inherited reviewer is displayed* | |
| | ↳ *Term reached In Review, not Draft* | |

</details>

<details open>
<summary>📄 <b>GlossaryP2Tests.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryP2Tests.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryP2Tests.spec.ts)

### Glossary P2 Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary P2 Tests** - should create term with Draft status when no reviewers | Create term with Draft status when no reviewers |
| 2 | **Glossary P2 Tests** - should show column settings with custom properties option | Show column settings with custom properties option |

</details>

<details open>
<summary>📄 <b>GlossaryDisplayNameEdit.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryDisplayNameEdit.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryDisplayNameEdit.spec.ts)

### Glossary displayName-only edit — left panel freshness

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary displayName-only edit — left panel freshness** - left panel menu updates to the new displayName after a displayName-only edit | Left panel menu updates to the new displayName after a displayName-only edit |

</details>

<details open>
<summary>📄 <b>GlossaryRelationsGraphPerf.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryRelationsGraphPerf.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Glossary/GlossaryRelationsGraphPerf.spec.ts)

### Glossary Relations Graph — N+1 regression guard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Relations Graph — N+1 regression guard** - opening Relations Graph tab does NOT fan out per-Id glossary term fetches | Opening Relations Graph tab does NOT fan out per-Id glossary term fetches |

</details>

<details open>
<summary>📄 <b>GlossaryRenameCascade.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SearchSeparation/GlossaryRenameCascade.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SearchSeparation/GlossaryRenameCascade.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | glossary-term rename cascade keeps tags[] + glossaryTags + tier + cert consistent | Glossary-term rename cascade keeps tags[] + glossaryTags + tier + cert consistent |

</details>

<details open>
<summary>📄 <b>GlossaryRenamePrefixCascade.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SearchSeparation/GlossaryRenamePrefixCascade.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SearchSeparation/GlossaryRenamePrefixCascade.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | glossary-term prefix rename keeps linked asset glossary tag consistent | Glossary-term prefix rename keeps linked asset glossary tag consistent |

</details>


---

<div id="general"></div>

## General

<details open>
<summary>📄 <b>ContextCenterMemories.spec.ts</b> (55 tests, 55 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ContextCenterMemories.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ContextCenterMemories.spec.ts)

### Context Center - Memories

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Context Center - Memories** - shows header with title, breadcrumb and Add Memory button | Shows header with title, breadcrumb and Add Memory button |
| 2 | **Context Center - Memories** - Add Memory button opens the create modal | Add Memory button opens the create modal |
| 3 | **Context Center - Memories** - Create Memory button is disabled when memory content is empty | Create Memory button is disabled when memory content is empty |
| 4 | **Context Center - Memories** - Create Memory button is enabled once memory content is filled | Create Memory button is enabled once memory content is filled |
| 5 | **Context Center - Memories** - form is empty when modal is reopened after cancel | Form is empty when modal is reopened after cancel |
| 6 | **Context Center - Memories** - Preview tab renders markdown content correctly | Preview tab renders markdown content correctly |
| 7 | **Context Center - Memories** - Preview tab shows "nothing to preview" when content is empty | Preview tab shows "nothing to preview" when content is empty |
| 8 | **Context Center - Memories** - switching back to Edit tab restores the textarea | Switching back to Edit tab restores the textarea |
| 9 | **Context Center - Memories** - content typed in Edit mode is visible in Preview and preserved when switching back | Content typed in Edit mode is visible in Preview and preserved when switching back |
| 10 | **Context Center - Memories** - creates a memory with title, content, and type — card appears in the list | Creates a memory with title, content, and type — card appears in the list |
| 11 | **Context Center - Memories** - row shows owner name and memory title | Row shows owner name and memory title |
| 12 | **Context Center - Memories** - row shows linked entity badge when memory has a primary entity | Row shows linked entity badge when memory has a primary entity |
| 13 | **Context Center - Memories** - clicking a memory row opens the view-only modal with owner action buttons | Clicking a memory row opens the view-only modal with owner action buttons |
| 14 | **Context Center - Memories** - search box filters memories by title | Search box filters memories by title |
| 15 | **Context Center - Memories** - clearing search restores the unfiltered list | Clearing search restores the unfiltered list |
| 16 | **Context Center - Memories** - "Created by Me" tab shows admin's own memories and hides the second author's | "Created by Me" tab shows admin's own memories and hides the second author's |
| 17 | **Context Center - Memories** - clicking "Total Memories" count card activates the All view | Clicking "Total Memories" count card activates the All view |
| 18 | **Context Center - Memories** - clicking "Created by Me" count card activates the created-by-me filter | Clicking "Created by Me" count card activates the created-by-me filter |
| 19 | **Context Center - Memories** - selecting the second author in the author filter shows only their memory | Selecting the second author in the author filter shows only their memory |
| 20 | **Context Center - Memories** - "Clear All" button resets the author filter and restores the full list | "Clear All" button resets the author filter and restores the full list |
| 21 | **Context Center - Memories** - clicking "All" tab after applying an author filter clears the filter | Clicking "All" tab after applying an author filter clears the filter |
| 22 | **Context Center - Memories** - no results message is shown when search matches nothing | No results message is shown when search matches nothing |
| 23 | **Context Center - Memories** - sort dropdown shows all three sort options | Sort dropdown shows all three sort options |
| 24 | **Context Center - Memories** - selecting "Most Used" actually reorders rows by usageCount | Selecting "Most Used" actually reorders rows by usageCount |
| 25 | **Context Center - Memories** - clicking a memory row adds ?memory= param to the URL | Clicking a memory row adds ?memory= param to the URL |
| 26 | **Context Center - Memories** - navigating to a URL with ?memory= param auto-opens the memory modal | Navigating to a URL with ?memory= param auto-opens the memory modal |
| 27 | **Context Center - Memories** - closing the modal removes ?memory= param from the URL | Closing the modal removes ?memory= param from the URL |
| 28 | **Context Center - Memories** - copy link button copies URL containing the ?memory= param | Copy link button copies URL containing the ?memory= param |
| 29 | **Context Center - Memories** - edit-memory button on the row opens the modal in edit mode | Edit-memory button on the row opens the modal in edit mode |
| 30 | **Context Center - Memories** - view modal switches to edit mode and saves changes | View modal switches to edit mode and saves changes |
| 31 | **Context Center - Memories** - cancel button in edit mode closes the modal without saving | Cancel button in edit mode closes the modal without saving |
| 32 | **Context Center - Memories** - editing title updates the memory and the row reflects the new title | Editing title updates the memory and the row reflects the new title |
| 33 | **Context Center - Memories** - editing memory content updates the memory | Editing memory content updates the memory |
| 34 | **Context Center - Memories** - editing memory type persists after save | Editing memory type persists after save |
| 35 | **Context Center - Memories** - editing visibility from Shared to Private saves and updates the badge | Editing visibility from Shared to Private saves and updates the badge |
| 36 | **Context Center - Memories** - adding a linked asset in edit mode shows entity badge on the row | Adding a linked asset in edit mode shows entity badge on the row |
| 37 | **Context Center - Memories** - Shared memory shows the shared-with-specific-people description | Shared memory shows the shared-with-specific-people description |
| 38 | **Context Center - Memories** - Private memory shows "visible only to you" description | Private memory shows "visible only to you" description |
| 39 | **Context Center - Memories** - Entity memory shows "visible to linked entities" description | Entity memory shows "visible to linked entities" description |
| 40 | **Context Center - Memories** - changing visibility from Shared to Private shows "visible only to you" after save | Changing visibility from Shared to Private shows "visible only to you" after save |
| 41 | **Context Center - Memories** - private memory (admin-owned) is NOT visible to a non-owner | Private memory (admin-owned) is NOT visible to a non-owner |
| 42 | **Context Center - Memories** - shared memory IS visible to a user explicitly listed in sharedWith | Shared memory IS visible to a user explicitly listed in sharedWith |
| 43 | **Context Center - Memories** - shared memory is NOT visible to a user absent from sharedWith | Shared memory is NOT visible to a user absent from sharedWith |
| 44 | **Context Center - Memories** - entity-visibility memory is visible to every authenticated user | Entity-visibility memory is visible to every authenticated user |
| 45 | **Context Center - Memories** - data consumer sees a read-only modal for shared memories they do not own | Data consumer sees a read-only modal for shared memories they do not own |
| 46 | **Context Center - Memories** - link an asset button opens the search popover | Link an asset button opens the search popover |
| 47 | **Context Center - Memories** - typing the linked table name in the asset search returns it as a result | Typing the linked table name in the asset search returns it as a result |
| 48 | **Context Center - Memories** - ArrowDown + Enter keyboard navigation selects the linked table result | ArrowDown + Enter keyboard navigation selects the linked table result |
| 49 | **Context Center - Memories** - linked asset card shows remove button; clicking it removes the asset | Linked asset card shows remove button; clicking it removes the asset |
| 50 | **Context Center - Memories** - "All Assets" option in asset filter button resets the asset filter | "All Assets" option in asset filter button resets the asset filter |
| 51 | **Context Center - Memories** - deleting a memory via the row actions menu removes it from the list | Deleting a memory via the row actions menu removes it from the list |
| 52 | **Context Center - Memories** - delete button inside the edit modal deletes the memory | Delete button inside the edit modal deletes the memory |
| 53 | **Context Center - Memories** - pagination controls are visible when more than 10 memories exist | Pagination controls are visible when more than 10 memories exist |
| 54 | **Context Center - Memories** - navigating to page 2 loads a different set of memory rows | Navigating to page 2 loads a different set of memory rows |
| 55 | **Context Center - Memories** - navigating back to page 1 shows original memories | Navigating back to page 1 shows original memories |

</details>

<details open>
<summary>📄 <b>IntakeForm.spec.ts</b> (20 tests, 38 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/IntakeForm.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/IntakeForm.spec.ts)

### IntakeForm — Settings → Governance → Forms

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **IntakeForm — Settings → Governance → Forms** - admin can open the Intake Forms settings page | Admin can open the Intake Forms settings page |
| 2 | **IntakeForm — Settings → Governance → Forms** - admin can include three custom properties and require one for Data Product | Admin can include three custom properties and require one for Data Product |
| | ↳ *Open designer via the dropdown* | |
| | ↳ *Include three custom properties and require one; save* | |
| | ↳ *New row renders in the list* | |
| 3 | **IntakeForm — Settings → Governance → Forms** - admin can include three custom properties and require one for Domain | Admin can include three custom properties and require one for Domain |
| | ↳ *Open designer via the dropdown* | |
| | ↳ *Include three custom properties and require one; save* | |
| | ↳ *New row renders in the list* | |
| 4 | **IntakeForm — Settings → Governance → Forms** - admin can include three custom properties and require one for Glossary Term | Admin can include three custom properties and require one for Glossary Term |
| | ↳ *Open designer via the dropdown* | |
| | ↳ *Include three custom properties and require one; save* | |
| | ↳ *New row renders in the list* | |
| 5 | **IntakeForm — Settings → Governance → Forms** - admin can remove included and required fields from the Data Product intake form | Admin can remove included and required fields from the Data Product intake form |
| | ↳ *Removing an included optional field preserves the required field* | |
| | ↳ *Clearing Required keeps the field included and makes it optional* | |
| | ↳ *Removing an included required field clears both states* | |
| 6 | **IntakeForm — Settings → Governance → Forms** - admin can remove included and required fields from the Domain intake form | Admin can remove included and required fields from the Domain intake form |
| | ↳ *Removing an included optional field preserves the required field* | |
| | ↳ *Clearing Required keeps the field included and makes it optional* | |
| | ↳ *Removing an included required field clears both states* | |
| 7 | **IntakeForm — Settings → Governance → Forms** - admin can remove included and required fields from the Glossary Term intake form | Admin can remove included and required fields from the Glossary Term intake form |
| | ↳ *Removing an included optional field preserves the required field* | |
| | ↳ *Clearing Required keeps the field included and makes it optional* | |
| | ↳ *Removing an included required field clears both states* | |
| 8 | **IntakeForm — Settings → Governance → Forms** - "Data Product" option is disabled when a form already exists | "Data Product" option is disabled when a form already exists |
| | ↳ *Seed an existing form via API* | |
| 9 | **IntakeForm — Settings → Governance → Forms** - intake form with required field blocks Data Product create when missing | Intake form with required field blocks Data Product create when missing |
| | ↳ *Seed intake form requiring dataProductType* | |
| | ↳ *Open Data Product tab and the Add form* | |
| | ↳ *Type field is rendered and marked required by intake form* | |
| | ↳ *Client blocks submit without Type; backend ALSO blocks via API* | |
| | ↳ *Backend also rejects with 400 when called directly* | |
| 10 | **IntakeForm — Settings → Governance → Forms** - intake form — toggling enabled flips enforcement in listing | Intake form — toggling enabled flips enforcement in listing |
| | ↳ *Seed an enabled intake form* | |
| 11 | **IntakeForm — Settings → Governance → Forms** - custom property required via intake form renders in Data Product create form | Custom property required via intake form renders in Data Product create form |
| | ↳ *Seed intake form requiring the custom property* | |
| 12 | **IntakeForm — Settings → Governance → Forms** - deleting an intake form removes it from the list | Deleting an intake form removes it from the list |
| | ↳ *Seed a form* | |
| 13 | **IntakeForm — Settings → Governance → Forms** - delete popconfirm cancel keeps the intake form intact | Delete popconfirm cancel keeps the intake form intact |
| | ↳ *Seed a form* | |
| 14 | **IntakeForm — Settings → Governance → Forms** - designer does not list schema-required fields | Designer does not list schema-required fields |
| 15 | **IntakeForm — Settings → Governance → Forms** - deleting a required custom property prunes it from the Data Product intake form | Deleting a required custom property prunes it from the Data Product intake form |
| 16 | **IntakeForm — Settings → Governance → Forms** - deleting a required custom property prunes it from the Domain intake form | Deleting a required custom property prunes it from the Domain intake form |
| 17 | **IntakeForm — Settings → Governance → Forms** - deleting a required custom property prunes it from the Glossary Term intake form | Deleting a required custom property prunes it from the Glossary Term intake form |

### IntakeForm — Entity-reference custom property E2E

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **IntakeForm — Entity-reference custom property E2E** - **pick admin user** → DP create succeeds with correct extension payload | Pick admin user → DP create succeeds with correct extension payload |
| | ↳ *Seed intake form requiring the entity-ref property* | |
| | ↳ *Fill name + description + entity-ref picker* | |
| | ↳ *Submit and verify 201 + correct extension payload* | |

### IntakeForm — custom-property type regressions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **IntakeForm — custom-property type regressions** - Data Product serializes each custom-property type for the create API | Data Product serializes each custom-property type for the create API |

### IntakeForm — Glossary Term create and edit

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **IntakeForm — Glossary Term create and edit** - required intake fields are submitted on create and omitted on edit | Required intake fields are submitted on create and omitted on edit |

</details>


---

<div id="metrics"></div>

## Metrics

<details open>
<summary>📄 <b>MetricBulkImportExportEdit.spec.ts</b> (24 tests, 24 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/MetricBulkImportExportEdit.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricBulkImportExportEdit.spec.ts)

### Metrics bulk import, export, and edit

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metrics bulk import, export, and edit** - Admin starts exactly one async export job from the metrics listing | Admin starts exactly one async export job from the metrics listing |
| 2 | **Metrics bulk import, export, and edit** - Admin imports a metric CSV through preview and async apply | Admin imports a metric CSV through preview and async apply |
| 3 | **Metrics bulk import, export, and edit** - Admin sees metric CSV validation failures for missing names and invalid references | Admin sees metric CSV validation failures for missing names and invalid references |
| 4 | **Metrics bulk import, export, and edit** - Admin imports a CSV update for an existing metric | Admin imports a CSV update for an existing metric |
| 5 | **Metrics bulk import, export, and edit** - Admin bulk edits filtered metrics from the listing API without export jobs | Admin bulk edits filtered metrics from the listing API without export jobs |
| 6 | **Metrics bulk import, export, and edit** - Admin bulk edit keeps text edits on blur and can revert to no changes | Admin bulk edit keeps text edits on blur and can revert to no changes |
| 7 | **Metrics bulk import, export, and edit** - Admin bulk edit hydrates filtered metrics across cursor pages | Admin bulk edit hydrates filtered metrics across cursor pages |
| 8 | **Metrics bulk import, export, and edit** - Admin bulk edit renders complex fields from listing hydration | Admin bulk edit renders complex fields from listing hydration |
| 9 | **Metrics bulk import, export, and edit** - Admin bulk edits only selected metric rows | Admin bulk edits only selected metric rows |
| 10 | **Metrics bulk import, export, and edit** - Cancel from metric bulk edit returns to the metrics listing | Cancel from metric bulk edit returns to the metrics listing |
| 11 | **Metrics bulk import, export, and edit** - Custom metric editor role can import export and bulk edit metrics | Custom metric editor role can import export and bulk edit metrics |
| 12 | **Metrics bulk import, export, and edit** - Restricted roles cannot access metric import or bulk edit | Restricted roles cannot access metric import or bulk edit |
| 13 | **Metrics bulk import, export, and edit** - Bulk edit grid shows NO_CHANGE badge on unmodified rows | Bulk edit grid shows NO_CHANGE badge on unmodified rows |
| 14 | **Metrics bulk import, export, and edit** - Bulk edit grid shows UPDATE badge and increments summary after editing a cell | Bulk edit grid shows UPDATE badge and increments summary after editing a cell |
| 15 | **Metrics bulk import, export, and edit** - Adding a new metric row shows CREATE badge once name is filled | Adding a new metric row shows CREATE badge once name is filled |
| 16 | **Metrics bulk import, export, and edit** - New metric row without a name shows error pill and SKIP badge | New metric row without a name shows error pill and SKIP badge |
| 17 | **Metrics bulk import, export, and edit** - Removing a newly added metric row restores the grid state | Removing a newly added metric row restores the grid state |
| 18 | **Metrics bulk import, export, and edit** - Bulk edit grid search filters rows to match the search term | Bulk edit grid search filters rows to match the search term |
| 19 | **Metrics bulk import, export, and edit** - Clearing the bulk edit search box restores all rows | Clearing the bulk edit search box restores all rows |
| 20 | **Metrics bulk import, export, and edit** - Admin can cancel a metric import mid-flight and cancel API is called | Admin can cancel a metric import mid-flight and cancel API is called |
| 21 | **Metrics bulk import, export, and edit** - MetricListPage header checkbox selects all visible metrics | MetricListPage header checkbox selects all visible metrics |
| 22 | **Metrics bulk import, export, and edit** - MetricListPage unchecking header checkbox clears the selection bar | MetricListPage unchecking header checkbox clears the selection bar |
| 23 | **Metrics bulk import, export, and edit** - MetricListPage clicking anywhere in a row navigates to metric details | MetricListPage clicking anywhere in a row navigates to metric details |
| 24 | **Metrics bulk import, export, and edit** - MetricListPage clicking the row checkbox selects without navigating | MetricListPage clicking the row checkbox selects without navigating |

</details>

<details open>
<summary>📄 <b>Metric.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts)

### Metric Entity Special Test Cases

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric Entity Special Test Cases** - Metric creation flow should work | Metric creation flow should work |
| 2 | **Metric Entity Special Test Cases** - Verify Metric Type Update | Metric Type Update |
| 3 | **Metric Entity Special Test Cases** - Verify Unit of Measurement Update | Unit of Measurement Update |
| 4 | **Metric Entity Special Test Cases** - Verify Granularity Update | Granularity Update |
| 5 | **Metric Entity Special Test Cases** - verify metric expression update | Metric expression update |
| 6 | **Metric Entity Special Test Cases** - Verify Related Metrics Update | Related Metrics Update |
| 7 | **Metric Entity Special Test Cases** - Dimensions and measures render and description is editable | Dimensions and measures render and description is editable |

</details>

<details open>
<summary>📄 <b>CustomMetric.spec.ts</b> (2 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Table custom metric | Table custom metric |
| | ↳ *Create* | |
| | ↳ *Delete* | |
| 2 | Column custom metric | Column custom metric |
| | ↳ *Create* | |
| | ↳ *Delete* | |

</details>

<details open>
<summary>📄 <b>Metric.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SearchSeparation/Metric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SearchSeparation/Metric.spec.ts)

### Metric | live + reindex filter separation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric | live + reindex filter separation** - live indexing produces searchable separation for all four facets | Live indexing produces searchable separation for all four facets |
| 2 | **Metric | live + reindex filter separation** - SearchIndexApp recreate reindex preserves searchable separation | SearchIndexApp recreate reindex preserves searchable separation |

</details>

<details open>
<summary>📄 <b>MetricVersionPage.spec.ts</b> (2 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/MetricVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/MetricVersionPage.spec.ts)

### Metric version page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric version page** - should show the custom unit on the version that carries it | Show the custom unit on the version that carries it |
| | ↳ *Open the initial version* | |
| | ↳ *Version header renders instead of the error boundary* | |
| 2 | **Metric version page** - should show both sides of the diff on the version that changes the unit | Show both sides of the diff on the version that changes the unit |
| | ↳ *Open the version that changed the unit* | |
| | ↳ *Unit of measurement shows the old and new value* | |

</details>

<details open>
<summary>📄 <b>MetricCustomUnitFlow.spec.ts</b> (1 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts)

### Metric Custom Unit of Measurement Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric Custom Unit of Measurement Flow** - Should create metric and test unit of measurement updates | Create metric and test unit of measurement updates |
| | ↳ *Navigate to Metrics and create a metric* | |
| | ↳ *Verify initial unit of measurement is displayed* | |
| | ↳ *Update unit of measurement to Dollars* | |
| | ↳ *Remove unit of measurement* | |
| | ↳ *Set unit back to Percentage* | |
| | ↳ *Clean up - delete the metric* | |

</details>


---

<div id="domains-data-products"></div>

## Domains & Data Products

<details open>
<summary>📄 <b>Domains.spec.ts</b> (47 tests, 75 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts)

### Domains

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domains** - AddDomainForm description preserves typed whitespace | AddDomainForm description preserves typed whitespace |
| 2 | **Domains** - Create domains and add assets | Create domains and add assets |
| | ↳ *Create domain* | |
| | ↳ *Add assets to domain* | |
| | ↳ *Delete domain using delete modal* | |
| 3 | **Domains** - Add-Assets drawer quick filter - behaviour matrix | Add-Assets drawer quick filter - behaviour matrix |
| | ↳ *Create domain and varied assets* | |
| | ↳ *Open the domain assets tab* | |
| 4 | **Domains** - Create DataProducts and add remove assets | Create DataProducts and add remove assets |
| | ↳ *Add assets to domain* | |
| | ↳ *Create DataProducts* | |
| | ↳ *Follow & Un-follow DataProducts* | |
| | ↳ *Verify empty assets message and Add Asset button* | |
| | ↳ *Add assets to DataProducts* | |
| | ↳ *Remove assets from DataProducts* | |
| 5 | **Domains** - Follow & Un-follow domain | Follow & Un-follow domain |
| 6 | **Domains** - Rename domain | Rename domain |
| 7 | **Domains** - Follow/unfollow subdomain and create nested sub domain | Follow/unfollow subdomain and create nested sub domain |
| 8 | **Domains** - Should clear assets from data products after deletion of data product in Domain | Clear assets from data products after deletion of data product in Domain |
| | ↳ *Delete domain & recreate the same domain and data product* | |
| 9 | **Domains** - Should inherit owners and experts from parent domain | Inherit owners and experts from parent domain |
| 10 | **Domains** - Domain owner should able to edit description of domain | Domain owner should able to edit description of domain |
| 11 | **Domains** - Verify domain and subdomain asset count accuracy | Domain and subdomain asset count accuracy |
| | ↳ *Create domain and subdomain via API* | |
| | ↳ *Add assets to domain* | |
| | ↳ *Add assets to subdomain* | |
| | ↳ *Verify domain asset count matches displayed cards* | |
| | ↳ *Verify subdomain asset count matches displayed cards* | |
| 12 | **Domains** - Verify domain data products count includes subdomain data products | Domain data products count includes subdomain data products |
| | ↳ *Create domain, subdomain, and data products via API* | |
| | ↳ *Verify domain data products tab shows both domain and subdomain data products* | |
| | ↳ *Verify subdomain data products tab shows only its own data products* | |
| | ↳ *Delete subdomain and verify its data products are not visible in domain* | |
| | ↳ *Verify deeply nested subdomain data products are visible at each level* | |
| 13 | **Domains** - Verify domain tags and glossary terms | Domain tags and glossary terms |
| 14 | **Domains** - Create domain with tags using TagSuggestion | Create domain with tags using TagSuggestion |
| | ↳ *Navigate to add domain* | |
| | ↳ *Fill domain form* | |
| | ↳ *Search and select tag via TagSuggestion* | |
| | ↳ *Save domain and verify tag is applied* | |
| 15 | **Domains** - Create subdomain with tags using TagSuggestion | Create subdomain with tags using TagSuggestion |
| | ↳ *Navigate to domain and open subdomain modal* | |
| | ↳ *Fill subdomain form* | |
| | ↳ *Search and select tag via TagSuggestion* | |
| | ↳ *Save subdomain and verify tag is applied* | |
| 16 | **Domains** - Verify data product tags and glossary terms | Data product tags and glossary terms |
| 17 | **Domains** - Verify clicking All Domains sets active domain to default value | Clicking All Domains sets active domain to default value |
| 18 | **Domains** - Verify redirect path on data product delete | Redirect path on data product delete |
| 19 | **Domains** - Verify duplicate domain creation | Duplicate domain creation |
| 20 | **Domains** - Verify domain custom property value persistence | Domain custom property value persistence |
| | ↳ *Navigate to domain and assign custom property value* | |
| | ↳ *Reload and verify custom property value persists* | |
| 21 | **Domains** - Domain announcement create, edit & delete | Domain announcement create, edit & delete |
| 22 | **Domains** - Data Product announcement create, edit & delete | Data Product announcement create, edit & delete |
| 23 | **Domains** - should handle domain after description is deleted | Tests that verify UI handles entities with deleted descriptions gracefully. The issue occurs when: 1. An entity is created with a description 2. The description is later deleted/cleared via API patch 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL)) 4. UI should handle this gracefully instead of crashing |
| 24 | **Domains** - should handle data product after description is deleted | Handle data product after description is deleted |

### Domain Rename Comprehensive Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Rename Comprehensive Tests** - Rename domain with subdomains attached verifies subdomain accessibility | Rename domain with subdomains attached verifies subdomain accessibility |
| 2 | **Domain Rename Comprehensive Tests** - Rename domain with deeply nested subdomains (3+ levels) verifies FQN propagation | Rename domain with deeply nested subdomains (3+ levels) verifies FQN propagation |
| 3 | **Domain Rename Comprehensive Tests** - Rename domain with data products attached at domain and subdomain levels | Rename domain with data products attached at domain and subdomain levels |
| 4 | **Domain Rename Comprehensive Tests** - Rename domain with tags and glossary terms preserves associations | Rename domain with tags and glossary terms preserves associations |
| 5 | **Domain Rename Comprehensive Tests** - Rename domain with assets (tables, topics, dashboards) preserves associations | Rename domain with assets (tables, topics, dashboards) preserves associations |
| 6 | **Domain Rename Comprehensive Tests** - Rename domain with owners and experts preserves assignments | Rename domain with owners and experts preserves assignments |
| 7 | **Domain Rename Comprehensive Tests** - Subdomain rename does not affect parent domain and updates nested children | Subdomain rename does not affect parent domain and updates nested children |
| 8 | **Domain Rename Comprehensive Tests** - Comprehensive domain rename with ALL relationships preserved | Comprehensive domain rename with ALL relationships preserved |
| 9 | **Domain Rename Comprehensive Tests** - Multiple consecutive domain renames preserve all associations | Multiple consecutive domain renames preserve all associations |
| 10 | **Domain Rename Comprehensive Tests** - Rename to existing domain name shows appropriate error | Rename to existing domain name shows appropriate error |

### Domains Rbac

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domains Rbac** - Domain Rbac | Domain Rbac |
| | ↳ *Assign assets to domains* | |
| | ↳ *User with access to multiple domains* | |

### Data Consumer Domain Ownership

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Consumer Domain Ownership** - Data consumer can manage domain as owner | Data consumer can manage domain as owner |
| | ↳ *Check domain management permissions for data consumer owner* | |

### Domain Access with hasDomain() Rule

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Access with hasDomain() Rule** - User with hasDomain() rule can access domain and subdomain assets | User with hasDomain() rule can access domain and subdomain assets |
| | ↳ *Verify user can access domain assets* | |
| | ↳ *Verify user can access subdomain assets* | |

### Domain Access with noDomain() Rule

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Access with noDomain() Rule** - User with noDomain() rule cannot access tables without domain | User with noDomain() rule cannot access tables without domain |
| | ↳ *Verify user can access domain-assigned table* | |
| | ↳ *Verify user gets permission error for table without domain* | |

### Domain Tree View Functionality

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Tree View Functionality** - should render the domain tree view with correct details | Render the domain tree view with correct details |
| 2 | **Domain Tree View Functionality** - Verify Domain entity API calls do not include invalid domains field in glossary term assets | Domain entity API calls do not include invalid domains field in glossary term assets |
| 3 | **Domain Tree View Functionality** - Verify Domain entity API calls do not include invalid domains field in tag assets | Domain entity API calls do not include invalid domains field in tag assets |

### Domain asset dryRun — add confirmation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain asset dryRun — add confirmation** - shows preview modal on cross-domain move and commits on Move Anyway | Shows preview modal on cross-domain move and commits on Move Anyway |
| 2 | **Domain asset dryRun — add confirmation** - cancel on preview modal aborts the move | Cancel on preview modal aborts the move |
| 3 | **Domain asset dryRun — add confirmation** - preview names affected data products when moving across domains | Preview names affected data products when moving across domains |
| 4 | **Domain asset dryRun — add confirmation** - first-time add (no current domain) commits without showing the warning modal | First-time add (no current domain) commits without showing the warning modal |

### Domain assets — glossary and inherited glossary term

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain assets — glossary and inherited glossary term** - Assets tab lists the assigned glossary and its inherited term | Assets tab lists the assigned glossary and its inherited term |

### Domain description editor popups

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain description editor popups** - slash, mention, and hashtag popups are usable inside the Add Domain drawer | Slash, mention, and hashtag popups are usable inside the Add Domain drawer |
| | ↳ *Slash command inserts an image block* | |
| | ↳ *Mention popup inserts a user mention* | |
| | ↳ *Hashtag popup inserts an entity link* | |

</details>

<details open>
<summary>📄 <b>DomainAdvanced.spec.ts</b> (22 tests, 22 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DomainAdvanced.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DomainAdvanced.spec.ts)

### Domain Expert Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Expert Permissions** - Domain expert can edit domain description and tags | Domain expert can edit domain description and tags |
| 2 | **Domain Expert Permissions** - Domain expert can manage data products | Domain expert can manage data products |

### Move Assets Between Domains

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Move Assets Between Domains** - Move table from one domain to another via API | Move table from one domain to another via API |
| 2 | **Move Assets Between Domains** - Move asset from domain to subdomain via API | Move asset from domain to subdomain via API |

### Subdomain Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Subdomain Permissions** - User with domain access can view subdomains | User with domain access can view subdomains |
| 2 | **Subdomain Permissions** - User can access subdomain details page | User can access subdomain details page |

### Domain Version History

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Version History** - Domain version history shows changes | Domain version history shows changes |
| 2 | **Domain Version History** - Data product version history shows changes | Data product version history shows changes |

### Domain Description Editing

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Description Editing** - Admin can edit domain description | Admin can edit domain description |
| 2 | **Domain Description Editing** - Admin can edit data product description | Admin can edit data product description |

### Bulk Domain Asset Operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Bulk Domain Asset Operations** - Add multiple assets to domain at once | Add multiple assets to domain at once |
| 2 | **Bulk Domain Asset Operations** - Remove multiple assets from domain at once | Remove multiple assets from domain at once |

### Cross-Domain Access Denial

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Cross-Domain Access Denial** - User can access assets in their domain | User can access assets in their domain |
| 2 | **Cross-Domain Access Denial** - User with domain policy is restricted by policy rules | User with domain policy is restricted by policy rules |

### Domain Type Behavior

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Type Behavior** - Create domain with Source System type | Create domain with Source System type |
| 2 | **Domain Type Behavior** - Create domain with Consumer-aligned type | Create domain with Consumer-aligned type |

### Data Product Asset Management

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Asset Management** - Move assets between data products | Move assets between data products |

### Domain Search and Filter

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Search and Filter** - Search for domain by name | Search for domain by name |
| 2 | **Domain Search and Filter** - Filter assets by domain from explore page | Filter assets by domain from explore page |

### Domain asset dryRun — remove confirmation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain asset dryRun — remove confirmation** - single-asset remove with linked data product shows preview and commits on Remove Anyway | Single-asset remove with linked data product shows preview and commits on Remove Anyway |
| 2 | **Domain asset dryRun — remove confirmation** - cancel on remove warning modal keeps the asset in the domain | Cancel on remove warning modal keeps the asset in the domain |
| 3 | **Domain asset dryRun — remove confirmation** - bulk remove with linked data product shows preview and commits on Remove Anyway | Bulk remove with linked data product shows preview and commits on Remove Anyway |

</details>

<details open>
<summary>📄 <b>DomainUIInteractions.spec.ts</b> (20 tests, 20 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DomainUIInteractions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DomainUIInteractions.spec.ts)

### Domain Owner Management

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Owner Management** - Add owner to domain via UI | Add owner to domain via UI |
| 2 | **Domain Owner Management** - Remove owner from domain via UI | Remove owner from domain via UI |

### Domain Expert Management

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Expert Management** - Add expert to domain via UI | Add expert to domain via UI |

### Domain Style Editing

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Style Editing** - Edit domain style - change icon URL | Edit domain style - change icon URL |

### Data Product UI Operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product UI Operations** - Rename data product via UI | Rename data product via UI |
| 2 | **Data Product UI Operations** - Delete data product via UI | Delete data product via UI |
| 3 | **Data Product UI Operations** - Add owner to data product via UI | Add owner to data product via UI |

### Subdomain Management

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Subdomain Management** - Delete subdomain via UI | Delete subdomain via UI |
| 2 | **Subdomain Management** - Rename subdomain via UI | Rename subdomain via UI |

### Domain Form Validation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Form Validation** - Domain name validation - special characters | Domain name validation - special characters |
| 2 | **Domain Form Validation** - Domain name validation - max length | Domain name validation - max length |
| 3 | **Domain Form Validation** - Domain description required validation | Domain description required validation |

### Domain Assets Tab Operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Assets Tab Operations** - Search assets within domain | Search assets within domain |

### Domain Global Dropdown

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Global Dropdown** - Select domain from global dropdown filters explore | Select domain from global dropdown filters explore |
| 2 | **Domain Global Dropdown** - Clear domain selection returns to All Domains | Clear domain selection returns to All Domains |

### Domain Breadcrumb Navigation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Breadcrumb Navigation** - Navigate from subdomain to parent domain via breadcrumb | Navigate from subdomain to parent domain via breadcrumb |
| 2 | **Domain Breadcrumb Navigation** - Navigate from data product to parent domain | Navigate from data product to parent domain |

### Delete Domain with Dependencies

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Delete Domain with Dependencies** - Delete domain with subdomains shows warning | Delete domain with subdomains shows warning |
| 2 | **Delete Domain with Dependencies** - Delete domain with assets removes domain from assets | Delete domain with assets removes domain from assets |

### Copy FQN Functionality

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Copy FQN Functionality** - Copy domain FQN to clipboard | Copy domain FQN to clipboard |

</details>

<details open>
<summary>📄 <b>DataProductAndSubdomains.spec.ts</b> (18 tests, 19 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataProductAndSubdomains.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataProductAndSubdomains.spec.ts)

### Data Product Comprehensive Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Comprehensive Tests** - Add-Assets drawer quick filter - behaviour matrix | Add-Assets drawer quick filter - behaviour matrix |
| | ↳ *Create data product and varied assets* | |
| | ↳ *Open the data product assets tab* | |
| 2 | **Data Product Comprehensive Tests** - Create data product via UI with description | Create data product via UI with description |
| 3 | **Data Product Comprehensive Tests** - Edit data product description via UI | Edit data product description via UI |
| 4 | **Data Product Comprehensive Tests** - Add expert to data product via UI | Add expert to data product via UI |
| 5 | **Data Product Comprehensive Tests** - Add tags to data product via UI | Add tags to data product via UI |
| 6 | **Data Product Comprehensive Tests** - Add assets to data product and verify count | Add assets to data product and verify count |
| 7 | **Data Product Comprehensive Tests** - Data product linked to subdomain | Data product linked to subdomain |

### Multiple Subdomains Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Multiple Subdomains Tests** - Create multiple sibling subdomains under a domain | Create multiple sibling subdomains under a domain |
| 2 | **Multiple Subdomains Tests** - Create nested subdomain (subdomain of subdomain) | Create nested subdomain (subdomain of subdomain) |
| 3 | **Multiple Subdomains Tests** - Navigate between sibling subdomains | Navigate between sibling subdomains |
| 4 | **Multiple Subdomains Tests** - Assign assets to different subdomains | Assign assets to different subdomains |
| 5 | **Multiple Subdomains Tests** - Data products under different subdomains | Data products under different subdomains |
| 6 | **Multiple Subdomains Tests** - Subdomain assets count reflects in parent domain | Subdomain assets count reflects in parent domain |
| 7 | **Multiple Subdomains Tests** - Delete subdomain with data products shows proper cleanup | Delete subdomain with data products shows proper cleanup |

### Data Product Search and Filter

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Search and Filter** - Search data products by name | Search data products by name |
| 2 | **Data Product Search and Filter** - Filter data products by domain in global selector | Filter data products by domain in global selector |

### Data Product Name in Entity Name Cell

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Name in Entity Name Cell** - Entity name cell shows both display name and name | Entity name cell shows both display name and name |
| 2 | **Data Product Name in Entity Name Cell** - Search data products by name | Search data products by name |

</details>

<details open>
<summary>📄 <b>DomainFilterQueryFilter.spec.ts</b> (13 tests, 13 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DomainFilterQueryFilter.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DomainFilterQueryFilter.spec.ts)

### Domain Filter - User Behavior Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Filter - User Behavior Tests** - Assets from selected domain should be visible in explore page | Assets from selected domain should be visible in explore page |
| 2 | **Domain Filter - User Behavior Tests** - Queries should inherit every associated table domain | Queries should inherit every associated table domain |
| 3 | **Domain Filter - User Behavior Tests** - Subdomain assets should be visible when parent domain is selected | Subdomain assets should be visible when parent domain is selected |
| 4 | **Domain Filter - User Behavior Tests** - Domain filter should persist across page navigation | Domain filter should persist across page navigation |
| 5 | **Domain Filter - User Behavior Tests** - Domain filter should work with different asset types | Domain filter should work with different asset types |
| 6 | **Domain Filter - User Behavior Tests** - Domain page assets tab should show only domain assets | Domain page assets tab should show only domain assets |
| 7 | **Domain Filter - User Behavior Tests** - 3-level domain hierarchy: SubSubDomain assets visible when SubDomain selected | 3-level domain hierarchy: SubSubDomain assets visible when SubDomain selected |
| 8 | **Domain Filter - User Behavior Tests** - Search suggestions should be filtered by selected domain | Search suggestions should be filtered by selected domain |
| 9 | **Domain Filter - User Behavior Tests** - Domain filter should use exact match and prefix with dot to prevent false positives | Domain filter should use exact match and prefix with dot to prevent false positives |
| 10 | **Domain Filter - User Behavior Tests** - Quick filters should persist when domain filter is applied and cleared | Quick filters should persist when domain filter is applied and cleared |
| 11 | **Domain Filter - User Behavior Tests** - Domain assets tab should NOT show assets from other domains | Domain assets tab should NOT show assets from other domains |
| 12 | **Domain Filter - User Behavior Tests** - Domain Data Products tab should NOT show data products from other domains | Domain Data Products tab should NOT show data products from other domains |
| 13 | **Domain Filter - User Behavior Tests** - Multi-nested domain hierarchy: filters should scope correctly at every level | Multi-nested domain hierarchy: filters should scope correctly at every level |

</details>

<details open>
<summary>📄 <b>DataProductODPS.spec.ts</b> (10 tests, 10 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataProductODPS.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataProductODPS.spec.ts)

### DataProduct ODPS — REST contract

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **DataProduct ODPS — REST contract** - exports a data product to a valid ODPS YAML document | Exports a data product to a valid ODPS YAML document |
| 2 | **DataProduct ODPS — REST contract** - validates an exported ODPS document as valid | Validates an exported ODPS document as valid |
| 3 | **DataProduct ODPS — REST contract** - rejects an invalid ODPS document on validation | Rejects an invalid ODPS document on validation |
| 4 | **DataProduct ODPS — REST contract** - round-trips an exported ODPS document into a new data product | Round-trips an exported ODPS document into a new data product |
| 5 | **DataProduct ODPS — REST contract** - merge preserves the existing product domain and owners | Merge preserves the existing product domain and owners |

### DataProduct ODPS & metadata — UI

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **DataProduct ODPS & metadata — UI** - exports ODPS YAML from the data product manage menu | Exports ODPS YAML from the data product manage menu |
| 2 | **DataProduct ODPS & metadata — UI** - imports an ODPS document onto an existing data product via the modal | Imports an ODPS document onto an existing data product via the modal |
| 3 | **DataProduct ODPS & metadata — UI** - name guard blocks a YAML whose product name targets a different product | Name guard blocks a YAML whose product name targets a different product |
| 4 | **DataProduct ODPS & metadata — UI** - name guard blocks a YAML with no readable product name | Name guard blocks a YAML with no readable product name |
| 5 | **DataProduct ODPS & metadata — UI** - edits data product metadata (type, visibility, priority) via the modal | Edits data product metadata (type, visibility, priority) via the modal |

</details>

<details open>
<summary>📄 <b>DataProducts.spec.ts</b> (9 tests, 48 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataProducts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataProducts.spec.ts)

### Data Products

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Products** - Data Product List Page - Initial Load | Data Product List Page - Initial Load |
| | ↳ *Navigate to Data Products page* | |
| | ↳ *Verify page header and controls* | |
| | ↳ *Verify view toggle buttons* | |
| 2 | **Data Products** - Create Data Product and Manage Assets | Create Data Product and Manage Assets |
| | ↳ *Setup test assets* | |
| | ↳ *Navigate to Data Products page* | |
| | ↳ *Create new data product* | |
| | ↳ *Open data product details* | |
| | ↳ *Add assets to data product* | |
| | ↳ *Verify asset count* | |
| | ↳ *Remove assets from data product* | |
| | ↳ *Delete data product* | |
| | ↳ *Cleanup test assets* | |
| 3 | **Data Products** - Search Data Products | Search Data Products |
| | ↳ *Create test data products* | |
| | ↳ *Navigate to Data Products page* | |
| | ↳ *Search for specific data product* | |
| | ↳ *Clear search* | |
| | ↳ *Cleanup test data products* | |
| 4 | **Data Products** - View Toggle - Table and Card Views | View Toggle - Table and Card Views |
| | ↳ *Create test data product* | |
| | ↳ *Navigate to Data Products page* | |
| | ↳ *Verify table view is default* | |
| | ↳ *Switch to card view* | |
| | ↳ *Switch back to table view* | |
| | ↳ *Cleanup test data product* | |
| 5 | **Data Products** - Pagination | Pagination |
| | ↳ *Create 30 test data products* | |
| | ↳ *Navigate to Data Products page* | |
| | ↳ *Verify pagination controls are visible* | |
| | ↳ *Navigate to page 2* | |
| | ↳ *Navigate back to page 1* | |
| | ↳ *Cleanup test data products* | |
| 6 | **Data Products** - Empty State - No Data Products | Empty State - No Data Products |
| | ↳ *Mock API to return empty data products list* | |
| | ↳ *Navigate to Data Products page* | |
| | ↳ *Verify empty state is shown* | |
| | ↳ *Click add button from empty state* | |
| 7 | **Data Products** - Data Product - Follow/Unfollow | Data Product - Follow/Unfollow |
| | ↳ *Create test data product* | |
| | ↳ *Navigate to data product details* | |
| | ↳ *Follow data product* | |
| | ↳ *Verify follow button is changed to unfollow* | |
| | ↳ *Cleanup test data product* | |
| 8 | **Data Products** - Create data product with tags using TagSuggestion | Create data product with tags using TagSuggestion |
| | ↳ *Navigate to add data product* | |
| | ↳ *Fill data product form* | |
| | ↳ *Search and select tag via TagSuggestion* | |
| | ↳ *Save and verify tag is applied* | |
| | ↳ *Cleanup* | |
| 9 | **Data Products** - Data Product — Data Observability tab | Data Product — Data Observability tab |
| | ↳ *Create test data product* | |
| | ↳ *Navigate to data product details* | |
| | ↳ *Data Observability tab is visible on data product page* | |
| | ↳ *Clicking Data Observability tab loads DQ dashboard* | |
| | ↳ *Cleanup test data product* | |

</details>

<details open>
<summary>📄 <b>DomainDataProductsRightPanel.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DomainDataProductsRightPanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DomainDataProductsRightPanel.spec.ts)

### Domain Data Products Tab - Right Panel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Data Products Tab - Right Panel** - Should open right panel when clicking data product card in domain | Open right panel when clicking data product card in domain |
| 2 | **Domain Data Products Tab - Right Panel** - Should display data product name link in panel in domain context | Display data product name link in panel in domain context |
| 3 | **Domain Data Products Tab - Right Panel** - Should display overview tab for data product | Display overview tab for data product |
| 4 | **Domain Data Products Tab - Right Panel** - Should edit description for data product from domain context | Edit description for data product from domain context |
| 5 | **Domain Data Products Tab - Right Panel** - Should display overview tab content for data product in domain context | Display overview tab content for data product in domain context |
| 6 | **Domain Data Products Tab - Right Panel** - Should edit tags for data product from domain context | Edit tags for data product from domain context |
| 7 | **Domain Data Products Tab - Right Panel** - Should assign tier for data product from domain context | Assign tier for data product from domain context |
| 8 | **Domain Data Products Tab - Right Panel** - Should edit owners for data product from domain context | Edit owners for data product from domain context |
| 9 | **Domain Data Products Tab - Right Panel** - Should not display glossary terms section in domain data products context | Not display glossary terms section in domain data products context |

</details>

<details open>
<summary>📄 <b>DomainTierCertificationVoting.spec.ts</b> (8 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DomainTierCertificationVoting.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DomainTierCertificationVoting.spec.ts)

### Domain & DataProduct - Tier, Certification, and Voting

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain & DataProduct - Tier, Certification, and Voting** - Domain - Tier assign, update, and remove | Domain - Tier assign, update, and remove |
| 2 | **Domain & DataProduct - Tier, Certification, and Voting** - Domain - Certification assign, update, and remove | Domain - Certification assign, update, and remove |
| 3 | **Domain & DataProduct - Tier, Certification, and Voting** - Domain - UpVote and DownVote | Domain - UpVote and DownVote |
| 4 | **Domain & DataProduct - Tier, Certification, and Voting** - DataProduct - Tier assign, update, and remove | DataProduct - Tier assign, update, and remove |
| 5 | **Domain & DataProduct - Tier, Certification, and Voting** - DataProduct - Certification assign, update, and remove | DataProduct - Certification assign, update, and remove |
| 6 | **Domain & DataProduct - Tier, Certification, and Voting** - DataProduct - UpVote and DownVote | DataProduct - UpVote and DownVote |
| 7 | **Domain & DataProduct - Tier, Certification, and Voting** - Edit buttons not visible on Domain | Edit buttons not visible on Domain |
| 8 | **Domain & DataProduct - Tier, Certification, and Voting** - Edit buttons not visible on DataProduct | Edit buttons not visible on DataProduct |

</details>

<details open>
<summary>📄 <b>DomainFiltering.spec.ts</b> (8 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Tasks/DomainFiltering.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Tasks/DomainFiltering.spec.ts)

### Domain Filtering - Tasks Refetch on Domain Switch

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Filtering - Tasks Refetch on Domain Switch** - switching domain triggers feed API refetch on entity page | Switching domain triggers feed API refetch on entity page |
| 2 | **Domain Filtering - Tasks Refetch on Domain Switch** - switching to different domain triggers new feed API call | Switching to different domain triggers new feed API call |
| 3 | **Domain Filtering - Tasks Refetch on Domain Switch** - selecting All Domains removes domain filter from feed API call | Selecting All Domains removes domain filter from feed API call |

### Domain Filtering - Task Counts Update

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Filtering - Task Counts Update** - task count API returns counts for created tasks | Task count API returns counts for created tasks |

### Domain Filtering - Entity Page Activity Feed

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Filtering - Entity Page Activity Feed** - entity page activity feed refetches when domain is switched | Entity page activity feed refetches when domain is switched |
| 2 | **Domain Filtering - Entity Page Activity Feed** - entity page shows task cards for entity in selected domain | Entity page shows task cards for entity in selected domain |

### Domain Filtering - API Validation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Filtering - API Validation** - GET /tasks returns 200 | GET /tasks returns 200 |
| 2 | **Domain Filtering - API Validation** - GET /tasks/count returns task counts | GET /tasks/count returns task counts |

</details>

<details open>
<summary>📄 <b>DomainDataProductsWidgets.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts)

### Domain and Data Product Asset Counts

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain and Data Product Asset Counts** - Assign Widgets | Assign Widgets |
| 2 | **Domain and Data Product Asset Counts** - Verify Widgets are having 0 count initially | Widgets are having 0 count initially |
| 3 | **Domain and Data Product Asset Counts** - Domain asset count should update when assets are added | Domain asset count should update when assets are added |
| 4 | **Domain and Data Product Asset Counts** - Data Product asset count should update when assets are added | Data Product asset count should update when assets are added |
| 5 | **Domain and Data Product Asset Counts** - Domain asset count should update when assets are removed | Domain asset count should update when assets are removed |
| 6 | **Domain and Data Product Asset Counts** - Data Product asset count should update when assets are removed | Data Product asset count should update when assets are removed |

</details>

<details open>
<summary>📄 <b>DataProductRename.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataProductRename.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataProductRename.spec.ts)

### Data Product Rename

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Rename** - should rename data product and verify assets are still associated | Rename data product and verify assets are still associated |
| 2 | **Data Product Rename** - should update only display name without changing the actual name | Update only display name without changing the actual name |
| 3 | **Data Product Rename** - should handle multiple consecutive renames and preserve assets | Handle multiple consecutive renames and preserve assets |
| 4 | **Data Product Rename** - should show error when renaming to a name that already exists | Show error when renaming to a name that already exists |

</details>

<details open>
<summary>📄 <b>DataProductRenameConsolidation.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataProductRenameConsolidation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataProductRenameConsolidation.spec.ts)

### Data Product Rename + Field Update Consolidation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Rename + Field Update Consolidation** - Rename then update description - assets should be preserved | Rename then update description - assets should be preserved |
| 2 | **Data Product Rename + Field Update Consolidation** - Rename then add tags - assets should be preserved | Rename then add tags - assets should be preserved |
| 3 | **Data Product Rename + Field Update Consolidation** - Rename then change owner - assets should be preserved | Rename then change owner - assets should be preserved |
| 4 | **Data Product Rename + Field Update Consolidation** - Multiple rename + update cycles - assets should be preserved | Multiple rename + update cycles - assets should be preserved |

</details>

<details open>
<summary>📄 <b>DataProductCertificationFilter.spec.ts</b> (4 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataProductCertificationFilter.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataProductCertificationFilter.spec.ts)

### Data Products - quick filters

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Products - quick filters** - lists only certifications assigned to data products | Lists only certifications assigned to data products |
| | ↳ *Navigate to the Data Products page* | |
| | ↳ *Certification quick filter is available* | |
| | ↳ *Assigned certifications are searchable* | |
| 2 | **Data Products - quick filters** - filtering by a certification narrows the listing | Filtering by a certification narrows the listing |
| | ↳ *Navigate to the Data Products page* | |
| | ↳ *Apply the gold certification filter* | |
| | ↳ *Only the gold-certified data product remains* | |
| 3 | **Data Products - quick filters** - glossary term option keeps its original casing while the filter value stays lowercased | Glossary term option keeps its original casing while the filter value stays lowercased |
| | ↳ *The dropdown option reads in the original casing* | |
| | ↳ *Applying the filter keeps the original casing on the chip* | |
| | ↳ *The URL carries the lowercased key, not the label* | |
| | ↳ *The casing survives a reload of the filtered URL* | |
| 4 | **Data Products - quick filters** - tag option keeps its original casing | Tag option keeps its original casing |

</details>

<details open>
<summary>📄 <b>DataProductDomainMigration.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataProductDomainMigration.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataProductDomainMigration.spec.ts)

### Data Product Domain Migration

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Domain Migration** - Changing data product domain via API migrates assets to new domain | Changing data product domain via API migrates assets to new domain |
| 2 | **Data Product Domain Migration** - Data product with no assets can change domain without confirmation | Data product with no assets can change domain without confirmation |
| 3 | **Data Product Domain Migration** - Data product remains visible after moving domains and deleting the original domain | Data product remains visible after moving domains and deleting the original domain |

</details>

<details open>
<summary>📄 <b>DomainLineageIsolation.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainLineageIsolation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainLineageIsolation.spec.ts)

### Domain isolation - lineage graph @domain-isolation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain isolation - lineage graph @domain-isolation** - userA sees tableA but not the cross-tenant tableB node | UserA sees tableA but not the cross-tenant tableB node |
| 2 | **Domain isolation - lineage graph @domain-isolation** - userB sees tableB but not the cross-tenant tableA node | UserB sees tableB but not the cross-tenant tableA node |
| 3 | **Domain isolation - lineage graph @domain-isolation** - admin sees both nodes in the lineage graph | Admin sees both nodes in the lineage graph |

</details>

<details open>
<summary>📄 <b>DomainListingIsolation.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainListingIsolation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainListingIsolation.spec.ts)

### Domain isolation - domain listing page @domain-isolation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain isolation - domain listing page @domain-isolation** - userA sees only tenantA on the domains listing page | UserA sees only tenantA on the domains listing page |
| 2 | **Domain isolation - domain listing page @domain-isolation** - userB sees only tenantB on the domains listing page | UserB sees only tenantB on the domains listing page |
| 3 | **Domain isolation - domain listing page @domain-isolation** - admin sees both tenants on the domains listing page | Admin sees both tenants on the domains listing page |

</details>

<details open>
<summary>📄 <b>DomainSearchIsolation.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainSearchIsolation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainSearchIsolation.spec.ts)

### Domain isolation - search and explore @domain-isolation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain isolation - search and explore @domain-isolation** - userA finds tenantA and domainless tables but not tenantB | UserA finds tenantA and domainless tables but not tenantB |
| 2 | **Domain isolation - search and explore @domain-isolation** - userB finds tenantB and domainless tables but not tenantA | UserB finds tenantB and domainless tables but not tenantA |
| 3 | **Domain isolation - search and explore @domain-isolation** - admin finds tables from both tenants | Admin finds tables from both tenants |

</details>

<details open>
<summary>📄 <b>DomainTaskIsolation.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainTaskIsolation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainTaskIsolation.spec.ts)

### Domain isolation - tasks @domain-isolation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain isolation - tasks @domain-isolation** - userA sees only their own-domain task | UserA sees only their own-domain task |
| 2 | **Domain isolation - tasks @domain-isolation** - userB sees only their own-domain task | UserB sees only their own-domain task |
| 3 | **Domain isolation - tasks @domain-isolation** - admin sees tasks from both domains | Admin sees tasks from both domains |

</details>

<details open>
<summary>📄 <b>DataProductPermissions.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/DataProductPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DataProductPermissions.spec.ts)

### Data Product Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Permissions** - Data Product allow operations | Data Product allow operations |
| 2 | **Data Product Permissions** - Data Product deny operations | Data Product deny operations |
| 3 | **Data Product Permissions** - Data Product expert can edit data product details | Data Product expert can edit data product details |

</details>

<details open>
<summary>📄 <b>SampleDataDomainDataProduct.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SampleDataDomainDataProduct.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SampleDataDomainDataProduct.spec.ts)

### Sample Data Domain and Data Product Validation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Sample Data Domain and Data Product Validation** - Verify TestDomain exists from sample data ingestion | TestDomain exists from sample data ingestion |
| 2 | **Sample Data Domain and Data Product Validation** - Verify TestDataProduct exists under TestDomain | TestDataProduct exists under TestDomain |
| 3 | **Sample Data Domain and Data Product Validation** - Verify TestDataProduct shows correct details and domain association | TestDataProduct shows correct details and domain association |

</details>

<details open>
<summary>📄 <b>DataProductPersonaCustomization.spec.ts</b> (2 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataProductPersonaCustomization.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataProductPersonaCustomization.spec.ts)

### Data Product Persona customization

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Product Persona customization** - Data Product - customization should work | Data Product - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 2 | **Data Product Persona customization** - Data Product - customize tab label should only render if it's customized by user | Data Product - customize tab label should only render if it's customized by user |
| | ↳ *pre-requisite* | |
| | ↳ *apply tab label customization for Data Product* | |
| | ↳ *validate applied label change for Data Product Documentation tab* | |

</details>

<details open>
<summary>📄 <b>DomainDropdownIsolation.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainDropdownIsolation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainDropdownIsolation.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Restricted user sees only their own domains in the navbar dropdown | Restricted user sees only their own domains in the navbar dropdown |
| 2 | Admin sees every domain and the All Domains option | Admin sees every domain and the All Domains option |

</details>

<details open>
<summary>📄 <b>DomainIncidentIsolation.spec.ts</b> (2 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainIncidentIsolation.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DomainIsolation/DomainIncidentIsolation.spec.ts)

### Domain isolation - incident manager listing

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain isolation - incident manager listing** - user without a domain cannot see incidents belonging to a domain | User without a domain cannot see incidents belonging to a domain |
| | ↳ *the domained incident is withheld* | |
| | ↳ *the domainless incident is still listed* | |
| 2 | **Domain isolation - incident manager listing** - admin sees incidents from every domain | Admin sees incidents from every domain |

</details>

<details open>
<summary>📄 <b>DomainWidgetFilter.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainWidgetFilter.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainWidgetFilter.spec.ts)

### Domain Widget Filter

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Widget Filter** - Setup Domains widget on landing page | Setup Domains widget on landing page |
| 2 | **Domain Widget Filter** - Domains widget should show only selected domain when domain filter is active | Domains widget should show only selected domain when domain filter is active |

</details>

<details open>
<summary>📄 <b>DomainPermissions.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Domain allow operations | Domain allow operations |
| 2 | Domain deny operations | Domain deny operations |

</details>

<details open>
<summary>📄 <b>DomainRenamePrefixCascade.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SearchSeparation/DomainRenamePrefixCascade.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SearchSeparation/DomainRenamePrefixCascade.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | domain prefix rename keeps linked asset domain reference consistent | Domain prefix rename keeps linked asset domain reference consistent |

</details>

<details open>
<summary>📄 <b>SubDomainPagination.spec.ts</b> (1 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts)

### SubDomain Pagination

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SubDomain Pagination** - Verify subdomain count and pagination functionality | Subdomain count and pagination functionality |
| | ↳ *Verify subdomain count in tab label* | |
| | ↳ *Navigate to subdomains tab and verify initial data load* | |
| | ↳ *Test pagination navigation* | |
| | ↳ *Create new subdomain and verify count updates* | |

</details>


---

<div id="data-contracts"></div>

## Data Contracts

<details open>
<summary>📄 <b>DataContracts.spec.ts</b> (48 tests, 423 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts)

### Data Contracts

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts** - Create Data Contract and validate for Table | Create Data Contract and validate for Table |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 2 | **Data Contracts** - Create Data Contract and validate for Topic | Create Data Contract and validate for Topic |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 3 | **Data Contracts** - Create Data Contract and validate for Dashboard | Create Data Contract and validate for Dashboard |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 4 | **Data Contracts** - Create Data Contract and validate for DashboardDataModel | Create Data Contract and validate for DashboardDataModel |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 5 | **Data Contracts** - Create Data Contract and validate for Pipeline | Create Data Contract and validate for Pipeline |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 6 | **Data Contracts** - Create Data Contract and validate for MlModel | Create Data Contract and validate for MlModel |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 7 | **Data Contracts** - Create Data Contract and validate for Container | Create Data Contract and validate for Container |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 8 | **Data Contracts** - Create Data Contract and validate for SearchIndex | Create Data Contract and validate for SearchIndex |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 9 | **Data Contracts** - Create Data Contract and validate for Store Procedure | Create Data Contract and validate for Store Procedure |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 10 | **Data Contracts** - Create Data Contract and validate for ApiEndpoint | Create Data Contract and validate for ApiEndpoint |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 11 | **Data Contracts** - Create Data Contract and validate for Api Collection | Create Data Contract and validate for Api Collection |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 12 | **Data Contracts** - Create Data Contract and validate for Chart | Create Data Contract and validate for Chart |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 13 | **Data Contracts** - Create Data Contract and validate for Directory | Create Data Contract and validate for Directory |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 14 | **Data Contracts** - Create Data Contract and validate for File | Create Data Contract and validate for File |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 15 | **Data Contracts** - Create Data Contract and validate for Spreadsheet | Create Data Contract and validate for Spreadsheet |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 16 | **Data Contracts** - Create Data Contract and validate for Worksheet | Create Data Contract and validate for Worksheet |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 17 | **Data Contracts** - Create Data Contract and validate for Database | Create Data Contract and validate for Database |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 18 | **Data Contracts** - Create Data Contract and validate for Database Schema | Create Data Contract and validate for Database Schema |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Export ODCS YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| | ↳ *Import contract from ODCS YAML* | |
| | ↳ *Delete imported contract* | |
| | ↳ *Import contract from OM YAML* | |
| | ↳ *Export OM YAML* | |
| | ↳ *Delete OM imported contract* | |
| 19 | **Data Contracts** - Pagination in Schema Tab with Selection Persistent | Pagination in Schema Tab with Selection Persistent |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Save contract and validate for schema* | |
| | ↳ *Update the Schema and Validate* | |
| | ↳ *Re-select some columns on page 1, save and validate* | |
| | ↳ *Delete contract* | |
| 20 | **Data Contracts** - Semantic with Contains Operator should work for Tier, Tag and Glossary | Semantic with Contains Operator should work for Tier, Tag and Glossary |
| 21 | **Data Contracts** - Semantic with Not_Contains Operator should work for Tier, Tag and Glossary | Semantic with Not_Contains Operator should work for Tier, Tag and Glossary |
| 22 | **Data Contracts** - Nested Column should not be selectable | Nested Column should not be selectable |
| 23 | **Data Contracts** - Operation on Old Schema Columns Contract | Operation on Old Schema Columns Contract |
| 24 | **Data Contracts** - should allow adding a semantic with multiple rules | Allow adding a semantic with multiple rules |
| 25 | **Data Contracts** - should allow adding a second semantic and verify its rule | Allow adding a second semantic and verify its rule |
| 26 | **Data Contracts** - should allow editing a semantic and reflect changes | Allow editing a semantic and reflect changes |
| 27 | **Data Contracts** - should allow deleting a semantic and remove it from the list | Allow deleting a semantic and remove it from the list |
| 28 | **Data Contracts** - Add and update Security and SLA tabs | Add and update Security and SLA tabs |
| | ↳ *Add Security and SLA Details* | |
| | ↳ *Validate Security and SLA Details* | |
| | ↳ *Update Security and SLA Details* | |
| | ↳ *Validate the updated values Security and SLA Details* | |
| | ↳ *Validate after removing security policies* | |
| 29 | **Data Contracts** - ODCS Import Modal with Merge Mode should preserve existing contract ID | ODCS Import Modal with Merge Mode should preserve existing contract ID |
| | ↳ *Create initial contract via ODCS import* | |
| | ↳ *Import again via modal with merge mode (default)* | |
| | ↳ *Cleanup: Delete contract* | |
| 30 | **Data Contracts** - ODCS Import Modal with Replace Mode should overwrite all fields | ODCS Import Modal with Replace Mode should overwrite all fields |
| | ↳ *Create initial contract with SLA via ODCS import* | |
| | ↳ *Import again via modal with replace mode* | |
| | ↳ *Cleanup: Delete contract* | |

### Data Contracts With Persona Table

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Table** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Topic

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Topic** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Dashboard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Dashboard** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona DashboardDataModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona DashboardDataModel** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Pipeline

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Pipeline** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona MlModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona MlModel** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Container

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Container** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona SearchIndex

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona SearchIndex** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Store Procedure

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Store Procedure** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona ApiEndpoint

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona ApiEndpoint** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Api Collection

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Api Collection** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Chart

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Chart** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Directory

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Directory** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona File

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona File** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Spreadsheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Spreadsheet** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Worksheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Worksheet** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Database

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Database** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Database Schema

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Database Schema** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

</details>

<details open>
<summary>📄 <b>DataContractsSemanticRules.spec.ts</b> (41 tests, 128 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts)

### Data Contracts Semantics Rule Owner

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Is | Validate Owner Rule Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Owner with is condition should passed with same team owner* | |
| | ↳ *Owner with is condition should failed with different owner* | |
| 2 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Is_Not | Validate Owner Rule Is_Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Owner with is not condition should passed with different owner* | |
| | ↳ *Owner with is not condition should failed with same owner* | |
| 3 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Any_In | Validate Owner Rule Any_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Should Failed since entity owner doesn't make the list of any_in* | |
| | ↳ *Should Passed since entity owner present in the list of any_in* | |
| 4 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Not_In | Validate Owner Rule Not_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Should Passed since entity owner doesn't make the list of not_in* | |
| | ↳ *Should Failed since entity owner present in the list of not_in* | |
| 5 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Is_Set | Validate Owner Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Should Failed since entity don't have owner* | |
| | ↳ *Should Passed since entity has owner* | |
| 6 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Is_Not_Set | Validate Owner Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Should Passed since entity don't have owner* | |
| | ↳ *Should Failed since entity has owner* | |

### Data Contracts Semantics Rule Description

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Description** - Validate Description Rule Contains | Validate Description Rule Contains |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Description with contains condition should passed* | |
| | ↳ *Description with contains and wrong value should failed* | |
| 2 | **Data Contracts Semantics Rule Description** - Validate Description Rule Not Contains | Validate Description Rule Not Contains |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Description with not_contains condition should failed* | |
| | ↳ *Description with not_contains condition should passed* | |
| 3 | **Data Contracts Semantics Rule Description** - Validate Description Rule Is_Set | Validate Description Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Description with is_set condition should passed* | |
| | ↳ *Description with is_set condition should failed* | |
| 4 | **Data Contracts Semantics Rule Description** - Validate Description Rule Is_Not_Set | Validate Description Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Description with is_not_set condition should failed* | |
| | ↳ *Description with is_not_set condition should passed* | |

### Data Contracts Semantics Rule Domain

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Is | Validate Domain Rule Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with Is condition should passed* | |
| | ↳ *Domain with Is condition should failed* | |
| 2 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Is Not | Validate Domain Rule Is Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with IsNot condition should passed* | |
| | ↳ *Domain with IsNot condition should failed* | |
| 3 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Any_In | Validate Domain Rule Any_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with AnyIn condition should passed* | |
| | ↳ *Domain with AnyIn condition should failed* | |
| 4 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Not_In | Validate Domain Rule Not_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with NotIn condition should passed* | |
| | ↳ *Domain with NotIn condition should failed* | |
| 5 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Is_Set | Validate Domain Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with IsSet condition should passed* | |
| | ↳ *Domain with IsSet condition should failed* | |
| 6 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Is_Not_Set | Validate Domain Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with IsNotSet condition should passed* | |
| | ↳ *Domain with IsNotSet condition should failed* | |

### Data Contracts Semantics Rule Version

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Version** - Validate Entity Version Is | Validate Entity Version Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Correct entity version should passed* | |
| | ↳ *Non-Correct entity version should failed* | |
| 2 | **Data Contracts Semantics Rule Version** - Validate Entity Version Is Not | Validate Entity Version Is Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with is_not condition for version should passed* | |
| | ↳ *Contract with is_not condition for version should failed* | |
| 3 | **Data Contracts Semantics Rule Version** - Validate Entity Version Less than < | Validate Entity Version Less than < |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with < condition for version should passed* | |
| | ↳ *Contract with < condition for version should failed* | |
| 4 | **Data Contracts Semantics Rule Version** - Validate Entity Version Greater than > | Validate Entity Version Greater than > |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with > condition for version should failed* | |
| | ↳ *Contract with > condition for version should passed* | |
| 5 | **Data Contracts Semantics Rule Version** - Validate Entity Version Less than equal <= | Validate Entity Version Less than equal <= |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with <= condition for version should passed* | |
| | ↳ *Contract with <= condition for version should failed* | |
| 6 | **Data Contracts Semantics Rule Version** - Validate Entity Version Greater than equal >= | Validate Entity Version Greater than equal >= |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with >= condition for version should failed* | |
| | ↳ *Contract with >= condition for version should passed* | |

### Data Contracts Semantics Rule DataProduct

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Is | Validate DataProduct Rule Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with Is condition should passed* | |
| | ↳ *DataProduct with Is condition should failed* | |
| 2 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Is Not | Validate DataProduct Rule Is Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with Is Not condition should passed* | |
| | ↳ *DataProduct with Is Not condition should passed* | |
| 3 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Any_In | Validate DataProduct Rule Any_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with Any In condition should failed* | |
| | ↳ *DataProduct with Any In condition should passed* | |
| 4 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Not_In | Validate DataProduct Rule Not_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with Not In condition should passed* | |
| | ↳ *DataProduct with Not In condition should failed with excluded product* | |
| | ↳ *DataProduct with Not In condition should failed when table has multiple products one of which is excluded* | |
| 5 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Is_Set | Validate DataProduct Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with IsSet condition should passed* | |
| | ↳ *Domain with IsSet condition should failed* | |
| 6 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Is_Not_Set | Validate DataProduct Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with IsNotSet condition should passed* | |
| | ↳ *DataProduct with IsNotSet condition should failed* | |

### Data Contracts Semantics Rule DisplayName

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Is | Validate DisplayName Rule Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with Is condition should passed* | |
| | ↳ *DisplayName with Is condition should failed* | |
| 2 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Is Not | Validate DisplayName Rule Is Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with Is Not condition should failed* | |
| | ↳ *DisplayName with Is Not condition should passed* | |
| 3 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Any_In | Validate DisplayName Rule Any_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with Any In condition should passed* | |
| | ↳ *DisplayName with Any In condition should failed* | |
| 4 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Not_In | Validate DisplayName Rule Not_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with Not In condition should failed* | |
| | ↳ *DisplayName with Not In condition should passed* | |
| 5 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Is_Set | Validate DisplayName Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with IsSet condition should passed* | |
| | ↳ *DisplayName with IsSet condition should failed* | |
| 6 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Is_Not_Set | Validate DisplayName Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with IsNotSet condition should failed* | |
| | ↳ *DisplayName with IsNotSet condition should passed* | |

### Data Contracts Semantics Rule Updated on

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Between | Validate UpdatedOn Rule Between |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with Between condition should passed* | |
| | ↳ *UpdatedOn with Between condition should failed* | |
| 2 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Not_Between | Validate UpdatedOn Rule Not_Between |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with Between condition should failed* | |
| | ↳ *UpdatedOn with Between condition should passed* | |
| 3 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Less than | Validate UpdatedOn Rule Less than |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with Less than condition should failed* | |
| | ↳ *UpdatedOn with Less than condition should passed* | |
| 4 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Greater than | Validate UpdatedOn Rule Greater than |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with Greater than condition should failed* | |
| | ↳ *UpdatedOn with Greater than condition should passed* | |
| 5 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Less than Equal | Validate UpdatedOn Rule Less than Equal |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with LessThanEqual condition should passed* | |
| | ↳ *UpdatedOn with Less than condition should failed* | |
| 6 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Greater Than Equal | Validate UpdatedOn Rule Greater Than Equal |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with GreaterThanEqual condition should passed* | |
| | ↳ *UpdatedOn with GreaterThanEqual condition should failed* | |

### Data Contract - Semantics Fields Validation

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contract - Semantics Fields Validation** - Validate semantics fields | Validate semantics fields |
| | ↳ *Navigate to semantics tab* | |
| | ↳ *Click save and verify rule error is shown* | |
| | ↳ *Verify delete button is not visible with only one rule* | |
| | ↳ *fill the first rule completely* | |
| | ↳ *Add a second rule condition* | |
| | ↳ *Delete the filled rule condition and verify rule error is shown* | |
| | ↳ *select Is Set operator and error is hidden* | |

</details>

<details open>
<summary>📄 <b>DataContractInheritance.spec.ts</b> (8 tests, 56 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataContractInheritance.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractInheritance.spec.ts)

### Data Contract Inheritance

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contract Inheritance** - Full Contract Inheritance - Asset inherits full contract from Data Product | Full Contract Inheritance - Asset inherits full contract from Data Product |
| | ↳ *Navigate to Data Product and add contract* | |
| | ↳ *Fill Data Product contract details* | |
| | ↳ *Fill Terms of Service* | |
| | ↳ *Fill Semantics* | |
| | ↳ *Fill SLA* | |
| | ↳ *Save contract* | |
| | ↳ *Add asset to Data Product* | |
| | ↳ *Navigate to asset and verify inherited contract* | |
| 2 | **Data Contract Inheritance** - Partial Contract Inheritance - Asset contract merges with Data Product contract | Partial Contract Inheritance - Asset contract merges with Data Product contract |
| | ↳ *Navigate to asset and add contract with semantics* | |
| | ↳ *Fill asset contract details* | |
| | ↳ *Fill asset semantics* | |
| | ↳ *Save asset contract* | |
| | ↳ *Navigate to second Data Product and add contract with different semantics and SLA* | |
| | ↳ *Fill Data Product contract details* | |
| | ↳ *Fill Data Product Terms of Service* | |
| | ↳ *Fill Data Product semantics (different from asset)* | |
| | ↳ *Fill Data Product SLA* | |
| | ↳ *Save Data Product contract* | |
| | ↳ *Add asset with contract to Data Product* | |
| | ↳ *Navigate to asset and verify merged contract* | |
| 3 | **Data Contract Inheritance** - Edit Asset Contract - Add SLA when inheriting SLA from Data Product (PATCH should use /add not /replace) | Edit Asset Contract - Add SLA when inheriting SLA from Data Product (PATCH should use /add not /replace) |
| | ↳ *Navigate to Data Product and add contract with SLA* | |
| | ↳ *Fill Data Product contract with SLA* | |
| | ↳ *Fill Data Product SLA* | |
| | ↳ *Save Data Product contract* | |
| | ↳ *Add asset to Data Product* | |
| | ↳ *Navigate to asset and add contract WITHOUT SLA* | |
| | ↳ *Fill asset contract details (without SLA initially)* | |
| | ↳ *Save asset contract without SLA - should be POST (create new)* | |
| | ↳ *Edit contract again to ADD its own SLA* | |
| | ↳ *Fill asset own SLA (this tests PATCH uses /add not /replace)* | |
| | ↳ *Save contract with own SLA - PATCH should succeed* | |
| | ↳ *Verify asset now has its own SLA (no inherited icon)* | |
| 4 | **Data Contract Inheritance** - Edit Inherited Contract - Creates new asset contract instead of modifying parent | Edit Inherited Contract - Creates new asset contract instead of modifying parent |
| | ↳ *Create Data Product with contract* | |
| | ↳ *Add asset to Data Product* | |
| | ↳ *Navigate to asset and verify inherited contract* | |
| | ↳ *Click Edit on inherited contract - should open ADD form, not EDIT* | |
| | ↳ *Fill new asset contract details* | |
| | ↳ *Save new asset contract - should create, not update* | |
| | ↳ *Verify asset now has its own contract (non-inherited)* | |
| | ↳ *Verify Data Product contract was NOT modified* | |
| 5 | **Data Contract Inheritance** - Delete Button Disabled - Fully inherited contracts cannot be deleted | Delete Button Disabled - Fully inherited contracts cannot be deleted |
| | ↳ *Create Data Product with contract* | |
| | ↳ *Add asset to Data Product* | |
| | ↳ *Navigate to asset and verify delete is disabled for inherited contract* | |
| 6 | **Data Contract Inheritance** - Run Validation - Inherited contract validation uses entity-based validation | Run Validation - Inherited contract validation uses entity-based validation |
| | ↳ *Create Data Product with contract* | |
| | ↳ *Add asset to Data Product* | |
| | ↳ *Navigate to asset and run validation on inherited contract* | |
| 7 | **Data Contract Inheritance** - Remove Asset - Inherited contract no longer shown when asset is removed from Data Product | Remove Asset - Inherited contract no longer shown when asset is removed from Data Product |
| | ↳ *Create Data Product with contract* | |
| | ↳ *Add asset to Data Product* | |
| | ↳ *Verify asset shows inherited contract* | |
| | ↳ *Remove asset from Data Product* | |
| | ↳ *Verify asset no longer shows inherited contract* | |
| 8 | **Data Contract Inheritance** - Delete Asset Contract - Falls back to showing inherited contract from Data Product | Delete Asset Contract - Falls back to showing inherited contract from Data Product |
| | ↳ *Create Data Product with contract* | |
| | ↳ *Add asset to Data Product* | |
| | ↳ *Create asset own contract* | |
| | ↳ *Delete asset own contract* | |
| | ↳ *Verify asset now shows inherited contract from Data Product* | |

</details>


---

<div id="knowledge-center"></div>

## Knowledge Center

<details open>
<summary>📄 <b>ExplorePageRightPanel_KnowledgeCenter.spec.ts</b> (22 tests, 22 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ExplorePageRightPanel_KnowledgeCenter.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExplorePageRightPanel_KnowledgeCenter.spec.ts)

### Knowledge Center Right Panel Test Suite

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Knowledge Center Right Panel Test Suite** - Should update description for knowledgeCenter | Update description for knowledgeCenter |
| 2 | **Knowledge Center Right Panel Test Suite** - Should update/edit tags for knowledgeCenter | Update/edit tags for knowledgeCenter |
| 3 | **Knowledge Center Right Panel Test Suite** - Should update/edit glossary terms for knowledgeCenter | Update/edit glossary terms for knowledgeCenter |
| 4 | **Knowledge Center Right Panel Test Suite** - Should update owners for knowledgeCenter | Update owners for knowledgeCenter |
| 5 | **Knowledge Center Right Panel Test Suite** - validates visible/hidden tabs and tab content for knowledgeCenter | Validates visible/hidden tabs and tab content for knowledgeCenter |
| 6 | **Knowledge Center Right Panel Test Suite** - Should remove tag for knowledgeCenter | Remove tag for knowledgeCenter |
| 7 | **Knowledge Center Right Panel Test Suite** - Should remove glossary term for knowledgeCenter | Remove glossary term for knowledgeCenter |
| 8 | **Knowledge Center Right Panel Test Suite** - Should remove user owner for knowledgeCenter | Remove user owner for knowledgeCenter |
| 9 | **Knowledge Center Right Panel Test Suite** - Should verify deleted user not visible in owner selection for knowledgeCenter | Deleted user not visible in owner selection for knowledgeCenter |
| 10 | **Knowledge Center Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for knowledgeCenter | Deleted tag not visible in tag selection for knowledgeCenter |
| 11 | **Knowledge Center Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for knowledgeCenter | Deleted glossary term not visible in selection for knowledgeCenter |
| 12 | **Knowledge Center Right Panel Test Suite** - Should allow Data Steward to edit description for knowledgeCenter | Allow Data Steward to edit description for knowledgeCenter |
| 13 | **Knowledge Center Right Panel Test Suite** - Should allow Data Steward to edit owners for knowledgeCenter | Allow Data Steward to edit owners for knowledgeCenter |
| 14 | **Knowledge Center Right Panel Test Suite** - Should allow Data Steward to edit tags for knowledgeCenter | Allow Data Steward to edit tags for knowledgeCenter |
| 15 | **Knowledge Center Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for knowledgeCenter | Allow Data Steward to edit glossary terms for knowledgeCenter |
| 16 | **Knowledge Center Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for knowledgeCenter | NOT show restricted edit buttons for Data Steward for knowledgeCenter |
| 17 | **Knowledge Center Right Panel Test Suite** - Should allow Data Consumer to edit description for knowledgeCenter | Allow Data Consumer to edit description for knowledgeCenter |
| 18 | **Knowledge Center Right Panel Test Suite** - Should allow Data Consumer to edit tags for knowledgeCenter | Allow Data Consumer to edit tags for knowledgeCenter |
| 19 | **Knowledge Center Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for knowledgeCenter | Allow Data Consumer to edit glossary terms for knowledgeCenter |
| 20 | **Knowledge Center Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless knowledgeCenter | Follow Data Consumer role policies for ownerless knowledgeCenter |
| 21 | **Knowledge Center Right Panel Test Suite** - Should clear description for knowledgeCenter | Clear description for knowledgeCenter |
| 22 | **Knowledge Center Right Panel Test Suite** - Should add multiple tags simultaneously for knowledgeCenter | Add multiple tags simultaneously for knowledgeCenter |

</details>


---


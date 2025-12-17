[🏠 Home](./README.md) > **Governance**

# Governance

> **5 Components** | **21 Files** | **128 Tests**

## Table of Contents
- [Custom Properties](#custom-properties)
- [Metrics](#metrics)
- [Glossary](#glossary)
- [Domains & Data Products](#domains-data-products)
- [Tags](#tags)

---

<div id="custom-properties"></div>

## Custom Properties

<details open>
<summary>📄 <b>CustomPropertySearchSettings.spec.ts</b> (3 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts)

### Custom Property Search Settings

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Custom Property Search Settings** - Create custom properties and configure search for Dashboard | Create custom properties and configure search for Dashboard |
| 2 | **Custom Property Search Settings** - Create custom properties and configure search for Pipeline | Create custom properties and configure search for Pipeline |
| 3 | **Custom Property Search Settings** - Verify custom property fields are persisted in search settings | Custom property fields are persisted in search settings |

</details>

<details open>
<summary>📄 <b>AdvanceSearchCustomProperty.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts)

### Advanced Search Custom Property

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Advanced Search Custom Property** - Create, Assign and Test Advance Search for Duration | Create, Assign and Test Advance Search for Duration |

</details>

<details open>
<summary>📄 <b>CustomPropertyAdvanceSeach.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/AdvanceSearchFilter/CustomPropertyAdvanceSeach.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AdvanceSearchFilter/CustomPropertyAdvanceSeach.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | CustomProperty Dashboard Filter | CustomProperty Dashboard Filter |

</details>


---

<div id="metrics"></div>

## Metrics

<details open>
<summary>📄 <b>Metric.spec.ts</b> (6 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts)

### Metric Entity Special Test Cases

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric Entity Special Test Cases** - Verify Metric Type Update | Metric Type Update |
| 2 | **Metric Entity Special Test Cases** - Verify Unit of Measurement Update | Unit of Measurement Update |
| 3 | **Metric Entity Special Test Cases** - Verify Granularity Update | Granularity Update |
| 4 | **Metric Entity Special Test Cases** - verify metric expression update | Metric expression update |
| 5 | **Metric Entity Special Test Cases** - Verify Related Metrics Update | Related Metrics Update |

### Listing page and add Metric flow should work

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Listing page and add Metric flow should work** - Metric listing page and add metric from the "Add button" | Metric listing page and add metric from the "Add button" |

</details>

<details open>
<summary>📄 <b>CustomMetric.spec.ts</b> (2 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Table custom metric | Table custom metric |
| 2 | Column custom metric | Column custom metric |

</details>

<details open>
<summary>📄 <b>MetricCustomUnitFlow.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts)

### Metric Custom Unit of Measurement Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric Custom Unit of Measurement Flow** - Should create metric and test unit of measurement updates | Create metric and test unit of measurement updates |

</details>


---

<div id="glossary"></div>

## Glossary

<details open>
<summary>📄 <b>Glossary.spec.ts</b> (35 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Glossary.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Glossary.spec.ts)

### Glossary tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary tests** - Glossary & terms creation for reviewer as user | Glossary & terms creation for reviewer as user |
| 2 | **Glossary tests** - Glossary & terms creation for reviewer as team | Glossary & terms creation for reviewer as team |
| 3 | **Glossary tests** - Update Glossary and Glossary Term | Update Glossary and Glossary Term |
| 4 | **Glossary tests** - Add, Update and Verify Data Glossary Term | Add, Update and Verify Data Glossary Term |
| 5 | **Glossary tests** - Approve and reject glossary term from Glossary Listing | Approve and reject glossary term from Glossary Listing |
| 6 | **Glossary tests** - Add and Remove Assets | Add and Remove Assets |
| 7 | **Glossary tests** - Rename Glossary Term and verify assets | Rename Glossary Term and verify assets |
| 8 | **Glossary tests** - Verify asset selection modal filters are shown upfront | Asset selection modal filters are shown upfront |
| 9 | **Glossary tests** - Drag and Drop Glossary Term | Drag and Drop Glossary Term |
| 10 | **Glossary tests** - Drag and Drop Glossary Term Approved Terms having reviewer | Drag and Drop Glossary Term Approved Terms having reviewer |
| 11 | **Glossary tests** - Change glossary term hierarchy using menu options | Change glossary term hierarchy using menu options |
| 12 | **Glossary tests** - Change glossary term hierarchy using menu options across glossary | Change glossary term hierarchy using menu options across glossary |
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
| 24 | **Glossary tests** - Glossary Terms Table Status filtering | Glossary Terms Table Status filtering |
| 25 | **Glossary tests** - Column dropdown drag-and-drop functionality for Glossary Terms table | Column dropdown drag-and-drop functionality for Glossary Terms table |
| 26 | **Glossary tests** - Glossary Term Update in Glossary Page should persist tree | Glossary Term Update in Glossary Page should persist tree |
| 27 | **Glossary tests** - Add Glossary Term inside another Term | Add Glossary Term inside another Term |
| 28 | **Glossary tests** - Check for duplicate Glossary Term | For duplicate Glossary Term |
| 29 | **Glossary tests** - Verify Glossary Deny Permission | Glossary Deny Permission |
| 30 | **Glossary tests** - Verify Glossary Term Deny Permission | Glossary Term Deny Permission |
| 31 | **Glossary tests** - Term should stay approved when changes made by reviewer | Term should stay approved when changes made by reviewer |
| 32 | **Glossary tests** - Glossary creation with domain selection | Glossary creation with domain selection |
| 33 | **Glossary tests** - Create glossary, change language to Dutch, and delete glossary | Create glossary, change language to Dutch, and delete glossary |
| 34 | **Glossary tests** - should handle glossary after description is deleted | Tests that verify UI handles entities with deleted descriptions gracefully. The issue occurs when: 1. An entity is created with a description 2. The description is later deleted/cleared via API patch 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL)) 4. UI should handle this gracefully instead of crashing |
| 35 | **Glossary tests** - should handle glossary term after description is deleted | Handle glossary term after description is deleted |

</details>

<details open>
<summary>📄 <b>LargeGlossaryPerformance.spec.ts</b> (9 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/LargeGlossaryPerformance.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LargeGlossaryPerformance.spec.ts)

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
<summary>📄 <b>GlossaryPagination.spec.ts</b> (2 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/GlossaryPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/GlossaryPagination.spec.ts)

### Glossary tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary tests** - should check for glossary term search | For glossary term search |
| 2 | **Glossary tests** - should check for nested glossary term search | For nested glossary term search |

</details>

<details open>
<summary>📄 <b>GlossaryPermissions.spec.ts</b> (2 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/GlossaryPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/GlossaryPermissions.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Glossary allow operations | Glossary allow operations |
| 2 | Glossary deny operations | Glossary deny operations |

</details>

<details open>
<summary>📄 <b>GlossaryImportExport.spec.ts</b> (2 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/GlossaryImportExport.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/GlossaryImportExport.spec.ts)

### Glossary Bulk Import Export

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Bulk Import Export** - Glossary Bulk Import Export | Glossary Bulk Import Export |
| 2 | **Glossary Bulk Import Export** - Check for Circular Reference in Glossary Import | For Circular Reference in Glossary Import |

</details>

<details open>
<summary>📄 <b>GlossaryVersionPage.spec.ts</b> (2 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/GlossaryVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/GlossaryVersionPage.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Glossary | Glossary |
| 2 | GlossaryTerm | GlossaryTerm |

</details>


---

<div id="domains-data-products"></div>

## Domains & Data Products

<details open>
<summary>📄 <b>Domains.spec.ts</b> (26 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts)

### Domains

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domains** - Create domains and add assets | Create domains and add assets |
| 2 | **Domains** - Create DataProducts and add remove assets | Create DataProducts and add remove assets |
| 3 | **Domains** - Follow & Un-follow domain | Follow & Un-follow domain |
| 4 | **Domains** - Add, Update custom properties for data product | Add, Update custom properties for data product |
| 5 | **Domains** - Switch domain from navbar and check domain query call wrap in quotes | Switch domain from navbar and check domain query call wrap in quotes |
| 6 | **Domains** - Rename domain | Rename domain |
| 7 | **Domains** - Follow/unfollow subdomain and create nested sub domain | Follow/unfollow subdomain and create nested sub domain |
| 8 | **Domains** - Should clear assets from data products after deletion of data product in Domain | Clear assets from data products after deletion of data product in Domain |
| 9 | **Domains** - Should inherit owners and experts from parent domain | Inherit owners and experts from parent domain |
| 10 | **Domains** - Domain owner should able to edit description of domain | Domain owner should able to edit description of domain |
| 11 | **Domains** - Verify domain and subdomain asset count accuracy | Domain and subdomain asset count accuracy |
| 12 | **Domains** - Verify domain tags and glossary terms | Domain tags and glossary terms |
| 13 | **Domains** - Verify data product tags and glossary terms | Data product tags and glossary terms |
| 14 | **Domains** - Verify clicking All Domains sets active domain to default value | Clicking All Domains sets active domain to default value |
| 15 | **Domains** - Verify redirect path on data product delete | Redirect path on data product delete |
| 16 | **Domains** - Verify duplicate domain creation | Duplicate domain creation |
| 17 | **Domains** - Create domain custom property and verify value persistence | Create domain custom property and verify value persistence |
| 18 | **Domains** - Domain announcement create, edit & delete | Domain announcement create, edit & delete |
| 19 | **Domains** - Data Product announcement create, edit & delete | Data Product announcement create, edit & delete |
| 20 | **Domains** - should handle domain after description is deleted | Tests that verify UI handles entities with deleted descriptions gracefully. The issue occurs when: 1. An entity is created with a description 2. The description is later deleted/cleared via API patch 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL)) 4. UI should handle this gracefully instead of crashing |
| 21 | **Domains** - should handle data product after description is deleted | Handle data product after description is deleted |

### Domains Rbac

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domains Rbac** - Domain Rbac | Domain Rbac |

### Data Consumer Domain Ownership

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Consumer Domain Ownership** - Data consumer can manage domain as owner | Data consumer can manage domain as owner |

### Domain Access with hasDomain() Rule

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Access with hasDomain() Rule** - User with hasDomain() rule can access domain and subdomain assets | User with hasDomain() rule can access domain and subdomain assets |

### Domain Access with noDomain() Rule

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Access with noDomain() Rule** - User with noDomain() rule cannot access tables without domain | User with noDomain() rule cannot access tables without domain |

### Domain Tree View Functionality

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Tree View Functionality** - should render the domain tree view with correct details | Render the domain tree view with correct details |

</details>

<details open>
<summary>📄 <b>DomainDataProductsWidgets.spec.ts</b> (6 tests)</summary>

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
<summary>📄 <b>DomainPermissions.spec.ts</b> (2 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Domain allow operations | Domain allow operations |
| 2 | Domain deny operations | Domain deny operations |

</details>

<details open>
<summary>📄 <b>SubDomainPagination.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts)

### SubDomain Pagination

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SubDomain Pagination** - Verify subdomain count and pagination functionality | Subdomain count and pagination functionality |

</details>


---

<div id="tags"></div>

## Tags

<details open>
<summary>📄 <b>Tag.spec.ts</b> (18 tests)</summary>

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
| 8 | **Tag Page with Admin Roles** - Create tag with domain | Create tag with domain |
| 9 | **Tag Page with Admin Roles** - Verify Owner Add Delete | Owner Add Delete |

### Tag Page with Data Consumer Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Data Consumer Roles** - Verify Tag UI for Data Consumer | Tag UI for Data Consumer |
| 2 | **Tag Page with Data Consumer Roles** - Certification Page should not have Asset button for Data Consumer | Certification Page should not have Asset button for Data Consumer |
| 3 | **Tag Page with Data Consumer Roles** - Edit Tag Description for Data Consumer | Edit Tag Description for Data Consumer |
| 4 | **Tag Page with Data Consumer Roles** - Add and Remove Assets for Data Consumer | Add and Remove Assets for Data Consumer |

### Tag Page with Data Steward Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Data Steward Roles** - Verify Tag UI for Data Steward | Tag UI for Data Steward |
| 2 | **Tag Page with Data Steward Roles** - Certification Page should not have Asset button for Data Steward | Certification Page should not have Asset button for Data Steward |
| 3 | **Tag Page with Data Steward Roles** - Edit Tag Description for Data Steward | Edit Tag Description for Data Steward |
| 4 | **Tag Page with Data Steward Roles** - Add and Remove Assets for Data Steward | Add and Remove Assets for Data Steward |

### Tag Page with Limited EditTag Permission

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Limited EditTag Permission** - Add and Remove Assets and Check Restricted Entity | Add and Remove Assets and Check Restricted Entity |

</details>

<details open>
<summary>📄 <b>Tags.spec.ts</b> (4 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Classification Page | Classification Page |
| 2 | Search tag using classification display name should work | Search tag using classification display name should work |
| 3 | Verify system classification term counts | System classification term counts |
| 4 | Verify Owner Add Delete | Owner Add Delete |

</details>

<details open>
<summary>📄 <b>TagsSuggestion.spec.ts</b> (3 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts)

### Tags Suggestions Table Entity

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tags Suggestions Table Entity** - View, Close, Reject and Accept the Suggestions | View, Close, Reject and Accept the Suggestions |
| 2 | **Tags Suggestions Table Entity** - Accept the Suggestions for Tier Card | Accept the Suggestions for Tier Card |
| 3 | **Tags Suggestions Table Entity** - Reject All Suggestions | Reject All Suggestions |

</details>

<details open>
<summary>📄 <b>MutuallyExclusiveColumnTags.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Should show error toast when adding mutually exclusive tags to column | Show error toast when adding mutually exclusive tags to column |

</details>

<details open>
<summary>📄 <b>ClassificationVersionPage.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Classification version page | Classification version page |

</details>


---


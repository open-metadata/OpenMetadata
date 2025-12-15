---
layout: default
title: Search & Discovery
parent: Components
nav_order: 75
---

# Search & Discovery
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 14 |
| **Test Cases** | 47 |
| **Test Steps** | 28 |
| **Total Scenarios** | 75 |

---

## ExploreTree

📁 **File:** [`playwright/e2e/Pages/ExploreTree.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 6 |
| Steps | 9 |
| Total | 15 |

### Explore Tree scenarios
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Explore Tree | Explore Tree | 4 | [L59](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L59) |
| | ↳ *Check the explore tree* | | | [L60](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L60) |
| | ↳ *Check the quick filters* | | | [L107](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L107) |
| | ↳ *Click on tree item and check quick filter* | | | [L131](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L131) |
| | ↳ *Click on tree item metrics and check quick filter* | | | [L145](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L145) |
| 2 | Verify Database and Database Schema available in explore tree | Database and Database Schema available in explore tree | 2 | [L157](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L157) |
| | ↳ *Verify first table database and schema* | | | [L179](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L179) |
| | ↳ *Verify second table database and schema* | | | [L189](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L189) |
| 3 | Verify Database and Database schema after rename | Database and Database schema after rename | 3 | [L205](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L205) |
| | ↳ *Visit explore page and verify existing values* | | | [L217](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L217) |
| | ↳ *Rename schema and database* | | | [L234](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L234) |
| | ↳ *Verify renamed values in explore page* | | | [L260](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L260) |

### Explore page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Check the listing of tags | The listing of tags | - | [L362](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L362) |
| 2 | Check listing of entities when index is dataAsset | Listing of entities when index is dataAsset | - | [L385](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L385) |
| 3 | Check listing of entities when index is all | Listing of entities when index is all | - | [L391](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L391) |

---

## CustomPropertySearchSettings

📁 **File:** [`playwright/e2e/Features/CustomPropertySearchSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 10 |
| Total | 13 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Create custom properties and configure search for Dashboard | Create custom properties and configure search for Dashboard | 5 | [L65](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts#L65) |
| 2 | Create custom properties and configure search for Pipeline | Create custom properties and configure search for Pipeline | 3 | [L246](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts#L246) |
| 3 | Verify custom property fields are persisted in search settings | Custom property fields are persisted in search settings | 2 | [L374](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts#L374) |

---

## TableSearch

📁 **File:** [`playwright/e2e/Features/TableSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 9 |
| Steps | 0 |
| Total | 9 |

### Services page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Services page should have search functionality | Services page should have search functionality | - | [L36](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L36) |

### API Collection page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | API Collection page should have search functionality | API Collection page should have search functionality | - | [L51](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L51) |

### Database Schema Tables tab
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Database Schema Tables tab should have search functionality | Database Schema Tables tab should have search functionality | - | [L86](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L86) |

### Data Models Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Data Models Table should have search functionality | Data Models Table should have search functionality | - | [L121](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L121) |

### Stored Procedure Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Stored Procedure Table should have search functionality | Stored Procedure Table should have search functionality | - | [L154](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L154) |

### Topics Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Topics Table should have search functionality | Topics Table should have search functionality | - | [L192](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L192) |

### Drives Service Directories Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Drives Service Directories Table should have search functionality | Drives Service Directories Table should have search functionality | - | [L223](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L223) |

### Drives Service Files Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Drives Service Files Table should have search functionality | Drives Service Files Table should have search functionality | - | [L260](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L260) |

### Drives Service Spreadsheets Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Drives Service Spreadsheets Table should have search functionality | Drives Service Spreadsheets Table should have search functionality | - | [L295](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L295) |

---

## ExploreDiscovery

📁 **File:** [`playwright/e2e/Flow/ExploreDiscovery.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 9 |
| Steps | 0 |
| Total | 9 |

### Explore Assets Discovery
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should not display deleted assets when showDeleted is not checked and deleted is not present in queryFilter | Not display deleted assets when showDeleted is not checked and deleted is not present in queryFilter | - | [L74](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L74) |
| 2 | Should display deleted assets when showDeleted is not checked but deleted is true in queryFilter | Display deleted assets when showDeleted is not checked but deleted is true in queryFilter | - | [L96](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L96) |
| 3 | Should not display deleted assets when showDeleted is not checked but deleted is false in queryFilter | Not display deleted assets when showDeleted is not checked but deleted is false in queryFilter | - | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L119) |
| 4 | Should display deleted assets when showDeleted is checked and deleted is not present in queryFilter | Display deleted assets when showDeleted is checked and deleted is not present in queryFilter | - | [L142](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L142) |
| 5 | Should display deleted assets when showDeleted is checked and deleted is true in queryFilter | Display deleted assets when showDeleted is checked and deleted is true in queryFilter | - | [L166](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L166) |
| 6 | Should not display deleted assets when showDeleted is checked but deleted is false in queryFilter | Not display deleted assets when showDeleted is checked but deleted is false in queryFilter | - | [L191](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L191) |
| 7 | Should not display soft deleted assets in search suggestions | Not display soft deleted assets in search suggestions | - | [L216](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L216) |
| 8 | Should not display domain and owner of deleted asset in suggestions when showDeleted is off | Not display domain and owner of deleted asset in suggestions when showDeleted is off | - | [L261](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L261) |
| 9 | Should display domain and owner of deleted asset in suggestions when showDeleted is on | Display domain and owner of deleted asset in suggestions when showDeleted is on | - | [L314](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L314) |

---

## SearchIndexApplication

📁 **File:** [`playwright/e2e/Pages/SearchIndexApplication.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchIndexApplication.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 7 |
| Total | 8 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Search Index Application | Search Index Application | 7 | [L73](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchIndexApplication.spec.ts#L73) |

---

## ExploreQuickFilters

📁 **File:** [`playwright/e2e/Features/ExploreQuickFilters.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 5 |
| Steps | 0 |
| Total | 5 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | search dropdown should work properly for quick filters | Search dropdown should work properly for quick filters | - | [L70](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L70) |
| 2 | should search for empty or null filters | Search for empty or null filters | - | [L97](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L97) |
| 3 | should show correct count for initial options | Show correct count for initial options | - | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L110) |
| 4 | should search for multiple values along with null filters | Search for multiple values along with null filters | - | [L144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L144) |
| 5 | should persist quick filter on global search | Persist quick filter on global search | - | [L165](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L165) |

---

## AdvancedSearch

📁 **File:** [`playwright/e2e/Features/AdvancedSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 4 |
| Steps | 0 |
| Total | 4 |

### Advanced Search
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify All conditions for ${field.id} field | All conditions for ${field.id} field | - | [L301](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts#L301) |
| 2 | Verify Rule functionality for field ${field.id} with ${operator} operator | Rule functionality for field ${field.id} with ${operator} operator | - | [L311](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts#L311) |
| 3 | Verify Group functionality for field ${field.id} with ${operator} operator | Group functionality for field ${field.id} with ${operator} operator | - | [L320](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts#L320) |
| 4 | Verify search with non existing value do not result in infinite search | Search with non existing value do not result in infinite search | - | [L330](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts#L330) |

---

## SearchSettings

📁 **File:** [`playwright/e2e/Pages/SearchSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 4 |
| Steps | 0 |
| Total | 4 |

### Search Settings Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Update global search settings | Update global search settings | - | [L35](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L35) |
| 2 | Update entity search settings | Update entity search settings | - | [L62](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L62) |
| 3 | Restore default search settings | Restore default search settings | - | [L112](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L112) |

### Search Preview test
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Search preview for searchable table | Search preview for searchable table | - | [L155](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L155) |

---

## AdvanceSearchCustomProperty

📁 **File:** [`playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 2 |
| Total | 3 |

### Advanced Search Custom Property
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Create, Assign and Test Advance Search for Duration | Create, Assign and Test Advance Search for Duration | 2 | [L48](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts#L48) |
| | ↳ *Create and Assign Custom Property Value* | | | [L55](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts#L55) |
| | ↳ *Verify Duration Type in Advance Search * | | | [L90](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts#L90) |

---

## AdvancedSearchSuggestions

📁 **File:** [`playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Advanced Search Suggestions
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify suggestions for ${field.label} field | Suggestions for ${field.label} field | - | [L51](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts#L51) |

---

## ExploreSortOrderFilter

📁 **File:** [`playwright/e2e/Features/ExploreSortOrderFilter.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreSortOrderFilter.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Explore Sort Order Filter
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | ${name} | ${name} | - | [L23](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreSortOrderFilter.spec.ts#L23) |

---

## SchemaSearch

📁 **File:** [`playwright/e2e/Features/SchemaSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaSearch.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Schema search
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Search schema in database page | Search schema in database page | - | [L43](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaSearch.spec.ts#L43) |

---

## GlobalSearch

📁 **File:** [`playwright/e2e/Flow/GlobalSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/GlobalSearch.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | searching for longer description should work | Searching for longer description should work | - | [L25](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/GlobalSearch.spec.ts#L25) |

---

## SearchRBAC

📁 **File:** [`playwright/e2e/Flow/SearchRBAC.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SearchRBAC.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Search RBAC for ${entityObj.getType()} | Search RBAC for ${entityObj.getType()} | - | [L182](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SearchRBAC.spec.ts#L182) |

---


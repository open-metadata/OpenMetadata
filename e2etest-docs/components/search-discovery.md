---
layout: default
title: Search & Discovery
parent: Components
nav_order: 48
---

# Search & Discovery

| Metric | Count |
|--------|-------|
| **Total Tests** | 48 |
| **Test Files** | 14 |

---

## TableSearch

**File:** [`playwright/e2e/Features/TableSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts)
**Tests:** 9

### Services page

| Test | Line |
|------|------|
| Services page should have search functionality | [L36](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L36) |

### API Collection page

| Test | Line |
|------|------|
| API Collection page should have search functionality | [L51](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L51) |

### Database Schema Tables tab

| Test | Line |
|------|------|
| Database Schema Tables tab should have search functionality | [L86](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L86) |

### Data Models Table

| Test | Line |
|------|------|
| Data Models Table should have search functionality | [L121](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L121) |

### Stored Procedure Table

| Test | Line |
|------|------|
| Stored Procedure Table should have search functionality | [L154](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L154) |

### Topics Table

| Test | Line |
|------|------|
| Topics Table should have search functionality | [L192](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L192) |

### Drives Service Directories Table

| Test | Line |
|------|------|
| Drives Service Directories Table should have search functionality | [L223](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L223) |

### Drives Service Files Table

| Test | Line |
|------|------|
| Drives Service Files Table should have search functionality | [L260](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L260) |

### Drives Service Spreadsheets Table

| Test | Line |
|------|------|
| Drives Service Spreadsheets Table should have search functionality | [L295](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts#L295) |

## ExploreDiscovery

**File:** [`playwright/e2e/Flow/ExploreDiscovery.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts)
**Tests:** 9

### Explore Assets Discovery

| Test | Line |
|------|------|
| Should not display deleted assets when showDeleted is not checked and deleted is not present in queryFilter | [L74](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L74) |
| Should display deleted assets when showDeleted is not checked but deleted is true in queryFilter | [L96](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L96) |
| Should not display deleted assets when showDeleted is not checked but deleted is false in queryFilter | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L119) |
| Should display deleted assets when showDeleted is checked and deleted is not present in queryFilter | [L142](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L142) |
| Should display deleted assets when showDeleted is checked and deleted is true in queryFilter | [L166](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L166) |
| Should not display deleted assets when showDeleted is checked but deleted is false in queryFilter | [L191](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L191) |
| Should not display soft deleted assets in search suggestions | [L216](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L216) |
| Should not display domain and owner of deleted asset in suggestions when showDeleted is off | [L261](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L261) |
| Should display domain and owner of deleted asset in suggestions when showDeleted is on | [L314](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts#L314) |

## ExploreQuickFilters

**File:** [`playwright/e2e/Features/ExploreQuickFilters.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts)
**Tests:** 6

### Root Tests

| Test | Line |
|------|------|
| search dropdown should work properly for quick filters | [L70](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L70) |
| should search for empty or null filters | [L97](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L97) |
| should show correct count for initial options | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L110) |
| . | [L127](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L127) |
| should search for multiple values along with null filters | [L144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L144) |
| should persist quick filter on global search | [L165](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts#L165) |

## ExploreTree

**File:** [`playwright/e2e/Pages/ExploreTree.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts)
**Tests:** 6

### Explore Tree scenarios

| Test | Line |
|------|------|
| Explore Tree | [L59](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L59) |
| Verify Database and Database Schema available in explore tree | [L157](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L157) |
| Verify Database and Database schema after rename | [L205](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L205) |

### Explore page

| Test | Line |
|------|------|
| Check the listing of tags | [L362](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L362) |
| Check listing of entities when index is dataAsset | [L385](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L385) |
| Check listing of entities when index is all | [L391](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts#L391) |

## AdvancedSearch

**File:** [`playwright/e2e/Features/AdvancedSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts)
**Tests:** 4

### Advanced Search

| Test | Line |
|------|------|
| Verify All conditions for ${field.id} field | [L301](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts#L301) |
| Verify Rule functionality for field ${field.id} with ${operator} operator | [L311](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts#L311) |
| Verify Group functionality for field ${field.id} with ${operator} operator | [L320](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts#L320) |
| Verify search with non existing value do not result in infinite search | [L330](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts#L330) |

## SearchSettings

**File:** [`playwright/e2e/Pages/SearchSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts)
**Tests:** 4

### Search Settings Tests

| Test | Line |
|------|------|
| Update global search settings | [L35](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L35) |
| Update entity search settings | [L62](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L62) |
| Restore default search settings | [L112](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L112) |

### Search Preview test

| Test | Line |
|------|------|
| Search preview for searchable table | [L155](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts#L155) |

## CustomPropertySearchSettings

**File:** [`playwright/e2e/Features/CustomPropertySearchSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts)
**Tests:** 3

### Root Tests

| Test | Line |
|------|------|
| Create custom properties and configure search for Dashboard | [L65](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts#L65) |
| Create custom properties and configure search for Pipeline | [L246](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts#L246) |
| Verify custom property fields are persisted in search settings | [L374](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts#L374) |

## AdvanceSearchCustomProperty

**File:** [`playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts)
**Tests:** 1

### Advanced Search Custom Property

| Test | Line |
|------|------|
| Create, Assign and Test Advance Search for Duration | [L48](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts#L48) |

## AdvancedSearchSuggestions

**File:** [`playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts)
**Tests:** 1

### Advanced Search Suggestions

| Test | Line |
|------|------|
| Verify suggestions for ${field.label} field | [L51](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts#L51) |

## ExploreSortOrderFilter

**File:** [`playwright/e2e/Features/ExploreSortOrderFilter.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreSortOrderFilter.spec.ts)
**Tests:** 1

### Explore Sort Order Filter

| Test | Line |
|------|------|
| ${name} | [L23](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreSortOrderFilter.spec.ts#L23) |

## SchemaSearch

**File:** [`playwright/e2e/Features/SchemaSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaSearch.spec.ts)
**Tests:** 1

### Schema search

| Test | Line |
|------|------|
| Search schema in database page | [L43](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaSearch.spec.ts#L43) |

## GlobalSearch

**File:** [`playwright/e2e/Flow/GlobalSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/GlobalSearch.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| searching for longer description should work | [L25](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/GlobalSearch.spec.ts#L25) |

## SearchRBAC

**File:** [`playwright/e2e/Flow/SearchRBAC.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SearchRBAC.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Search RBAC for ${entityObj.getType()} | [L182](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SearchRBAC.spec.ts#L182) |

## SearchIndexApplication

**File:** [`playwright/e2e/Pages/SearchIndexApplication.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchIndexApplication.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Search Index Application | [L73](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchIndexApplication.spec.ts#L73) |


---
layout: default
title: Domains & Data Products
parent: Components
nav_order: 35
---

# Domains & Data Products

| Metric | Count |
|--------|-------|
| **Total Tests** | 35 |
| **Test Files** | 4 |

---

## Domains

**File:** [`playwright/e2e/Pages/Domains.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts)
**Tests:** 26

### Domains

| Test | Line |
|------|------|
| Create domains and add assets | [L162](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L162) |
| Create DataProducts and add remove assets | [L210](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L210) |
| Follow & Un-follow domain | [L340](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L340) |
| Add, Update custom properties for data product | [L383](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L383) |
| Switch domain from navbar and check domain query call wrap in quotes | [L432](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L432) |
| Rename domain | [L486](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L486) |
| Follow/unfollow subdomain and create nested sub domain | [L513](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L513) |
| Should clear assets from data products after deletion of data product in Domain | [L620](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L620) |
| Should inherit owners and experts from parent domain | [L685](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L685) |
| Domain owner should able to edit description of domain | [L739](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L739) |
| Verify domain and subdomain asset count accuracy | [L774](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L774) |
| Verify domain tags and glossary terms | [L898](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L898) |
| Verify data product tags and glossary terms | [L937](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L937) |
| Verify clicking All Domains sets active domain to default value | [L962](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L962) |
| Verify redirect path on data product delete | [L988](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L988) |
| Verify duplicate domain creation | [L1027](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1027) |
| Create domain custom property and verify value persistence | [L1063](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1063) |
| Domain announcement create, edit & delete | [L1163](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1163) |
| Data Product announcement create, edit & delete | [L1197](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1197) |
| should handle domain after description is deleted | [L1245](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1245) |
| should handle data product after description is deleted | [L1284](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1284) |

### Domains Rbac

| Test | Line |
|------|------|
| Domain Rbac | [L1392](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1392) |

### Data Consumer Domain Ownership

| Test | Line |
|------|------|
| Data consumer can manage domain as owner | [L1511](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1511) |

### Domain Access with hasDomain() Rule

| Test | Line |
|------|------|
| User with hasDomain() rule can access domain and subdomain assets | [L1596](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1596) |

### Domain Access with noDomain() Rule

| Test | Line |
|------|------|
| User with noDomain() rule cannot access tables without domain | [L1668](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1668) |

### Domain Tree View Functionality

| Test | Line |
|------|------|
| should render the domain tree view with correct details | [L1750](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1750) |

## DomainDataProductsWidgets

**File:** [`playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts)
**Tests:** 6

### Root Tests

| Test | Line |
|------|------|
| Assign Widgets | [L88](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L88) |
| Verify Widgets are having 0 count initially | [L102](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L102) |
| Domain asset count should update when assets are added | [L115](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L115) |
| Data Product asset count should update when assets are added | [L136](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L136) |
| Domain asset count should update when assets are removed | [L160](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L160) |
| Data Product asset count should update when assets are removed | [L196](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L196) |

## DomainPermissions

**File:** [`playwright/e2e/Features/Permissions/DomainPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts)
**Tests:** 2

### Root Tests

| Test | Line |
|------|------|
| Domain allow operations | [L89](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts#L89) |
| Domain deny operations | [L162](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts#L162) |

## SubDomainPagination

**File:** [`playwright/e2e/Pages/SubDomainPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts)
**Tests:** 1

### SubDomain Pagination

| Test | Line |
|------|------|
| Verify subdomain count and pagination functionality | [L71](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts#L71) |


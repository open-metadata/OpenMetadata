---
title: Domains & Data Products
---

# Domains & Data Products

## Table of contents
[[toc]]

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 4 |
| **Test Cases** | 35 |
| **Test Steps** | 33 |
| **Total Scenarios** | 68 |

---

## Domains

📁 **File:** [`src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 26 |
| Steps | 29 |

### Domains

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Create domains and add assets | Create domains and add assets | 3 | [L162](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L162) |
| | ↳ *Create domain* | | | [L166](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L166) |
| | ↳ *Add assets to domain* | | | [L178](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L178) |
| | ↳ *Delete domain using delete modal* | | | [L183](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L183) |
| 2 | Create DataProducts and add remove assets | Create DataProducts and add remove assets | 6 | [L210](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L210) |
| | ↳ *Add assets to domain* | | | [L221](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L221) |
| | ↳ *Create DataProducts* | | | [L227](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L227) |
| | ↳ *Follow & Un-follow DataProducts* | | | [L241](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L241) |
| | ↳ *Verify empty assets message and Add Asset button* | | | [L276](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L276) |
| | ↳ *Add assets to DataProducts* | | | [L311](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L311) |
| | ↳ *Remove assets from DataProducts* | | | [L322](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L322) |
| 3 | Follow & Un-follow domain | Follow & Un-follow domain | - | [L340](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L340) |
| 4 | Add, Update custom properties for data product | Add, Update custom properties for data product | 3 | [L383](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L383) |
| | ↳ *Create DataProduct and custom properties for it* | | | [L395](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L395) |
| | ↳ *Set ${titleText} Custom Property* | | | [L404](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L404) |
| | ↳ *Update ${titleText} Custom Property* | | | [L416](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L416) |
| 5 | Switch domain from navbar and check domain query call wrap in quotes | Switch domain from navbar and check domain query call wrap in quotes | - | [L432](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L432) |
| 6 | Rename domain | Rename domain | - | [L486](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L486) |
| 7 | Follow/unfollow subdomain and create nested sub domain | Follow/unfollow subdomain and create nested sub domain | - | [L513](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L513) |
| 8 | Should clear assets from data products after deletion of data product in Domain | Clear assets from data products after deletion of data product in Domain | 1 | [L620](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L620) |
| | ↳ *Delete domain & recreate the same domain and data product* | | | [L659](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L659) |
| 9 | Should inherit owners and experts from parent domain | Inherit owners and experts from parent domain | - | [L685](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L685) |
| 10 | Domain owner should able to edit description of domain | Domain owner should able to edit description of domain | - | [L739](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L739) |
| 11 | Verify domain and subdomain asset count accuracy | Domain and subdomain asset count accuracy | 5 | [L774](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L774) |
| | ↳ *Create domain and subdomain via API* | | | [L785](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L785) |
| | ↳ *Add assets to domain* | | | [L791](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L791) |
| | ↳ *Add assets to subdomain* | | | [L800](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L800) |
| | ↳ *Verify domain asset count matches displayed cards* | | | [L829](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L829) |
| | ↳ *Verify subdomain asset count matches displayed cards* | | | [L854](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L854) |
| 12 | Verify domain tags and glossary terms | Domain tags and glossary terms | - | [L898](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L898) |
| 13 | Verify data product tags and glossary terms | Data product tags and glossary terms | - | [L937](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L937) |
| 14 | Verify clicking All Domains sets active domain to default value | Clicking All Domains sets active domain to default value | - | [L962](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L962) |
| 15 | Verify redirect path on data product delete | Redirect path on data product delete | - | [L988](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L988) |
| 16 | Verify duplicate domain creation | Duplicate domain creation | - | [L1027](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1027) |
| 17 | Create domain custom property and verify value persistence | Create domain custom property and verify value persistence | 4 | [L1063](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1063) |
| | ↳ *Create custom property for domain entity* | | | [L1078](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1078) |
| | ↳ *Navigate to domain and assign custom property value* | | | [L1093](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1093) |
| | ↳ *Reload and verify custom property value persists* | | | [L1129](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1129) |
| | ↳ *Cleanup custom property* | | | [L1152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1152) |
| 18 | Domain announcement create, edit & delete | Domain announcement create, edit & delete | - | [L1163](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1163) |
| 19 | Data Product announcement create, edit & delete | Data Product announcement create, edit & delete | - | [L1197](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1197) |
| 20 | should handle domain after description is deleted | Handle domain after description is deleted | - | [L1245](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1245) |
| 21 | should handle data product after description is deleted | Handle data product after description is deleted | - | [L1286](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1286) |

### Domains Rbac

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Domain Rbac | Domain Rbac | 2 | [L1408](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1408) |
| | ↳ *Assign assets to domains* | | | [L1420](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1420) |
| | ↳ *User with access to multiple domains* | | | [L1432](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1432) |

### Data Consumer Domain Ownership

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Data consumer can manage domain as owner | Data consumer can manage domain as owner | 1 | [L1527](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1527) |
| | ↳ *Check domain management permissions for data consumer owner* | | | [L1531](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1531) |

### Domain Access with hasDomain() Rule

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | User with hasDomain() rule can access domain and subdomain assets | User with hasDomain() rule can access domain and subdomain assets | 2 | [L1612](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1612) |
| | ↳ *Verify user can access domain assets* | | | [L1619](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1619) |
| | ↳ *Verify user can access subdomain assets* | | | [L1638](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1638) |

### Domain Access with noDomain() Rule

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | User with noDomain() rule cannot access tables without domain | User with noDomain() rule cannot access tables without domain | 2 | [L1684](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1684) |
| | ↳ *Verify user can access domain-assigned table* | | | [L1690](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1690) |
| | ↳ *Verify user gets permission error for table without domain* | | | [L1711](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1711) |

### Domain Tree View Functionality

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should render the domain tree view with correct details | Render the domain tree view with correct details | - | [L1766](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts#L1766) |

---


## DomainDataProductsWidgets

📁 **File:** [`src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 6 |
| Steps | 0 |

### Standalone Tests

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Assign Widgets | Assign Widgets | - | [L88](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L88) |
| 2 | Verify Widgets are having 0 count initially | Widgets are having 0 count initially | - | [L102](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L102) |
| 3 | Domain asset count should update when assets are added | Domain asset count should update when assets are added | - | [L115](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L115) |
| 4 | Data Product asset count should update when assets are added | Data Product asset count should update when assets are added | - | [L136](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L136) |
| 5 | Domain asset count should update when assets are removed | Domain asset count should update when assets are removed | - | [L160](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L160) |
| 6 | Data Product asset count should update when assets are removed | Data Product asset count should update when assets are removed | - | [L196](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts#L196) |

---


## SubDomainPagination

📁 **File:** [`src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 4 |

### SubDomain Pagination

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify subdomain count and pagination functionality | Subdomain count and pagination functionality | 4 | [L71](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts#L71) |
| | ↳ *Verify subdomain count in tab label* | | | [L79](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts#L79) |
| | ↳ *Navigate to subdomains tab and verify initial data load* | | | [L87](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts#L87) |
| | ↳ *Test pagination navigation* | | | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts#L110) |
| | ↳ *Create new subdomain and verify count updates* | | | [L120](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts#L120) |

---


## DomainPermissions

📁 **File:** [`src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 0 |

### Standalone Tests

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Domain allow operations | Domain allow operations | - | [L89](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts#L89) |
| 2 | Domain deny operations | Domain deny operations | - | [L162](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts#L162) |

---


---
layout: default
title: Data Assets
parent: Components
nav_order: 254
---

# Data Assets
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 28 |
| **Test Cases** | 180 |
| **Test Steps** | 74 |
| **Total Scenarios** | 254 |

---

## RightEntityPanelFlow

📁 **File:** [`playwright/e2e/Flow/RightEntityPanelFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 40 |
| Steps | 0 |
| Total | 40 |

### Right Entity Panel - Admin User Flow
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Admin - Overview Tab - Description Section - Add and Update | Admin - Overview Tab - Description Section - Add and Update | - | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L110) |
| 2 | Admin - Overview Tab - Owners Section - Add and Update, Verify Deleted Users Not Visible | Admin - Overview Tab - Owners Section - Add and Update, Verify Deleted Users Not Visible | - | [L126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L126) |
| 3 | Admin - Overview Tab - Owners Section - Add Team Owner and Verify Deleted Teams Not Visible | Admin - Overview Tab - Owners Section - Add Team Owner and Verify Deleted Teams Not Visible | - | [L198](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L198) |
| 4 | Admin - Overview Tab - Tags Section - Add Tag and Verify Deleted Tags Not Visible | Admin - Overview Tab - Tags Section - Add Tag and Verify Deleted Tags Not Visible | - | [L270](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L270) |
| 5 | Admin - Overview Tab - Glossary Terms Section - Add Term and Verify Deleted Terms Not Visible | Admin - Overview Tab - Glossary Terms Section - Add Term and Verify Deleted Terms Not Visible | - | [L332](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L332) |
| 6 | Admin - Overview Tab - Tier Section - Add and Update | Admin - Overview Tab - Tier Section - Add and Update | - | [L395](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L395) |
| 7 | Admin - Overview Tab - Domains Section - Add and Update | Admin - Overview Tab - Domains Section - Add and Update | - | [L415](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L415) |
| 8 | Admin - Schema Tab - View Schema | Admin - Schema Tab - View Schema | - | [L434](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L434) |
| 9 | Lineage Tab - No Lineage | Lineage Tab - No Lineage | - | [L476](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L476) |
| 10 | Lineage Tab - With Upstream and Downstream | Lineage Tab - With Upstream and Downstream | - | [L497](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L497) |
| 11 | Data Quality Tab - No Test Cases | Data Quality Tab - No Test Cases | - | [L621](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L621) |
| 12 | Data Quality Tab - Incidents Empty State | Data Quality Tab - Incidents Empty State | - | [L644](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L644) |
| 13 | Data Quality Tab - With Test Cases | Data Quality Tab - With Test Cases | - | [L667](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L667) |
| 14 | Data Quality Tab - Incidents Tab | Data Quality Tab - Incidents Tab | - | [L879](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L879) |
| 15 | Data Quality Tab - Incidents Tab - Test Case Link Navigation | Data Quality Tab - Incidents Tab - Test Case Link Navigation | - | [L996](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L996) |
| 16 | Admin - Custom Properties Tab - View Custom Properties | Admin - Custom Properties Tab - View Custom Properties | - | [L1058](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1058) |
| 17 | Admin - Custom Properties Tab - Search Functionality | Admin - Custom Properties Tab - Search Functionality | - | [L1143](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1143) |
| 18 | Admin - Custom Properties Tab - Different Property Types Display | Admin - Custom Properties Tab - Different Property Types Display | - | [L1241](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1241) |
| 19 | Admin - Custom Properties Tab - Empty State | Admin - Custom Properties Tab - Empty State | - | [L1351](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1351) |

### Right Entity Panel - Data Steward User Flow
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Data Steward - Overview Tab - Description Section - Add and Update | Data Steward - Overview Tab - Description Section - Add and Update | - | [L1394](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1394) |
| 2 | Data Steward - Overview Tab - Owners Section - Add and Update | Data Steward - Overview Tab - Owners Section - Add and Update | - | [L1419](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1419) |
| 3 | Data Steward - Overview Tab - Tier Section - Add and Update | Data Steward - Overview Tab - Tier Section - Add and Update | - | [L1441](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1441) |
| 4 | Data Steward - Overview Tab - Tags Section - Add and Update | Data Steward - Overview Tab - Tags Section - Add and Update | - | [L1463](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1463) |
| 5 | Data Steward - Overview Tab - Glossary Terms Section - Add and Update | Data Steward - Overview Tab - Glossary Terms Section - Add and Update | - | [L1482](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1482) |
| 6 | Data Steward - Overview Tab - Should NOT have permissions for Domains | Data Steward - Overview Tab - Should NOT have permissions for Domains | - | [L1499](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1499) |
| 7 | Data Steward - Schema Tab - View Schema | Data Steward - Schema Tab - View Schema | - | [L1508](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1508) |
| 8 | Data Steward - Lineage Tab - No Lineage | Data Steward - Lineage Tab - No Lineage | - | [L1552](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1552) |
| 9 | Data Steward - Data Quality Tab - No Test Cases | Data Steward - Data Quality Tab - No Test Cases | - | [L1577](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1577) |
| 10 | Data Steward - Custom Properties Tab - View Custom Properties | Data Steward - Custom Properties Tab - View Custom Properties | - | [L1604](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1604) |

### Right Entity Panel - Data Consumer User Flow
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Data Consumer - Overview Tab - Description Section - Add and Update | Data Consumer - Overview Tab - Description Section - Add and Update | - | [L1659](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1659) |
| 2 | Data Consumer - Overview Tab - Owners Section - View Owners | Data Consumer - Overview Tab - Owners Section - View Owners | - | [L1684](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1684) |
| 3 | Data Consumer - Overview Tab - Tier Section - Add and Update | Data Consumer - Overview Tab - Tier Section - Add and Update | - | [L1696](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1696) |
| 4 | Data Consumer - Overview Tab - Tags Section - Add and Update | Data Consumer - Overview Tab - Tags Section - Add and Update | - | [L1718](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1718) |
| 5 | Data Consumer - Overview Tab - Glossary Terms Section - Add and Update | Data Consumer - Overview Tab - Glossary Terms Section - Add and Update | - | [L1735](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1735) |
| 6 | Data Consumer - Overview Tab - Should NOT have permissions for Domains & Data Products | Data Consumer - Overview Tab - Should NOT have permissions for Domains & Data Products | - | [L1752](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1752) |
| 7 | Data Consumer - Schema Tab - View Schema | Data Consumer - Schema Tab - View Schema | - | [L1768](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1768) |
| 8 | Data Consumer - Lineage Tab - No Lineage | Data Consumer - Lineage Tab - No Lineage | - | [L1807](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1807) |
| 9 | Data Consumer - Data Quality Tab - No Test Cases | Data Consumer - Data Quality Tab - No Test Cases | - | [L1827](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1827) |
| 10 | Data Consumer - Data Quality Tab - Incidents Empty State | Data Consumer - Data Quality Tab - Incidents Empty State | - | [L1847](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1847) |
| 11 | Data Consumer - Custom Properties Tab - View Custom Properties | Data Consumer - Custom Properties Tab - View Custom Properties | - | [L1867](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1867) |

---

## Entity

📁 **File:** [`playwright/e2e/Pages/Entity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 26 |
| Steps | 8 |
| Total | 34 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Domain Add, Update and Remove | Domain Add, Update and Remove | - | [L130](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L130) |
| 2 | Domain Propagation | Domain Propagation | - | [L143](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L143) |
| 3 | User as Owner Add, Update and Remove | User as Owner Add, Update and Remove | - | [L180](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L180) |
| 4 | Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove | - | [L189](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L189) |
| 5 | User as Owner with unsorted list | User as Owner with unsorted list | - | [L195](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L195) |
| 6 | Tier Add, Update and Remove | Tier Add, Update and Remove | - | [L245](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L245) |
| 7 | Certification Add Remove | Certification Add Remove | - | [L255](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L255) |
| 8 | ${entityName} page should show the project name | ${entityName} page should show the project name | - | [L265](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L265) |
| 9 | Update description | Update description | - | [L274](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L274) |
| 10 | Tag Add, Update and Remove | Tag Add, Update and Remove | - | [L278](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L278) |
| 11 | Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove | - | [L290](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L290) |
| 12 | Tag and Glossary Selector should close vice versa | Tag and Glossary Selector should close vice versa | - | [L311](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L311) |
| 13 | Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities | - | [L363](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L363) |
| 14 | Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities | - | [L383](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L383) |
| 15 | DisplayName Add, Update and Remove for child entities | DisplayName Add, Update and Remove for child entities | - | [L399](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L399) |
| 16 | Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities | - | [L412](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L412) |
| 17 | Announcement create, edit & delete | Announcement create, edit & delete | - | [L426](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L426) |
| 18 | Inactive Announcement create & delete | Inactive Announcement create & delete | - | [L432](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L432) |
| 19 | UpVote & DownVote entity | UpVote & DownVote entity | - | [L436](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L436) |
| 20 | Follow & Un-follow entity | Follow & Un-follow entity | - | [L441](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L441) |
| 21 | Set & Update ${titleText} Custom Property  | Set & Update ${titleText} Custom Property  | 2 | [L453](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L453) |
| 22 | Update displayName | Update displayName | - | [L485](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L485) |
| 23 | User should be denied access to edit description when deny policy rule is applied on an entity | User should be denied access to edit description when deny policy rule is applied on an entity | - | [L489](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L489) |
| 24 | Switch from Data Observability tab to Activity Feed tab and verify data appears | Switch from Data Observability tab to Activity Feed tab and verify data appears | 4 | [L549](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L549) |
| 25 | Data Consumer should be denied access to queries and sample data tabs when deny policy rule is applied on table level | Data Consumer should be denied access to queries and sample data tabs when deny policy rule is applied on table level | - | [L635](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L635) |
| 26 | Delete ${deleteEntity.getType()} | Delete ${deleteEntity.getType()} | 2 | [L720](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L720) |

---

## BulkImport

📁 **File:** [`playwright/e2e/Features/BulkImport.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 6 |
| Steps | 27 |
| Total | 33 |

### Bulk Import Export
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Database service | Database service | 3 | [L134](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L134) |
| | ↳ *create custom properties for extension edit* | | | [L145](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L145) |
| | ↳ *should export data database service details* | | | [L152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L152) |
| | ↳ *should import and edit with two additional database* | | | [L157](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L157) |
| 2 | Database | Database | 3 | [L385](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L385) |
| | ↳ *create custom properties for extension edit* | | | [L396](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L396) |
| | ↳ *should export data database details* | | | [L403](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L403) |
| | ↳ *should import and edit with two additional database schema* | | | [L408](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L408) |
| 3 | Database Schema | Database Schema | 3 | [L583](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L583) |
| | ↳ *create custom properties for extension edit* | | | [L594](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L594) |
| | ↳ *should export data database schema details* | | | [L601](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L601) |
| | ↳ *should import and edit with two additional table* | | | [L606](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L606) |
| 4 | Table | Table | 2 | [L757](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L757) |
| | ↳ *should export data table details* | | | [L765](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L765) |
| | ↳ *should import and edit with two additional columns* | | | [L770](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L770) |
| 5 | Keyboard Delete selection | Keyboard Delete selection | 6 | [L848](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L848) |
| | ↳ *should export data database schema details* | | | [L856](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L856) |
| | ↳ *should import and perform edit operation on entity* | | | [L861](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L861) |
| | ↳ *should export data database schema details after edit changes* | | | [L942](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L942) |
| | ↳ *Perform Column Select and Delete Operation* | | | [L950](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L950) |
| | ↳ *Perform Cell Delete Operation and Save* | | | [L973](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L973) |
| | ↳ *should verify the removed value from entity* | | | [L1015](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1015) |
| 6 | Range selection ⏭️ | Range selection | 10 | [L1048](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1048) |
| | ↳ *should export data database details* | | | [L1057](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1057) |
| | ↳ *should import and test range selection* | | | [L1062](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1062) |
| | ↳ *Ctrl+a should select all cells in the grid and deselect all cells by clicking on second cell of .rdg-row* | | | [L1078](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1078) |
| | ↳ *should select all the cells in the column by clicking on column header* | | | [L1102](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1102) |
| | ↳ *allow multiple column selection* | | | [L1126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1126) |
| | ↳ *allow multiple column selection using keyboard* | | | [L1160](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1160) |
| | ↳ *allow multiple cell selection using mouse on rightDown and leftUp and extend selection using shift+click* | | | [L1180](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1180) |
| | ↳ *allow multiple cell selection using keyboard on rightDown and leftUp* | | | [L1252](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1252) |
| | ↳ *perform single cell copy-paste and undo-redo* | | | [L1293](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1293) |
| | ↳ *Select range, copy-paste and undo-redo* | | | [L1331](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts#L1331) |

---

## ServiceEntity

📁 **File:** [`playwright/e2e/Pages/ServiceEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 14 |
| Steps | 4 |
| Total | 18 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Domain Add, Update and Remove | Domain Add, Update and Remove | - | [L92](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L92) |
| 2 | User as Owner Add, Update and Remove | User as Owner Add, Update and Remove | - | [L105](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L105) |
| 3 | Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove | - | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L114) |
| 4 | Tier Add, Update and Remove | Tier Add, Update and Remove | - | [L120](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L120) |
| 5 | Certification Add Remove | Certification Add Remove | - | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L125) |
| 6 | Update description | Update description | - | [L134](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L134) |
| 7 | Tag Add, Update and Remove | Tag Add, Update and Remove | - | [L138](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L138) |
| 8 | Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove | - | [L142](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L142) |
| 9 | Announcement create, edit & delete | Announcement create, edit & delete | - | [L150](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L150) |
| 10 | Inactive Announcement create & delete | Inactive Announcement create & delete | - | [L156](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L156) |
| 11 | Set & Update ${titleText} Custom Property  | Set & Update ${titleText} Custom Property  | 2 | [L165](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L165) |
| 12 | Follow & Un-follow entity for Database Entity | Follow & Un-follow entity for Database Entity | - | [L197](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L197) |
| 13 | Update displayName | Update displayName | - | [L207](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L207) |
| 14 | Delete ${deleteEntity.getType()} | Delete ${deleteEntity.getType()} | 2 | [L218](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L218) |

---

## BulkEditEntity

📁 **File:** [`playwright/e2e/Features/BulkEditEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 5 |
| Steps | 8 |
| Total | 13 |

### Bulk Edit Entity
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Database service | Database service | 2 | [L98](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L98) |
| | ↳ *create custom properties for extension edit* | | | [L107](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L107) |
| | ↳ *Perform bulk edit action* | | | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L114) |
| 2 | Database | Database | 2 | [L231](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L231) |
| | ↳ *create custom properties for extension edit* | | | [L241](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L241) |
| | ↳ *Perform bulk edit action* | | | [L248](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L248) |
| 3 | Database Schema | Database Schema | 2 | [L375](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L375) |
| | ↳ *create custom properties for extension edit* | | | [L384](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L384) |
| | ↳ *Perform bulk edit action* | | | [L391](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L391) |
| 4 | Table | Table | 1 | [L514](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L514) |
| | ↳ *Perform bulk edit action* | | | [L522](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L522) |
| 5 | Glossary | Glossary | 1 | [L606](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L606) |
| | ↳ *Perform bulk edit action* | | | [L617](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L617) |

---

## EntityDataSteward

📁 **File:** [`playwright/e2e/Pages/EntityDataSteward.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 13 |
| Steps | 0 |
| Total | 13 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | User as Owner Add, Update and Remove | User as Owner Add, Update and Remove | - | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L110) |
| 2 | Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove | - | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L119) |
| 3 | Tier Add, Update and Remove | Tier Add, Update and Remove | - | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L125) |
| 4 | Update description | Update description | - | [L129](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L129) |
| 5 | Tag Add, Update and Remove | Tag Add, Update and Remove | - | [L133](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L133) |
| 6 | Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove | - | [L137](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L137) |
| 7 | Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities | - | [L147](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L147) |
| 8 | Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities | - | [L165](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L165) |
| 9 | DisplayName Add, Update and Remove for child entities | DisplayName Add, Update and Remove for child entities | - | [L181](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L181) |
| 10 | Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities | - | [L194](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L194) |
| 11 | UpVote & DownVote entity | UpVote & DownVote entity | - | [L208](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L208) |
| 12 | Follow & Un-follow entity | Follow & Un-follow entity | - | [L213](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L213) |
| 13 | Update displayName | Update displayName | - | [L220](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L220) |

---

## Table

📁 **File:** [`playwright/e2e/Features/Table.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 12 |
| Steps | 0 |
| Total | 12 |

### Table pagination sorting search scenarios 
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Table pagination with sorting should works | Table pagination with sorting should works | - | [L60](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L60) |
| 2 | Table search with sorting should works | Table search with sorting should works | - | [L83](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L83) |
| 3 | Table filter with sorting should works | Table filter with sorting should works | - | [L96](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L96) |
| 4 | Table page should show schema tab with count | Table page should show schema tab with count | - | [L128](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L128) |
| 5 | should persist current page | Persist current page | - | [L136](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L136) |
| 6 | should persist page size | Persist page size | - | [L205](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L205) |

### Table & Data Model columns table pagination
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | pagination for table column should work | Pagination for table column should work | - | [L258](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L258) |
| 2 | pagination for dashboard data model columns should work | Pagination for dashboard data model columns should work | - | [L278](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L278) |
| 3 | expand collapse should only visible for nested columns | Expand collapse should only visible for nested columns | - | [L344](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L344) |
| 4 | expand / collapse should not appear after updating nested fields table | Expand / collapse should not appear after updating nested fields table | - | [L415](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L415) |
| 5 | Glossary term should be consistent for search | Glossary term should be consistent for search | - | [L481](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L481) |
| 6 | Tags term should be consistent for search | Tags term should be consistent for search | - | [L580](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L580) |

---

## EntityDataConsumer

📁 **File:** [`playwright/e2e/Pages/EntityDataConsumer.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 12 |
| Steps | 0 |
| Total | 12 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | User as Owner Add, Update and Remove | User as Owner Add, Update and Remove | - | [L91](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L91) |
| 2 | No edit owner permission | No edit owner permission | - | [L100](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L100) |
| 3 | Tier Add, Update and Remove | Tier Add, Update and Remove | - | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L110) |
| 4 | Update description | Update description | - | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L114) |
| 5 | Tag Add, Update and Remove | Tag Add, Update and Remove | - | [L118](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L118) |
| 6 | Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove | - | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L122) |
| 7 | Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities | - | [L132](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L132) |
| 8 | DisplayName edit for child entities should not be allowed | DisplayName edit for child entities should not be allowed | - | [L148](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L148) |
| 9 | Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities | - | [L161](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L161) |
| 10 | Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities | - | [L177](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L177) |
| 11 | UpVote & DownVote entity | UpVote & DownVote entity | - | [L194](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L194) |
| 12 | Follow & Un-follow entity | Follow & Un-follow entity | - | [L199](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L199) |

---

## TableSorting

📁 **File:** [`playwright/e2e/Features/TableSorting.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 11 |
| Steps | 0 |
| Total | 11 |

### Database Schema page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Database Schema page should have sorting on name column | Database Schema page should have sorting on name column | - | [L36](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L36) |
| 2 | Services page should have sorting on name column | Services page should have sorting on name column | - | [L63](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L63) |

### API Endpoint page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | API Endpoint page should have sorting on name column | API Endpoint page should have sorting on name column | - | [L69](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L69) |

### API Endpoint schema
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | API Endpoint schema should have sorting on name column | API Endpoint schema should have sorting on name column | - | [L99](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L99) |

### Database Schema Tables tab
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Database Schema Tables tab should have sorting on name column | Database Schema Tables tab should have sorting on name column | - | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L110) |
| 2 | Data Observability services page should have sorting on name column | Data Observability services page should have sorting on name column | - | [L139](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L139) |

### Data Models Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Data Models Table should have sorting on name column | Data Models Table should have sorting on name column | - | [L147](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L147) |

### Stored Procedure Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Stored Procedure Table should have sorting on name column | Stored Procedure Table should have sorting on name column | - | [L175](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L175) |

### Topics Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Topics Table should have sorting on name column | Topics Table should have sorting on name column | - | [L209](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L209) |

### Drives Service Files Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Drives Service Files Table should have sorting on name column | Drives Service Files Table should have sorting on name column | - | [L237](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L237) |

### Drives Service Spreadsheets Table
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Drives Service Spreadsheets Table should have sorting on name column | Drives Service Spreadsheets Table should have sorting on name column | - | [L267](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L267) |

---

## QueryEntity

📁 **File:** [`playwright/e2e/Features/QueryEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 6 |
| Total | 9 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Query Entity | Query Entity | 6 | [L61](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts#L61) |
| 2 | Verify query duration | Query duration | - | [L320](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts#L320) |
| 3 | Verify Query Pagination | Query Pagination | - | [L338](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts#L338) |

---

## EntitySummaryPanel

📁 **File:** [`playwright/e2e/Features/EntitySummaryPanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 7 |
| Steps | 0 |
| Total | 7 |

### Entity Summary Panel
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should display summary panel for ${entityType} | Display summary panel for ${entityType} | - | [L79](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L79) |
| 2 | should render entity title section with link | Render entity title section with link | - | [L89](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L89) |
| 3 | should display owners section | Display owners section | - | [L107](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L107) |
| 4 | should display domain section | Display domain section | - | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L122) |
| 5 | should display tags section | Display tags section | - | [L137](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L137) |
| 6 | should navigate between tabs | Navigate between tabs | - | [L152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L152) |
| 7 | should display description section | Display description section | - | [L164](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L164) |

---

## MetricCustomUnitFlow

📁 **File:** [`playwright/e2e/Features/MetricCustomUnitFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 6 |
| Total | 7 |

### Metric Custom Unit of Measurement Flow
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should create metric and test unit of measurement updates | Create metric and test unit of measurement updates | 6 | [L30](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts#L30) |
| | ↳ *Navigate to Metrics and create a metric* | | | [L35](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts#L35) |
| | ↳ *Verify initial unit of measurement is displayed* | | | [L112](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts#L112) |
| | ↳ *Update unit of measurement to Dollars* | | | [L121](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts#L121) |
| | ↳ *Remove unit of measurement* | | | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts#L125) |
| | ↳ *Set unit back to Percentage* | | | [L129](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts#L129) |
| | ↳ *Clean up - delete the metric* | | | [L133](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts#L133) |

---

## Metric

📁 **File:** [`playwright/e2e/Flow/Metric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 6 |
| Steps | 0 |
| Total | 6 |

### Metric Entity Special Test Cases
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify Metric Type Update | Metric Type Update | - | [L85](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L85) |
| 2 | Verify Unit of Measurement Update | Unit of Measurement Update | - | [L91](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L91) |
| 3 | Verify Granularity Update | Granularity Update | - | [L97](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L97) |
| 4 | verify metric expression update | Metric expression update | - | [L103](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L103) |
| 5 | Verify Related Metrics Update | Related Metrics Update | - | [L108](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L108) |

### Listing page and add Metric flow should work
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Metric listing page and add metric from the  | Metric listing page and add metric from the  | - | [L138](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L138) |

---

## EntityVersionPages

📁 **File:** [`playwright/e2e/VersionPages/EntityVersionPages.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 5 |
| Total | 6 |

### Entity Version pages
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | ${entity.getType()} | ${entity.getType()} | 5 | [L152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts#L152) |
| | ↳ *should show edited tags and description changes* | | | [L166](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts#L166) |
| | ↳ *should show owner changes* | | | [L195](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts#L195) |
| | ↳ *should show column display name changes properly* | | | [L225](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts#L225) |
| | ↳ *should show tier changes* | | | [L262](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts#L262) |
| | ↳ *should show version details after soft deleted* | | | [L292](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts#L292) |

---

## ServiceEntityVersionPage

📁 **File:** [`playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 4 |
| Total | 5 |

### Service Version pages
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | ${entity.getType()} | ${entity.getType()} | 4 | [L134](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts#L134) |
| | ↳ *should show edited tags and description changes* | | | [L140](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts#L140) |
| | ↳ *should show owner changes* | | | [L169](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts#L169) |
| | ↳ *should show tier changes* | | | [L191](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts#L191) |
| | ↳ *should show version details after soft deleted* | | | [L205](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts#L205) |

---

## EntityPermissions

📁 **File:** [`playwright/e2e/Features/Permissions/EntityPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 4 |
| Steps | 0 |
| Total | 4 |

### Allow permissions
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | ${entityType} allow common operations permissions | ${entityType} allow common operations permissions | - | [L113](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L113) |
| 2 | ${entityType} allow entity-specific permission operations | ${entityType} allow entity-specific permission operations | - | [L123](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L123) |

### Deny permissions
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | ${entityType} deny common operations permissions | ${entityType} deny common operations permissions | - | [L160](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L160) |
| 2 | ${entityType} deny entity-specific permission operations | ${entityType} deny entity-specific permission operations | - | [L170](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L170) |

---

## SchemaTable

📁 **File:** [`playwright/e2e/Flow/SchemaTable.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SchemaTable.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 2 |
| Total | 4 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | schema table test | Schema table test | 2 | [L96](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SchemaTable.spec.ts#L96) |
| 2 | Schema Table Pagination should work Properly | Schema Table Pagination should work Properly | - | [L150](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SchemaTable.spec.ts#L150) |

---

## Container

📁 **File:** [`playwright/e2e/Features/Container.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 0 |
| Total | 3 |

### Container entity specific tests 
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Container page should show Schema and Children count | Container page should show Schema and Children count | - | [L52](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts#L52) |
| 2 | Container page children pagination | Container page children pagination | - | [L63](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts#L63) |
| 3 | expand / collapse should not appear after updating nested fields for container | Expand / collapse should not appear after updating nested fields for container | - | [L124](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts#L124) |

---

## Dashboards

📁 **File:** [`playwright/e2e/Features/Dashboards.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 0 |
| Total | 3 |

### Dashboards
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should change the page size | Change the page size | - | [L55](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts#L55) |

### Dashboard and Charts deleted toggle
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should be able to toggle between deleted and non-deleted charts | Be able to toggle between deleted and non-deleted charts | - | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts#L114) |

### Data Model
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | expand / collapse should not appear after updating nested fields for dashboardDataModels | Expand / collapse should not appear after updating nested fields for dashboardDataModels | - | [L198](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts#L198) |

---

## ApiCollection

📁 **File:** [`playwright/e2e/Flow/ApiCollection.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 2 |
| Total | 3 |

### API Collection Entity Special Test Cases
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify Owner Propagation: owner should be propagated to the API Collection | Owner Propagation: owner should be propagated to the API Collection | 2 | [L40](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts#L40) |
| | ↳ *Verify user Owner Propagation: owner should be propagated to the API Collection* | | | [L45](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts#L45) |
| | ↳ *Verify team Owner Propagation: owner should be propagated to the API Collection* | | | [L72](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts#L72) |

---

## TableVersionPage

📁 **File:** [`playwright/e2e/VersionPages/TableVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TableVersionPage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 2 |
| Total | 3 |

### Table Version Page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Pagination and Search should works for columns | Pagination and Search should works for columns | 2 | [L21](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TableVersionPage.spec.ts#L21) |
| | ↳ *Pagination Should Work* | | | [L32](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TableVersionPage.spec.ts#L32) |
| | ↳ *Search Should Work* | | | [L36](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TableVersionPage.spec.ts#L36) |

---

## ServiceEntityPermissions

📁 **File:** [`playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 0 |
| Total | 2 |

### Allow permissions
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | ${entityType} allow common operations permissions | ${entityType} allow common operations permissions | - | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts#L110) |

### Deny permissions
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | ${entityType} deny common operations permissions | ${entityType} deny common operations permissions | - | [L136](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts#L136) |

---

## EntityRightCollapsablePanel

📁 **File:** [`playwright/e2e/Features/EntityRightCollapsablePanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntityRightCollapsablePanel.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Show and Hide Right Collapsable Panel | Show and Hide Right Collapsable Panel | - | [L39](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntityRightCollapsablePanel.spec.ts#L39) |

---

## RestoreEntityInheritedFields

📁 **File:** [`playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned | - | [L75](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts#L75) |

---

## SchemaDefinition

📁 **File:** [`playwright/e2e/Features/SchemaDefinition.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaDefinition.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Schema definition (views)
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify schema definition (views) of table entity | Schema definition (views) of table entity | - | [L32](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaDefinition.spec.ts#L32) |

---

## Topic

📁 **File:** [`playwright/e2e/Features/Topic.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Topic.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Topic entity specific tests 
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Topic page should show schema tab with count | Topic page should show schema tab with count | - | [L45](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Topic.spec.ts#L45) |

---

## ApiDocs

📁 **File:** [`playwright/e2e/Flow/ApiDocs.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiDocs.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### API docs should work properly
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | API docs should work properly | API docs should work properly | - | [L24](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiDocs.spec.ts#L24) |

---

## ApiServiceRest

📁 **File:** [`playwright/e2e/Flow/ApiServiceRest.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiServiceRest.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### API service
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | add update and delete api service type REST | Add update and delete api service type REST | - | [L40](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiServiceRest.spec.ts#L40) |

---


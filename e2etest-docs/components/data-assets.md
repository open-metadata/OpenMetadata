---
layout: default
title: Data Assets
parent: Components
nav_order: 177
---

# Data Assets

| Metric | Count |
|--------|-------|
| **Total Tests** | 177 |
| **Test Files** | 29 |

---

## RightEntityPanelFlow

**File:** [`playwright/e2e/Flow/RightEntityPanelFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts)
**Tests:** 40

### Right Entity Panel - Admin User Flow

| Test | Line |
|------|------|
| Admin - Overview Tab - Description Section - Add and Update | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L110) |
| Admin - Overview Tab - Owners Section - Add and Update, Verify Deleted Users Not Visible | [L126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L126) |
| Admin - Overview Tab - Owners Section - Add Team Owner and Verify Deleted Teams Not Visible | [L198](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L198) |
| Admin - Overview Tab - Tags Section - Add Tag and Verify Deleted Tags Not Visible | [L270](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L270) |
| Admin - Overview Tab - Glossary Terms Section - Add Term and Verify Deleted Terms Not Visible | [L332](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L332) |
| Admin - Overview Tab - Tier Section - Add and Update | [L395](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L395) |
| Admin - Overview Tab - Domains Section - Add and Update | [L415](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L415) |
| Admin - Schema Tab - View Schema | [L434](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L434) |
| Lineage Tab - No Lineage | [L476](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L476) |
| Lineage Tab - With Upstream and Downstream | [L497](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L497) |
| Data Quality Tab - No Test Cases | [L621](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L621) |
| Data Quality Tab - Incidents Empty State | [L644](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L644) |
| Data Quality Tab - With Test Cases | [L667](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L667) |
| Data Quality Tab - Incidents Tab | [L879](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L879) |
| Data Quality Tab - Incidents Tab - Test Case Link Navigation | [L996](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L996) |
| Admin - Custom Properties Tab - View Custom Properties | [L1058](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1058) |
| Admin - Custom Properties Tab - Search Functionality | [L1143](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1143) |
| Admin - Custom Properties Tab - Different Property Types Display | [L1241](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1241) |
| Admin - Custom Properties Tab - Empty State | [L1351](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1351) |

### Right Entity Panel - Data Steward User Flow

| Test | Line |
|------|------|
| Data Steward - Overview Tab - Description Section - Add and Update | [L1394](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1394) |
| Data Steward - Overview Tab - Owners Section - Add and Update | [L1419](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1419) |
| Data Steward - Overview Tab - Tier Section - Add and Update | [L1441](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1441) |
| Data Steward - Overview Tab - Tags Section - Add and Update | [L1463](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1463) |
| Data Steward - Overview Tab - Glossary Terms Section - Add and Update | [L1482](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1482) |
| Data Steward - Overview Tab - Should NOT have permissions for Domains | [L1499](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1499) |
| Data Steward - Schema Tab - View Schema | [L1508](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1508) |
| Data Steward - Lineage Tab - No Lineage | [L1552](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1552) |
| Data Steward - Data Quality Tab - No Test Cases | [L1577](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1577) |
| Data Steward - Custom Properties Tab - View Custom Properties | [L1604](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1604) |

### Right Entity Panel - Data Consumer User Flow

| Test | Line |
|------|------|
| Data Consumer - Overview Tab - Description Section - Add and Update | [L1659](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1659) |
| Data Consumer - Overview Tab - Owners Section - View Owners | [L1684](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1684) |
| Data Consumer - Overview Tab - Tier Section - Add and Update | [L1696](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1696) |
| Data Consumer - Overview Tab - Tags Section - Add and Update | [L1718](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1718) |
| Data Consumer - Overview Tab - Glossary Terms Section - Add and Update | [L1735](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1735) |
| Data Consumer - Overview Tab - Should NOT have permissions for Domains & Data Products | [L1752](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1752) |
| Data Consumer - Schema Tab - View Schema | [L1768](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1768) |
| Data Consumer - Lineage Tab - No Lineage | [L1807](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1807) |
| Data Consumer - Data Quality Tab - No Test Cases | [L1827](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1827) |
| Data Consumer - Data Quality Tab - Incidents Empty State | [L1847](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1847) |
| Data Consumer - Custom Properties Tab - View Custom Properties | [L1867](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts#L1867) |

## Entity

**File:** [`playwright/e2e/Pages/Entity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts)
**Tests:** 26

### Root Tests

| Test | Line |
|------|------|
| Domain Add, Update and Remove | [L130](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L130) |
| Domain Propagation | [L143](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L143) |
| User as Owner Add, Update and Remove | [L180](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L180) |
| Team as Owner Add, Update and Remove | [L189](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L189) |
| User as Owner with unsorted list | [L195](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L195) |
| Tier Add, Update and Remove | [L245](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L245) |
| Certification Add Remove | [L255](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L255) |
| ${entityName} page should show the project name | [L265](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L265) |
| Update description | [L274](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L274) |
| Tag Add, Update and Remove | [L278](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L278) |
| Glossary Term Add, Update and Remove | [L290](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L290) |
| Tag and Glossary Selector should close vice versa | [L311](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L311) |
| Tag Add, Update and Remove for child entities | [L363](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L363) |
| Glossary Term Add, Update and Remove for child entities | [L383](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L383) |
| DisplayName Add, Update and Remove for child entities | [L399](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L399) |
| Description Add, Update and Remove for child entities | [L412](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L412) |
| Announcement create, edit & delete | [L426](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L426) |
| Inactive Announcement create & delete | [L432](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L432) |
| UpVote & DownVote entity | [L436](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L436) |
| Follow & Un-follow entity | [L441](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L441) |
| Set & Update ${titleText} Custom Property  | [L453](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L453) |
| Update displayName | [L485](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L485) |
| User should be denied access to edit description when deny policy rule is applied on an entity | [L489](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L489) |
| Switch from Data Observability tab to Activity Feed tab and verify data appears | [L549](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L549) |
| Data Consumer should be denied access to queries and sample data tabs when deny policy rule is applied on table level | [L635](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L635) |
| Delete ${deleteEntity.getType()} | [L720](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts#L720) |

## ServiceEntity

**File:** [`playwright/e2e/Pages/ServiceEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts)
**Tests:** 14

### Root Tests

| Test | Line |
|------|------|
| Domain Add, Update and Remove | [L92](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L92) |
| User as Owner Add, Update and Remove | [L105](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L105) |
| Team as Owner Add, Update and Remove | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L114) |
| Tier Add, Update and Remove | [L120](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L120) |
| Certification Add Remove | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L125) |
| Update description | [L134](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L134) |
| Tag Add, Update and Remove | [L138](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L138) |
| Glossary Term Add, Update and Remove | [L142](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L142) |
| Announcement create, edit & delete | [L150](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L150) |
| Inactive Announcement create & delete | [L156](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L156) |
| Set & Update ${titleText} Custom Property  | [L165](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L165) |
| Follow & Un-follow entity for Database Entity | [L197](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L197) |
| Update displayName | [L207](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L207) |
| Delete ${deleteEntity.getType()} | [L218](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts#L218) |

## EntityDataSteward

**File:** [`playwright/e2e/Pages/EntityDataSteward.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts)
**Tests:** 13

### Root Tests

| Test | Line |
|------|------|
| User as Owner Add, Update and Remove | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L110) |
| Team as Owner Add, Update and Remove | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L119) |
| Tier Add, Update and Remove | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L125) |
| Update description | [L129](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L129) |
| Tag Add, Update and Remove | [L133](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L133) |
| Glossary Term Add, Update and Remove | [L137](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L137) |
| Tag Add, Update and Remove for child entities | [L147](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L147) |
| Glossary Term Add, Update and Remove for child entities | [L165](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L165) |
| DisplayName Add, Update and Remove for child entities | [L181](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L181) |
| Description Add, Update and Remove for child entities | [L194](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L194) |
| UpVote & DownVote entity | [L208](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L208) |
| Follow & Un-follow entity | [L213](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L213) |
| Update displayName | [L220](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts#L220) |

## Table

**File:** [`playwright/e2e/Features/Table.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts)
**Tests:** 12

### Table pagination sorting search scenarios 

| Test | Line |
|------|------|
| Table pagination with sorting should works | [L60](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L60) |
| Table search with sorting should works | [L83](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L83) |
| Table filter with sorting should works | [L96](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L96) |
| Table page should show schema tab with count | [L128](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L128) |
| should persist current page | [L136](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L136) |
| should persist page size | [L205](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L205) |

### Table & Data Model columns table pagination

| Test | Line |
|------|------|
| pagination for table column should work | [L258](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L258) |
| pagination for dashboard data model columns should work | [L278](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L278) |
| expand collapse should only visible for nested columns | [L344](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L344) |
| expand / collapse should not appear after updating nested fields table | [L415](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L415) |
| Glossary term should be consistent for search | [L481](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L481) |
| Tags term should be consistent for search | [L580](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts#L580) |

## EntityDataConsumer

**File:** [`playwright/e2e/Pages/EntityDataConsumer.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts)
**Tests:** 12

### Root Tests

| Test | Line |
|------|------|
| User as Owner Add, Update and Remove | [L91](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L91) |
| No edit owner permission | [L100](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L100) |
| Tier Add, Update and Remove | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L110) |
| Update description | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L114) |
| Tag Add, Update and Remove | [L118](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L118) |
| Glossary Term Add, Update and Remove | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L122) |
| Tag Add, Update and Remove for child entities | [L132](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L132) |
| DisplayName edit for child entities should not be allowed | [L148](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L148) |
| Description Add, Update and Remove for child entities | [L161](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L161) |
| Glossary Term Add, Update and Remove for child entities | [L177](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L177) |
| UpVote & DownVote entity | [L194](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L194) |
| Follow & Un-follow entity | [L199](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts#L199) |

## TableSorting

**File:** [`playwright/e2e/Features/TableSorting.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts)
**Tests:** 11

### Database Schema page

| Test | Line |
|------|------|
| Database Schema page should have sorting on name column | [L36](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L36) |
| Services page should have sorting on name column | [L63](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L63) |

### API Endpoint page

| Test | Line |
|------|------|
| API Endpoint page should have sorting on name column | [L69](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L69) |

### API Endpoint schema

| Test | Line |
|------|------|
| API Endpoint schema should have sorting on name column | [L99](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L99) |

### Database Schema Tables tab

| Test | Line |
|------|------|
| Database Schema Tables tab should have sorting on name column | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L110) |
| Data Observability services page should have sorting on name column | [L139](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L139) |

### Data Models Table

| Test | Line |
|------|------|
| Data Models Table should have sorting on name column | [L147](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L147) |

### Stored Procedure Table

| Test | Line |
|------|------|
| Stored Procedure Table should have sorting on name column | [L175](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L175) |

### Topics Table

| Test | Line |
|------|------|
| Topics Table should have sorting on name column | [L209](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L209) |

### Drives Service Files Table

| Test | Line |
|------|------|
| Drives Service Files Table should have sorting on name column | [L237](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L237) |

### Drives Service Spreadsheets Table

| Test | Line |
|------|------|
| Drives Service Spreadsheets Table should have sorting on name column | [L267](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts#L267) |

## EntitySummaryPanel

**File:** [`playwright/e2e/Features/EntitySummaryPanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts)
**Tests:** 7

### Entity Summary Panel

| Test | Line |
|------|------|
| should display summary panel for ${entityType} | [L79](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L79) |
| should render entity title section with link | [L89](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L89) |
| should display owners section | [L107](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L107) |
| should display domain section | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L122) |
| should display tags section | [L137](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L137) |
| should navigate between tabs | [L152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L152) |
| should display description section | [L164](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts#L164) |

## Metric

**File:** [`playwright/e2e/Flow/Metric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts)
**Tests:** 6

### Metric Entity Special Test Cases

| Test | Line |
|------|------|
| Verify Metric Type Update | [L85](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L85) |
| Verify Unit of Measurement Update | [L91](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L91) |
| Verify Granularity Update | [L97](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L97) |
| verify metric expression update | [L103](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L103) |
| Verify Related Metrics Update | [L108](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L108) |

### Listing page and add Metric flow should work

| Test | Line |
|------|------|
| Metric listing page and add metric from the  | [L138](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts#L138) |

## BulkEditEntity

**File:** [`playwright/e2e/Features/BulkEditEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts)
**Tests:** 5

### Bulk Edit Entity

| Test | Line |
|------|------|
| Database service | [L98](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L98) |
| Database | [L231](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L231) |
| Database Schema | [L375](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L375) |
| Table | [L514](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L514) |
| Glossary | [L606](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts#L606) |

## EntityPermissions

**File:** [`playwright/e2e/Features/Permissions/EntityPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts)
**Tests:** 4

### Allow permissions

| Test | Line |
|------|------|
| ${entityType} allow common operations permissions | [L113](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L113) |
| ${entityType} allow entity-specific permission operations | [L123](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L123) |

### Deny permissions

| Test | Line |
|------|------|
| ${entityType} deny common operations permissions | [L160](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L160) |
| ${entityType} deny entity-specific permission operations | [L170](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts#L170) |

## Container

**File:** [`playwright/e2e/Features/Container.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts)
**Tests:** 3

### Container entity specific tests 

| Test | Line |
|------|------|
| Container page should show Schema and Children count | [L52](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts#L52) |
| Container page children pagination | [L63](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts#L63) |
| expand / collapse should not appear after updating nested fields for container | [L124](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts#L124) |

## Dashboards

**File:** [`playwright/e2e/Features/Dashboards.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts)
**Tests:** 3

### Dashboards

| Test | Line |
|------|------|
| should change the page size | [L55](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts#L55) |

### Dashboard and Charts deleted toggle

| Test | Line |
|------|------|
| should be able to toggle between deleted and non-deleted charts | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts#L114) |

### Data Model

| Test | Line |
|------|------|
| expand / collapse should not appear after updating nested fields for dashboardDataModels | [L198](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts#L198) |

## QueryEntity

**File:** [`playwright/e2e/Features/QueryEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts)
**Tests:** 3

### Root Tests

| Test | Line |
|------|------|
| Query Entity | [L61](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts#L61) |
| Verify query duration | [L320](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts#L320) |
| Verify Query Pagination | [L338](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts#L338) |

## CustomMetric

**File:** [`playwright/e2e/Features/CustomMetric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts)
**Tests:** 2

### Root Tests

| Test | Line |
|------|------|
| Table custom metric | [L24](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts#L24) |
| Column custom metric | [L64](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts#L64) |

## ServiceEntityPermissions

**File:** [`playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts)
**Tests:** 2

### Allow permissions

| Test | Line |
|------|------|
| ${entityType} allow common operations permissions | [L110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts#L110) |

### Deny permissions

| Test | Line |
|------|------|
| ${entityType} deny common operations permissions | [L136](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts#L136) |

## SchemaTable

**File:** [`playwright/e2e/Flow/SchemaTable.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SchemaTable.spec.ts)
**Tests:** 2

### Root Tests

| Test | Line |
|------|------|
| schema table test | [L96](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SchemaTable.spec.ts#L96) |
| Schema Table Pagination should work Properly | [L150](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SchemaTable.spec.ts#L150) |

## EntityRightCollapsablePanel

**File:** [`playwright/e2e/Features/EntityRightCollapsablePanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntityRightCollapsablePanel.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Show and Hide Right Collapsable Panel | [L39](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntityRightCollapsablePanel.spec.ts#L39) |

## MetricCustomUnitFlow

**File:** [`playwright/e2e/Features/MetricCustomUnitFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts)
**Tests:** 1

### Metric Custom Unit of Measurement Flow

| Test | Line |
|------|------|
| Should create metric and test unit of measurement updates | [L30](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts#L30) |

## RestoreEntityInheritedFields

**File:** [`playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Validate restore with Inherited domain and data products assigned | [L75](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts#L75) |

## SchemaDefinition

**File:** [`playwright/e2e/Features/SchemaDefinition.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaDefinition.spec.ts)
**Tests:** 1

### Schema definition (views)

| Test | Line |
|------|------|
| Verify schema definition (views) of table entity | [L32](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaDefinition.spec.ts#L32) |

## TableConstraint

**File:** [`playwright/e2e/Features/TableConstraint.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts)
**Tests:** 1

### Table Constraints

| Test | Line |
|------|------|
| Table Constraint | [L58](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts#L58) |

## Topic

**File:** [`playwright/e2e/Features/Topic.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Topic.spec.ts)
**Tests:** 1

### Topic entity specific tests 

| Test | Line |
|------|------|
| Topic page should show schema tab with count | [L45](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Topic.spec.ts#L45) |

## ApiCollection

**File:** [`playwright/e2e/Flow/ApiCollection.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts)
**Tests:** 1

### API Collection Entity Special Test Cases

| Test | Line |
|------|------|
| Verify Owner Propagation: owner should be propagated to the API Collection | [L40](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts#L40) |

## ApiDocs

**File:** [`playwright/e2e/Flow/ApiDocs.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiDocs.spec.ts)
**Tests:** 1

### API docs should work properly

| Test | Line |
|------|------|
| API docs should work properly | [L24](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiDocs.spec.ts#L24) |

## ApiServiceRest

**File:** [`playwright/e2e/Flow/ApiServiceRest.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiServiceRest.spec.ts)
**Tests:** 1

### API service

| Test | Line |
|------|------|
| add update and delete api service type REST | [L40](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiServiceRest.spec.ts#L40) |

## EntityVersionPages

**File:** [`playwright/e2e/VersionPages/EntityVersionPages.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts)
**Tests:** 1

### Entity Version pages

| Test | Line |
|------|------|
| ${entity.getType()} | [L152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts#L152) |

## ServiceEntityVersionPage

**File:** [`playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts)
**Tests:** 1

### Service Version pages

| Test | Line |
|------|------|
| ${entity.getType()} | [L134](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts#L134) |

## TableVersionPage

**File:** [`playwright/e2e/VersionPages/TableVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TableVersionPage.spec.ts)
**Tests:** 1

### Table Version Page

| Test | Line |
|------|------|
| Pagination and Search should works for columns | [L21](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TableVersionPage.spec.ts#L21) |


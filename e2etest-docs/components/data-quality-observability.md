---
layout: default
title: Data Quality & Observability
parent: Components
nav_order: 306
---

# Data Quality & Observability
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
| **Test Cases** | 75 |
| **Test Steps** | 231 |
| **Total Scenarios** | 306 |

---

## DataContractsSemanticRules

📁 **File:** [`playwright/e2e/Pages/DataContractsSemanticRules.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 37 |
| Steps | 120 |
| Total | 157 |

### Data Contracts Semantics Rule Owner
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate Owner Rule Is | Validate Owner Rule Is | 3 | [L64](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L64) |
| | ↳ *Open contract section and start adding contract* | | | [L75](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L75) |
| | ↳ *Owner with is condition should passed with same team owner* | | | [L93](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L93) |
| | ↳ *Owner with is condition should failed with different owner* | | | [L135](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L135) |
| 2 | Validate Owner Rule Is_Not | Validate Owner Rule Is_Not | 3 | [L176](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L176) |
| | ↳ *Open contract section and start adding contract* | | | [L184](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L184) |
| | ↳ *Owner with is not condition should passed with different owner* | | | [L202](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L202) |
| | ↳ *Owner with is not condition should failed with same owner* | | | [L244](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L244) |
| 3 | Validate Owner Rule Any_In | Validate Owner Rule Any_In | 3 | [L292](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L292) |
| | ↳ *Open contract section and start adding contract* | | | [L300](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L300) |
| | ↳ *Should Failed since entity owner doesn* | | | [L318](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L318) |
| | ↳ *Should Passed since entity owner present in the list of any_in* | | | [L361](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L361) |
| 4 | Validate Owner Rule Not_In | Validate Owner Rule Not_In | 3 | [L408](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L408) |
| | ↳ *Open contract section and start adding contract* | | | [L416](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L416) |
| | ↳ *Should Passed since entity owner doesn* | | | [L434](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L434) |
| | ↳ *Should Failed since entity owner present in the list of not_in* | | | [L476](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L476) |
| 5 | Validate Owner Rule Is_Set | Validate Owner Rule Is_Set | 6 | [L524](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L524) |
| | ↳ *Open contract section and start adding contract* | | | [L532](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L532) |
| | ↳ *Should Failed since entity don* | | | [L542](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L542) |
| | ↳ *Should Passed since entity has owner* | | | [L576](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L576) |
| | ↳ *Open contract section and start adding contract* | | | [L621](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L621) |
| | ↳ *Should Passed since entity don* | | | [L631](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L631) |
| | ↳ *Should Failed since entity has owner* | | | [L664](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L664) |

### Data Contracts Semantics Rule Description
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate Description Rule Contains | Validate Description Rule Contains | 3 | [L704](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L704) |
| | ↳ *Open contract section and start adding contract* | | | [L712](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L712) |
| | ↳ *Description with contains condition should passed* | | | [L721](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L721) |
| | ↳ *Description with contains and wrong value should failed* | | | [L762](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L762) |
| 2 | Validate Description Rule Not Contains | Validate Description Rule Not Contains | 3 | [L809](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L809) |
| | ↳ *Open contract section and start adding contract* | | | [L817](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L817) |
| | ↳ *Description with not_contains condition should failed* | | | [L827](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L827) |
| | ↳ *Description with not_contains condition should passed* | | | [L868](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L868) |
| 3 | Validate Description Rule Is_Set | Validate Description Rule Is_Set | 3 | [L913](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L913) |
| | ↳ *Open contract section and start adding contract* | | | [L921](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L921) |
| | ↳ *Description with is_set condition should passed* | | | [L931](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L931) |
| | ↳ *Description with is_set condition should failed* | | | [L967](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L967) |
| 4 | Validate Description Rule Is_Not_Set | Validate Description Rule Is_Not_Set | 3 | [L1013](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1013) |
| | ↳ *Open contract section and start adding contract* | | | [L1021](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1021) |
| | ↳ *Description with is_not_set condition should failed* | | | [L1031](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1031) |
| | ↳ *Description with is_not_set condition should passed* | | | [L1068](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1068) |

### Data Contracts Semantics Rule Domain
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate Domain Rule Is | Validate Domain Rule Is | 3 | [L1126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1126) |
| | ↳ *Open contract section and start adding contract* | | | [L1134](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1134) |
| | ↳ *Domain with Is condition should passed* | | | [L1146](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1146) |
| | ↳ *Domain with Is condition should failed* | | | [L1185](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1185) |
| 2 | Validate Domain Rule Is Not | Validate Domain Rule Is Not | 3 | [L1218](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1218) |
| | ↳ *Open contract section and start adding contract* | | | [L1226](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1226) |
| | ↳ *Domain with IsNot condition should passed* | | | [L1237](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1237) |
| | ↳ *Domain with IsNot condition should failed* | | | [L1276](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1276) |
| 3 | Validate Domain Rule Any_In | Validate Domain Rule Any_In | 3 | [L1309](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1309) |
| | ↳ *Open contract section and start adding contract* | | | [L1317](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1317) |
| | ↳ *Domain with AnyIn condition should passed* | | | [L1329](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1329) |
| | ↳ *Domain with AnyIn condition should failed* | | | [L1368](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1368) |
| 4 | Validate Domain Rule Not_In | Validate Domain Rule Not_In | 3 | [L1401](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1401) |
| | ↳ *Open contract section and start adding contract* | | | [L1409](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1409) |
| | ↳ *Domain with NotIn condition should passed* | | | [L1419](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1419) |
| | ↳ *Domain with NotIn condition should failed* | | | [L1458](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1458) |
| 5 | Validate Domain Rule Is_Set | Validate Domain Rule Is_Set | 6 | [L1491](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1491) |
| | ↳ *Open contract section and start adding contract* | | | [L1499](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1499) |
| | ↳ *Domain with IsSet condition should passed* | | | [L1509](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1509) |
| | ↳ *Domain with IsSet condition should failed* | | | [L1542](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1542) |
| | ↳ *Open contract section and start adding contract* | | | [L1582](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1582) |
| | ↳ *Domain with IsNotSet condition should passed* | | | [L1591](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1591) |
| | ↳ *Domain with IsNotSet condition should failed* | | | [L1627](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1627) |

### Data Contracts Semantics Rule Version
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate Entity Version Is | Validate Entity Version Is | 3 | [L1664](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1664) |
| | ↳ *Open contract section and start adding contract* | | | [L1674](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1674) |
| | ↳ *Correct entity version should passed* | | | [L1683](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1683) |
| | ↳ *Non-Correct entity version should failed* | | | [L1720](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1720) |
| 2 | Validate Entity Version Is Not | Validate Entity Version Is Not | 3 | [L1752](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1752) |
| | ↳ *Open contract section and start adding contract* | | | [L1762](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1762) |
| | ↳ *Contract with is_not condition for version should passed* | | | [L1771](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1771) |
| | ↳ *Contract with is_not condition for version should failed* | | | [L1811](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1811) |
| 3 | Validate Entity Version Less than < | Validate Entity Version Less than < | 3 | [L1846](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1846) |
| | ↳ *Open contract section and start adding contract* | | | [L1856](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1856) |
| | ↳ *Contract with < condition for version should passed* | | | [L1865](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1865) |
| | ↳ *Contract with < condition for version should failed* | | | [L1905](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1905) |
| 4 | Validate Entity Version Greater than > | Validate Entity Version Greater than > | 3 | [L1940](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1940) |
| | ↳ *Open contract section and start adding contract* | | | [L1950](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1950) |
| | ↳ *Contract with > condition for version should failed* | | | [L1959](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1959) |
| | ↳ *Contract with > condition for version should passed* | | | [L2000](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2000) |
| 5 | Validate Entity Version Less than equal <= | Validate Entity Version Less than equal <= | 3 | [L2034](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2034) |
| | ↳ *Open contract section and start adding contract* | | | [L2047](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2047) |
| | ↳ *Contract with <= condition for version should passed* | | | [L2056](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2056) |
| | ↳ *Contract with <= condition for version should failed* | | | [L2096](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2096) |
| 6 | Validate Entity Version Greater than equal >= | Validate Entity Version Greater than equal >= | 3 | [L2131](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2131) |
| | ↳ *Open contract section and start adding contract* | | | [L2144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2144) |
| | ↳ *Contract with >= condition for version should passed* | | | [L2153](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2153) |
| | ↳ *Contract with >= condition for version should failed* | | | [L2193](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2193) |

### Data Contracts Semantics Rule DataProduct
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate DataProduct Rule Is | Validate DataProduct Rule Is | 3 | [L2247](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2247) |
| | ↳ *Open contract section and start adding contract* | | | [L2255](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2255) |
| | ↳ *DataProduct with Is condition should passed* | | | [L2268](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2268) |
| | ↳ *DataProduct with Is condition should failed* | | | [L2308](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2308) |
| 2 | Validate DataProduct Rule Is Not | Validate DataProduct Rule Is Not | 3 | [L2355](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2355) |
| | ↳ *Open contract section and start adding contract* | | | [L2363](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2363) |
| | ↳ *DataProduct with Is Not condition should passed* | | | [L2376](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2376) |
| | ↳ *DataProduct with Is Not condition should passed* | | | [L2419](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2419) |
| 3 | Validate DataProduct Rule Any_In | Validate DataProduct Rule Any_In | 3 | [L2469](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2469) |
| | ↳ *Open contract section and start adding contract* | | | [L2477](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2477) |
| | ↳ *DataProduct with Any In condition should failed* | | | [L2490](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2490) |
| | ↳ *DataProduct with Any In condition should passed* | | | [L2533](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2533) |
| 4 | Validate DataProduct Rule Not_In | Validate DataProduct Rule Not_In | 3 | [L2582](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2582) |
| | ↳ *Open contract section and start adding contract* | | | [L2590](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2590) |
| | ↳ *DataProduct with Not In condition should passed* | | | [L2603](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2603) |
| | ↳ *DataProduct with Any In condition should passed* | | | [L2645](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2645) |
| 5 | Validate DataProduct Rule Is_Set | Validate DataProduct Rule Is_Set | 6 | [L2695](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2695) |
| | ↳ *Open contract section and start adding contract* | | | [L2703](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2703) |
| | ↳ *DataProduct with IsSet condition should passed* | | | [L2716](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2716) |
| | ↳ *Domain with IsSet condition should failed* | | | [L2752](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2752) |
| | ↳ *Open contract section and start adding contract* | | | [L2806](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2806) |
| | ↳ *DataProduct with IsNotSet condition should passed* | | | [L2815](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2815) |
| | ↳ *DataProduct with IsNotSet condition should failed* | | | [L2851](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2851) |

### Data Contracts Semantics Rule DisplayName
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate DisplayName Rule Is | Validate DisplayName Rule Is | 3 | [L2905](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2905) |
| | ↳ *Open contract section and start adding contract* | | | [L2913](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2913) |
| | ↳ *DisplayName with Is condition should passed* | | | [L2922](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2922) |
| | ↳ *DisplayName with Is condition should failed* | | | [L2962](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2962) |
| 2 | Validate DisplayName Rule Is Not | Validate DisplayName Rule Is Not | 3 | [L3003](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3003) |
| | ↳ *Open contract section and start adding contract* | | | [L3011](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3011) |
| | ↳ *DisplayName with Is Not condition should failed* | | | [L3020](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3020) |
| | ↳ *DisplayName with Is Not condition should passed* | | | [L3064](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3064) |
| 3 | Validate DisplayName Rule Any_In | Validate DisplayName Rule Any_In | 3 | [L3107](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3107) |
| | ↳ *Open contract section and start adding contract* | | | [L3115](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3115) |
| | ↳ *DisplayName with Any In condition should passed* | | | [L3124](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3124) |
| | ↳ *DisplayName with Any In condition should failed* | | | [L3166](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3166) |
| 4 | Validate DisplayName Rule Not_In | Validate DisplayName Rule Not_In | 3 | [L3210](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3210) |
| | ↳ *Open contract section and start adding contract* | | | [L3218](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3218) |
| | ↳ *DisplayName with Not In condition should failed* | | | [L3227](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3227) |
| | ↳ *DisplayName with Not In condition should passed* | | | [L3270](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3270) |
| 5 | Validate DisplayName Rule Is_Set | Validate DisplayName Rule Is_Set | 3 | [L3313](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3313) |
| | ↳ *Open contract section and start adding contract* | | | [L3321](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3321) |
| | ↳ *DisplayName with IsSet condition should passed* | | | [L3330](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3330) |
| | ↳ *DisplayName with IsSet condition should failed* | | | [L3366](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3366) |
| 6 | Validate DisplayName Rule Is_Not_Set | Validate DisplayName Rule Is_Not_Set | 3 | [L3411](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3411) |
| | ↳ *Open contract section and start adding contract* | | | [L3419](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3419) |
| | ↳ *DisplayName with IsNotSet condition should failed* | | | [L3428](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3428) |
| | ↳ *DisplayName with IsNotSet condition should passed* | | | [L3465](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3465) |

### Data Contracts Semantics Rule Updated on
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate UpdatedOn Rule Between | Validate UpdatedOn Rule Between | 3 | [L3511](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3511) |
| | ↳ *Open contract section and start adding contract* | | | [L3519](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3519) |
| | ↳ *UpdatedOn with Between condition should passed* | | | [L3528](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3528) |
| | ↳ *UpdatedOn with Between condition should failed* | | | [L3575](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3575) |
| 2 | Validate UpdatedOn Rule Not_Between | Validate UpdatedOn Rule Not_Between | 3 | [L3610](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3610) |
| | ↳ *Open contract section and start adding contract* | | | [L3618](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3618) |
| | ↳ *UpdatedOn with Between condition should failed* | | | [L3627](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3627) |
| | ↳ *UpdatedOn with Between condition should passed* | | | [L3675](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3675) |
| 3 | Validate UpdatedOn Rule Less than | Validate UpdatedOn Rule Less than | 3 | [L3721](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3721) |
| | ↳ *Open contract section and start adding contract* | | | [L3729](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3729) |
| | ↳ *UpdatedOn with Less than condition should failed* | | | [L3738](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3738) |
| | ↳ *UpdatedOn with Less than condition should passed* | | | [L3784](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3784) |
| 4 | Validate UpdatedOn Rule Greater than | Validate UpdatedOn Rule Greater than | 3 | [L3826](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3826) |
| | ↳ *Open contract section and start adding contract* | | | [L3834](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3834) |
| | ↳ *UpdatedOn with Greater than condition should failed* | | | [L3843](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3843) |
| | ↳ *UpdatedOn with Greater than condition should passed* | | | [L3892](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3892) |
| 5 | Validate UpdatedOn Rule Less than Equal | Validate UpdatedOn Rule Less than Equal | 3 | [L3934](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3934) |
| | ↳ *Open contract section and start adding contract* | | | [L3942](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3942) |
| | ↳ *UpdatedOn with LessThanEqual condition should passed* | | | [L3951](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3951) |
| | ↳ *UpdatedOn with Less than condition should failed* | | | [L3999](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3999) |
| 6 | Validate UpdatedOn Rule Greater Than Equal | Validate UpdatedOn Rule Greater Than Equal | 3 | [L4042](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L4042) |
| | ↳ *Open contract section and start adding contract* | | | [L4053](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L4053) |
| | ↳ *UpdatedOn with GreaterThanEqual condition should passed* | | | [L4062](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L4062) |
| | ↳ *UpdatedOn with GreaterThanEqual condition should failed* | | | [L4110](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L4110) |

---

## DataContracts

📁 **File:** [`playwright/e2e/Pages/DataContracts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 11 |
| Steps | 28 |
| Total | 39 |

### Data Contracts
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Create Data Contract and validate for ${entityType} | Create Data Contract and validate for ${entityType} | 15 | [L133](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L133) |
| | ↳ *Redirect to Home Page and visit entity* | | | [L154](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L154) |
| | ↳ *Open contract section and start adding contract* | | | [L159](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L159) |
| | ↳ *Fill Contract Details form* | | | [L176](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L176) |
| | ↳ *Fill the Terms of Service Detail* | | | [L189](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L189) |
| | ↳ *Fill Contract Schema form* | | | [L199](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L199) |
| | ↳ *Fill first Contract Semantics form* | | | [L220](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L220) |
| | ↳ *Add second semantic and delete it* | | | [L285](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L285) |
| | ↳ *Save contract and validate for semantics* | | | [L324](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L324) |
| | ↳ *Add table test case and validate for quality* | | | [L378](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L378) |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | | | [L523](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L523) |
| | ↳ *Edit quality expectations from the data contract and validate* | | | [L539](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L539) |
| | ↳ *Verify YAML view* | | | [L588](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L588) |
| | ↳ *Export YAML* | | | [L603](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L603) |
| | ↳ *Edit and Validate Contract data* | | | [L618](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L618) |
| | ↳ *Delete contract* | | | [L704](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L704) |
| 2 | Pagination in Schema Tab with Selection Persistent | Pagination in Schema Tab with Selection Persistent | 8 | [L739](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L739) |
| | ↳ *Redirect to Home Page and visit entity* | | | [L747](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L747) |
| | ↳ *Open contract section and start adding contract* | | | [L757](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L757) |
| | ↳ *Fill Contract Details form* | | | [L774](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L774) |
| | ↳ *Fill Contract Schema form* | | | [L780](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L780) |
| | ↳ *Save contract and validate for schema* | | | [L856](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L856) |
| | ↳ *Update the Schema and Validate* | | | [L885](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L885) |
| | ↳ *Re-select some columns on page 1, save and validate* | | | [L938](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L938) |
| | ↳ *Delete contract* | | | [L1000](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1000) |
| 3 | Semantic with Contains Operator should work for Tier, Tag and Glossary | Semantic with Contains Operator should work for Tier, Tag and Glossary | - | [L1045](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1045) |
| 4 | Semantic with Not_Contains Operator should work for Tier, Tag and Glossary | Semantic with Not_Contains Operator should work for Tier, Tag and Glossary | - | [L1232](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1232) |
| 5 | Nested Column should not be selectable | Nested Column should not be selectable | - | [L1423](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1423) |
| 6 | Operation on Old Schema Columns Contract | Operation on Old Schema Columns Contract | - | [L1495](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1495) |
| 7 | should allow adding a semantic with multiple rules | Allow adding a semantic with multiple rules | - | [L1633](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1633) |
| 8 | should allow adding a second semantic and verify its rule | Allow adding a second semantic and verify its rule | - | [L1714](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1714) |
| 9 | should allow editing a semantic and reflect changes | Allow editing a semantic and reflect changes | - | [L1807](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1807) |
| 10 | should allow deleting a semantic and remove it from the list | Allow deleting a semantic and remove it from the list | - | [L1865](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1865) |
| 11 | Add and update Security and SLA tabs | Add and update Security and SLA tabs | 5 | [L1936](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1936) |
| | ↳ *Add Security and SLA Details* | | | [L1943](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1943) |
| | ↳ *Validate Security and SLA Details* | | | [L1968](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1968) |
| | ↳ *Update Security and SLA Details* | | | [L2036](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L2036) |
| | ↳ *Validate the updated values Security and SLA Details* | | | [L2046](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L2046) |
| | ↳ *Validate after removing security policies* | | | [L2126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L2126) |

---

## DataQualityAndProfiler

📁 **File:** [`playwright/e2e/Pages/DataQualityAndProfiler.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 4 |
| Steps | 18 |
| Total | 22 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Table test case | Table test case | 4 | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L125) |
| 2 | Column test case | Column test case | 9 | [L292](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L292) |
| 3 | TestCase filters | TestCase filters | - | [L901](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L901) |
| 4 | Pagination functionality in test cases list | Pagination functionality in test cases list | 5 | [L1317](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L1317) |

---

## IncidentManager

📁 **File:** [`playwright/e2e/Features/IncidentManager.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 5 |
| Steps | 16 |
| Total | 21 |

### Incident Manager
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Complete Incident lifecycle with table owner | Complete Incident lifecycle with table owner | 7 | [L108](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L108) |
| | ↳ *Claim ownership of table* | | | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L119) |
| | ↳ *Acknowledge table test case* | | | [L144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L144) |
| | ↳ *Assign incident to user* | | | [L152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L152) |
| | ↳ *Re-assign incident to user* | | | [L161](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L161) |
| | ↳ *Verify that notifications correctly display mentions for the incident manager* | | | [L216](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L216) |
| | ↳ *Re-assign incident from test case page* | | | [L237](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L237) |
| | ↳ *Resolve incident* | | | [L257](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L257) |
| 2 | Resolving incident & re-run pipeline | Resolving incident & re-run pipeline | 5 | [L273](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L273) |
| | ↳ *Acknowledge table test case* | | | [L279](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L279) |
| | ↳ *Resolve task from incident list page* | | | [L287](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L287) |
| | ↳ *Task should be closed* | | | [L327](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L327) |
| | ↳ *Re-run pipeline* | | | [L351](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L351) |
| | ↳ *Verify open and closed task* | | | [L359](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L359) |
| 3 | Rerunning pipeline for an open incident | Rerunning pipeline for an open incident | 4 | [L378](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L378) |
| | ↳ *Ack incident and verify open task* | | | [L388](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L388) |
| | ↳ *Assign incident to user* | | | [L404](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L404) |
| | ↳ *Re-run pipeline* | | | [L412](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L412) |
| | ↳ *Verify incident* | | | [L420](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L420) |
| 4 | Validate Incident Tab in Entity details page | Validate Incident Tab in Entity details page | - | [L437](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L437) |
| 5 | Verify filters in Incident Manager | Filters in Incident Manager | - | [L485](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L485) |

---

## ObservabilityAlerts

📁 **File:** [`playwright/e2e/Flow/ObservabilityAlerts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 12 |
| Total | 15 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Pipeline Alert | Pipeline Alert | 5 | [L145](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts#L145) |
| 2 | ${sourceDisplayName} alert | ${sourceDisplayName} alert | 3 | [L231](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts#L231) |
| 3 | Alert operations for a user with and without permissions | Alert operations for a user with and without permissions | 4 | [L265](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts#L265) |

---

## TestCases

📁 **File:** [`playwright/e2e/Pages/TestCases.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestCases.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 9 |
| Total | 12 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Table difference test case | Table difference test case | 3 | [L26](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestCases.spec.ts#L26) |
| 2 | Custom SQL Query | Custom SQL Query | 3 | [L264](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestCases.spec.ts#L264) |
| 3 | Column Values To Be Not Null | Column Values To Be Not Null | 3 | [L404](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestCases.spec.ts#L404) |

---

## TestSuite

📁 **File:** [`playwright/e2e/Pages/TestSuite.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 8 |
| Total | 9 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Logical TestSuite | Logical TestSuite | 8 | [L52](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L52) |

---

## AddTestCaseNewFlow

📁 **File:** [`playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 4 |
| Steps | 4 |
| Total | 8 |

### Add TestCase New Flow
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add Table Test Case | Add Table Test Case | 2 | [L196](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts#L196) |
| | ↳ *Create table-level test case* | | | [L203](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts#L203) |
| | ↳ *Validate test case in Entity Page* | | | [L221](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts#L221) |
| 2 | Add Column Test Case | Add Column Test Case | 2 | [L244](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts#L244) |
| | ↳ *Create column-level test case* | | | [L251](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts#L251) |
| | ↳ *Validate test case in Entity Page* | | | [L273](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts#L273) |
| 3 | Add multiple test case from table details page and validate pipeline | Add multiple test case from table details page and validate pipeline | - | [L296](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts#L296) |
| 4 | Non-owner user should not able to add test case | Non-owner user should not able to add test case | - | [L390](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts#L390) |

---

## CustomMetric

📁 **File:** [`playwright/e2e/Features/CustomMetric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 4 |
| Total | 6 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Table custom metric | Table custom metric | 2 | [L24](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts#L24) |
| 2 | Column custom metric | Column custom metric | 2 | [L64](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts#L64) |

---

## ProfilerConfigurationPage

📁 **File:** [`playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 3 |
| Total | 5 |

### Profiler Configuration Page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Admin user | Admin user | 3 | [L56](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L56) |
| | ↳ *Verify validation* | | | [L65](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L65) |
| | ↳ *Update profiler configuration* | | | [L77](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L77) |
| | ↳ *Remove Configuration* | | | [L141](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L141) |
| 2 | Non admin user | Non admin user | - | [L158](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ProfilerConfigurationPage.spec.ts#L158) |

---

## TableConstraint

📁 **File:** [`playwright/e2e/Features/TableConstraint.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 3 |
| Total | 4 |

### Table Constraints
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Table Constraint | Table Constraint | 3 | [L58](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts#L58) |
| | ↳ *Add Constraints* | | | [L61](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts#L61) |
| | ↳ *Verify Constraints Data* | | | [L288](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts#L288) |
| | ↳ *Remove Constraints* | | | [L327](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts#L327) |

---

## TestCaseVersionPage

📁 **File:** [`playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 3 |
| Total | 4 |

### TestCase Version Page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should show the test case version page | Show the test case version page | 3 | [L44](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts#L44) |
| | ↳ *Display name change* | | | [L56](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts#L56) |
| | ↳ *Description change* | | | [L91](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts#L91) |
| | ↳ *Parameter change* | | | [L121](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts#L121) |

---

## TestSuiteMultiPipeline

📁 **File:** [`playwright/e2e/Features/TestSuiteMultiPipeline.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TestSuiteMultiPipeline.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 0 |
| Steps | 3 |
| Total | 3 |

---

## TestSuitePipelineRedeploy

📁 **File:** [`playwright/e2e/Features/TestSuitePipelineRedeploy.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TestSuitePipelineRedeploy.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Bulk Re-Deploy pipelines 
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Re-deploy all test-suite ingestion pipelines | Re-deploy all test-suite ingestion pipelines | - | [L53](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TestSuitePipelineRedeploy.spec.ts#L53) |

---


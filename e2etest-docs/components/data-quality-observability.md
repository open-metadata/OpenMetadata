---
layout: default
title: Data Quality & Observability
parent: Components
nav_order: 191
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
| **Test Steps** | 116 |
| **Total Scenarios** | 191 |

---

## DataContractsSemanticRules

📁 **File:** [`playwright/e2e/Pages/DataContractsSemanticRules.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 37 |
| Steps | 21 |
| Total | 58 |

### Data Contracts Semantics Rule Owner
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate Owner Rule Is | Validate Owner Rule Is | - | [L64](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L64) |
| 2 | Validate Owner Rule Is_Not | Validate Owner Rule Is_Not | - | [L176](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L176) |
| 3 | Validate Owner Rule Any_In | Validate Owner Rule Any_In | - | [L292](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L292) |
| 4 | Validate Owner Rule Not_In | Validate Owner Rule Not_In | - | [L408](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L408) |
| 5 | Validate Owner Rule Is_Set | Validate Owner Rule Is_Set | 4 | [L524](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L524) |
| | ↳ *Should Failed since entity don* | | | [L542](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L542) |
| | ↳ *Should Passed since entity has owner* | | | [L576](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L576) |
| | ↳ *Should Passed since entity don* | | | [L631](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L631) |
| | ↳ *Should Failed since entity has owner* | | | [L664](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L664) |

### Data Contracts Semantics Rule Description
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate Description Rule Contains | Validate Description Rule Contains | - | [L704](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L704) |
| 2 | Validate Description Rule Not Contains | Validate Description Rule Not Contains | - | [L809](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L809) |
| 3 | Validate Description Rule Is_Set | Validate Description Rule Is_Set | - | [L913](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L913) |
| 4 | Validate Description Rule Is_Not_Set | Validate Description Rule Is_Not_Set | - | [L1013](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1013) |

### Data Contracts Semantics Rule Domain
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate Domain Rule Is | Validate Domain Rule Is | 2 | [L1126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1126) |
| | ↳ *Domain with Is condition should passed* | | | [L1146](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1146) |
| | ↳ *Domain with Is condition should failed* | | | [L1185](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1185) |
| 2 | Validate Domain Rule Is Not | Validate Domain Rule Is Not | 2 | [L1218](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1218) |
| | ↳ *Domain with IsNot condition should passed* | | | [L1237](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1237) |
| | ↳ *Domain with IsNot condition should failed* | | | [L1276](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1276) |
| 3 | Validate Domain Rule Any_In | Validate Domain Rule Any_In | 2 | [L1309](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1309) |
| | ↳ *Domain with AnyIn condition should passed* | | | [L1329](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1329) |
| | ↳ *Domain with AnyIn condition should failed* | | | [L1368](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1368) |
| 4 | Validate Domain Rule Not_In | Validate Domain Rule Not_In | 2 | [L1401](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1401) |
| | ↳ *Domain with NotIn condition should passed* | | | [L1419](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1419) |
| | ↳ *Domain with NotIn condition should failed* | | | [L1458](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1458) |
| 5 | Validate Domain Rule Is_Set | Validate Domain Rule Is_Set | 2 | [L1491](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1491) |
| | ↳ *Domain with IsSet condition should passed* | | | [L1509](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1509) |
| | ↳ *Domain with IsSet condition should failed* | | | [L1542](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1542) |

### Data Contracts Semantics Rule Version
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate Entity Version Is | Validate Entity Version Is | 2 | [L1664](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1664) |
| | ↳ *Correct entity version should passed* | | | [L1683](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1683) |
| | ↳ *Non-Correct entity version should failed* | | | [L1720](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1720) |
| 2 | Validate Entity Version Is Not | Validate Entity Version Is Not | - | [L1752](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1752) |
| 3 | Validate Entity Version Less than < | Validate Entity Version Less than < | - | [L1846](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1846) |
| 4 | Validate Entity Version Greater than > | Validate Entity Version Greater than > | - | [L1940](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L1940) |
| 5 | Validate Entity Version Less than equal <= | Validate Entity Version Less than equal <= | - | [L2034](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2034) |
| 6 | Validate Entity Version Greater than equal >= | Validate Entity Version Greater than equal >= | - | [L2131](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2131) |

### Data Contracts Semantics Rule DataProduct
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate DataProduct Rule Is | Validate DataProduct Rule Is | 2 | [L2247](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2247) |
| | ↳ *DataProduct with Is condition should passed* | | | [L2268](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2268) |
| | ↳ *DataProduct with Is condition should failed* | | | [L2308](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2308) |
| 2 | Validate DataProduct Rule Is Not | Validate DataProduct Rule Is Not | - | [L2355](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2355) |
| 3 | Validate DataProduct Rule Any_In | Validate DataProduct Rule Any_In | - | [L2469](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2469) |
| 4 | Validate DataProduct Rule Not_In | Validate DataProduct Rule Not_In | - | [L2582](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2582) |
| 5 | Validate DataProduct Rule Is_Set | Validate DataProduct Rule Is_Set | 1 | [L2695](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2695) |
| | ↳ *Domain with IsSet condition should failed* | | | [L2752](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2752) |

### Data Contracts Semantics Rule DisplayName
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate DisplayName Rule Is | Validate DisplayName Rule Is | 2 | [L2905](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2905) |
| | ↳ *DisplayName with Is condition should passed* | | | [L2922](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2922) |
| | ↳ *DisplayName with Is condition should failed* | | | [L2962](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L2962) |
| 2 | Validate DisplayName Rule Is Not | Validate DisplayName Rule Is Not | - | [L3003](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3003) |
| 3 | Validate DisplayName Rule Any_In | Validate DisplayName Rule Any_In | - | [L3107](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3107) |
| 4 | Validate DisplayName Rule Not_In | Validate DisplayName Rule Not_In | - | [L3210](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3210) |
| 5 | Validate DisplayName Rule Is_Set | Validate DisplayName Rule Is_Set | - | [L3313](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3313) |
| 6 | Validate DisplayName Rule Is_Not_Set | Validate DisplayName Rule Is_Not_Set | - | [L3411](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3411) |

### Data Contracts Semantics Rule Updated on
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate UpdatedOn Rule Between | Validate UpdatedOn Rule Between | - | [L3511](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3511) |
| 2 | Validate UpdatedOn Rule Not_Between | Validate UpdatedOn Rule Not_Between | - | [L3610](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3610) |
| 3 | Validate UpdatedOn Rule Less than | Validate UpdatedOn Rule Less than | - | [L3721](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3721) |
| 4 | Validate UpdatedOn Rule Greater than | Validate UpdatedOn Rule Greater than | - | [L3826](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3826) |
| 5 | Validate UpdatedOn Rule Less than Equal | Validate UpdatedOn Rule Less than Equal | - | [L3934](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L3934) |
| 6 | Validate UpdatedOn Rule Greater Than Equal | Validate UpdatedOn Rule Greater Than Equal | - | [L4042](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts#L4042) |

---

## DataContracts

📁 **File:** [`playwright/e2e/Pages/DataContracts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 11 |
| Steps | 21 |
| Total | 32 |

### Data Contracts
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Create Data Contract and validate for ${entityType} | Create Data Contract and validate for ${entityType} | 11 | [L133](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L133) |
| | ↳ *Redirect to Home Page and visit entity* | | | [L154](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L154) |
| | ↳ *Fill Contract Details form* | | | [L176](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L176) |
| | ↳ *Fill the Terms of Service Detail* | | | [L189](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L189) |
| | ↳ *Fill Contract Schema form* | | | [L199](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L199) |
| | ↳ *Fill first Contract Semantics form* | | | [L220](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L220) |
| | ↳ *Add second semantic and delete it* | | | [L285](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L285) |
| | ↳ *Save contract and validate for semantics* | | | [L324](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L324) |
| | ↳ *Verify YAML view* | | | [L588](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L588) |
| | ↳ *Export YAML* | | | [L603](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L603) |
| | ↳ *Edit and Validate Contract data* | | | [L618](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L618) |
| | ↳ *Delete contract* | | | [L704](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L704) |
| 2 | Pagination in Schema Tab with Selection Persistent | Pagination in Schema Tab with Selection Persistent | 6 | [L739](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L739) |
| | ↳ *Redirect to Home Page and visit entity* | | | [L747](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L747) |
| | ↳ *Fill Contract Details form* | | | [L774](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L774) |
| | ↳ *Fill Contract Schema form* | | | [L780](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L780) |
| | ↳ *Save contract and validate for schema* | | | [L856](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L856) |
| | ↳ *Update the Schema and Validate* | | | [L885](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L885) |
| | ↳ *Delete contract* | | | [L1000](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1000) |
| 3 | Semantic with Contains Operator should work for Tier, Tag and Glossary | Semantic with Contains Operator should work for Tier, Tag and Glossary | - | [L1045](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1045) |
| 4 | Semantic with Not_Contains Operator should work for Tier, Tag and Glossary | Semantic with Not_Contains Operator should work for Tier, Tag and Glossary | - | [L1232](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1232) |
| 5 | Nested Column should not be selectable | Nested Column should not be selectable | - | [L1423](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1423) |
| 6 | Operation on Old Schema Columns Contract | Operation on Old Schema Columns Contract | - | [L1495](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1495) |
| 7 | should allow adding a semantic with multiple rules | Allow adding a semantic with multiple rules | - | [L1633](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1633) |
| 8 | should allow adding a second semantic and verify its rule | Allow adding a second semantic and verify its rule | - | [L1714](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1714) |
| 9 | should allow editing a semantic and reflect changes | Allow editing a semantic and reflect changes | - | [L1807](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1807) |
| 10 | should allow deleting a semantic and remove it from the list | Allow deleting a semantic and remove it from the list | - | [L1865](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1865) |
| 11 | Add and update Security and SLA tabs | Add and update Security and SLA tabs | 4 | [L1936](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1936) |
| | ↳ *Add Security and SLA Details* | | | [L1943](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1943) |
| | ↳ *Validate Security and SLA Details* | | | [L1968](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L1968) |
| | ↳ *Update Security and SLA Details* | | | [L2036](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L2036) |
| | ↳ *Validate after removing security policies* | | | [L2126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts#L2126) |

---

## IncidentManager

📁 **File:** [`playwright/e2e/Features/IncidentManager.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 5 |
| Steps | 14 |
| Total | 19 |

### Incident Manager
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Complete Incident lifecycle with table owner | Complete Incident lifecycle with table owner | 5 | [L108](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L108) |
| | ↳ *Claim ownership of table* | | | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L119) |
| | ↳ *Acknowledge table test case* | | | [L144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L144) |
| | ↳ *Assign incident to user* | | | [L152](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L152) |
| | ↳ *Re-assign incident to user* | | | [L161](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/IncidentManager.spec.ts#L161) |
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

## DataQualityAndProfiler

📁 **File:** [`playwright/e2e/Pages/DataQualityAndProfiler.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 4 |
| Steps | 14 |
| Total | 18 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Table test case | Table test case | 3 | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L125) |
| 2 | Column test case | Column test case | 6 | [L292](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L292) |
| 3 | TestCase filters | TestCase filters | - | [L901](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L901) |
| 4 | Pagination functionality in test cases list | Pagination functionality in test cases list | 5 | [L1317](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataQualityAndProfiler.spec.ts#L1317) |

---

## ObservabilityAlerts

📁 **File:** [`playwright/e2e/Flow/ObservabilityAlerts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 11 |
| Total | 14 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Pipeline Alert | Pipeline Alert | 5 | [L145](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts#L145) |
| 2 | ${sourceDisplayName} alert | ${sourceDisplayName} alert | 3 | [L231](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts#L231) |
| 3 | Alert operations for a user with and without permissions | Alert operations for a user with and without permissions | 3 | [L265](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ObservabilityAlerts.spec.ts#L265) |

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

## TestSuite

📁 **File:** [`playwright/e2e/Pages/TestSuite.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 6 |
| Total | 7 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Logical TestSuite | Logical TestSuite | 6 | [L52](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/TestSuite.spec.ts#L52) |

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


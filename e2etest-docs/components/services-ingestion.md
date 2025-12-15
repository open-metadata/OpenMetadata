---
layout: default
title: Services & Ingestion
parent: Components
nav_order: 13
---

# Services & Ingestion
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 4 |
| **Test Cases** | 13 |
| **Test Steps** | 0 |
| **Total Scenarios** | 13 |

---

## ServiceIngestion

📁 **File:** [`playwright/e2e/nightly/ServiceIngestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 7 |
| Steps | 0 |
| Total | 7 |

### Service form
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | name field should throw error for invalid name | Name field should throw error for invalid name | - | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L119) |

### Service Ingestion Pagination
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Default Pagination size should be 15 | Default Pagination size should be 15 | - | [L168](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L168) |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Create & Ingest ${service.serviceType} service | Create & Ingest ${service.serviceType} service | - | [L85](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L85) |
| 2 | Update description and verify description after re-run | Update description and verify description after re-run | - | [L91](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L91) |
| 3 | Update schedule options and verify | Update schedule options and verify | - | [L97](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L97) |
| 4 | Service specific tests | Service specific tests | - | [L106](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L106) |
| 5 | Delete ${service.serviceType} service | Delete ${service.serviceType} service | - | [L111](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L111) |

---

## ServiceForm

📁 **File:** [`playwright/e2e/Flow/ServiceForm.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 0 |
| Total | 3 |

### Superset
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify form selects are working properly | Form selects are working properly | - | [L64](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts#L64) |

### Database service
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify service name field validation errors | Service name field validation errors | - | [L229](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts#L229) |

### Looker
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify if string input inside oneOf config works properly | If string input inside oneOf config works properly | - | [L295](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts#L295) |

---

## AutoPilot

📁 **File:** [`playwright/e2e/Features/AutoPilot.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AutoPilot.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 0 |
| Total | 2 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Create Service and check the AutoPilot status | Create Service and check the AutoPilot status | - | [L95](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AutoPilot.spec.ts#L95) |
| 2 | Agents created by AutoPilot should be deleted | Agents created by AutoPilot should be deleted | - | [L187](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AutoPilot.spec.ts#L187) |

---

## ServiceListing

📁 **File:** [`playwright/e2e/Pages/ServiceListing.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceListing.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Service Listing
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should render the service listing page | Render the service listing page | - | [L49](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceListing.spec.ts#L49) |

---


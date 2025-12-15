---
layout: default
title: Services & Ingestion
parent: Components
nav_order: 11
---

# Services & Ingestion

| Metric | Count |
|--------|-------|
| **Total Tests** | 11 |
| **Test Files** | 3 |

---

## ServiceIngestion

**File:** [`playwright/e2e/nightly/ServiceIngestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts)
**Tests:** 7

### Root Tests

| Test | Line |
|------|------|
| Create & Ingest ${service.serviceType} service | [L85](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L85) |
| Update description and verify description after re-run | [L91](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L91) |
| Update schedule options and verify | [L97](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L97) |
| Service specific tests | [L106](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L106) |
| Delete ${service.serviceType} service | [L111](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L111) |

### Service form

| Test | Line |
|------|------|
| name field should throw error for invalid name | [L119](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L119) |

### Service Ingestion Pagination

| Test | Line |
|------|------|
| Default Pagination size should be 15 | [L168](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts#L168) |

## ServiceForm

**File:** [`playwright/e2e/Flow/ServiceForm.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts)
**Tests:** 3

### Superset

| Test | Line |
|------|------|
| Verify form selects are working properly | [L64](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts#L64) |

### Database service

| Test | Line |
|------|------|
| Verify service name field validation errors | [L229](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts#L229) |

### Looker

| Test | Line |
|------|------|
| Verify if string input inside oneOf config works properly | [L295](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts#L295) |

## ServiceListing

**File:** [`playwright/e2e/Pages/ServiceListing.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceListing.spec.ts)
**Tests:** 1

### Service Listing

| Test | Line |
|------|------|
| should render the service listing page | [L49](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceListing.spec.ts#L49) |


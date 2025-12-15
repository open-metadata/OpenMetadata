---
layout: default
title: Lineage
parent: Components
nav_order: 23
---

# Lineage

| Metric | Count |
|--------|-------|
| **Total Tests** | 23 |
| **Test Files** | 4 |

---

## Lineage

**File:** [`playwright/e2e/Pages/Lineage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts)
**Tests:** 12

### Root Tests

| Test | Line |
|------|------|
| Lineage creation from ${defaultEntity.getType()} entity | [L88](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L88) |
| Verify column lineage between tables | [L208](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L208) |
| Verify column lineage between table and topic | [L245](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L245) |
| Verify column lineage between topic and api endpoint | [L315](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L315) |
| Verify column lineage between table and api endpoint | [L352](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L352) |
| Verify function data in edge drawer | [L387](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L387) |
| Verify table search with special characters as handled | [L468](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L468) |
| Verify cycle lineage should be handled properly | [L544](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L544) |
| Verify column visibility across pagination pages | [L875](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L875) |
| Verify edges when no column is hovered or selected | [L1017](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1017) |
| Verify columns and edges when a column is hovered | [L1204](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1204) |
| Verify columns and edges when a column is clicked | [L1265](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1265) |

## ImpactAnalysis

**File:** [`playwright/e2e/Features/ImpactAnalysis.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts)
**Tests:** 8

### Impact Analysis

| Test | Line |
|------|------|
| validate upstream/ downstream counts | [L195](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L195) |
| Verify Downstream connections | [L200](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L200) |
| Verify Upstream connections | [L235](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L235) |
| verify owner filter for Asset level impact analysis | [L258](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L258) |
| verify tier for Asset level impact analysis | [L306](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L306) |
| Verify upstream/downstream counts for column level | [L329](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L329) |
| Verify column level downstream connections | [L363](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L363) |
| Verify column level upstream connections | [L428](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L428) |

## LineageSettings

**File:** [`playwright/e2e/Flow/LineageSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts)
**Tests:** 2

### Lineage Settings Tests

| Test | Line |
|------|------|
| Verify global lineage config | [L89](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L89) |
| Verify lineage settings for PipelineViewMode as Edge | [L241](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L241) |

## PlatformLineage

**File:** [`playwright/e2e/Flow/PlatformLineage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Verify Platform Lineage View | [L19](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts#L19) |


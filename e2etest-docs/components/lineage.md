---
layout: default
title: Lineage
parent: Components
nav_order: 48
---

# Lineage
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
| **Test Cases** | 23 |
| **Test Steps** | 25 |
| **Total Scenarios** | 48 |

---

## Lineage

📁 **File:** [`playwright/e2e/Pages/Lineage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 12 |
| Steps | 20 |
| Total | 32 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Lineage creation from ${defaultEntity.getType()} entity | Lineage creation from ${defaultEntity.getType()} entity | 6 | [L88](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L88) |
| 2 | Verify column lineage between tables | Column lineage between tables | - | [L208](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L208) |
| 3 | Verify column lineage between table and topic | Column lineage between table and topic | - | [L245](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L245) |
| 4 | Verify column lineage between topic and api endpoint | Column lineage between topic and api endpoint | - | [L315](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L315) |
| 5 | Verify column lineage between table and api endpoint | Column lineage between table and api endpoint | - | [L352](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L352) |
| 6 | Verify function data in edge drawer | Function data in edge drawer | - | [L387](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L387) |
| 7 | Verify table search with special characters as handled | Table search with special characters as handled | - | [L468](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L468) |
| 8 | Verify cycle lineage should be handled properly | Cycle lineage should be handled properly | 3 | [L544](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L544) |
| 9 | Verify column visibility across pagination pages | Column visibility across pagination pages | 6 | [L875](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L875) |
| 10 | Verify edges when no column is hovered or selected | Edges when no column is hovered or selected | 3 | [L1017](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1017) |
| 11 | Verify columns and edges when a column is hovered | Columns and edges when a column is hovered | 1 | [L1204](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1204) |
| 12 | Verify columns and edges when a column is clicked | Columns and edges when a column is clicked | 1 | [L1265](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1265) |

---

## ImpactAnalysis

📁 **File:** [`playwright/e2e/Features/ImpactAnalysis.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 8 |
| Steps | 0 |
| Total | 8 |

### Impact Analysis
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | validate upstream/ downstream counts | Validate upstream/ downstream counts | - | [L195](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L195) |
| 2 | Verify Downstream connections | Downstream connections | - | [L200](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L200) |
| 3 | Verify Upstream connections | Upstream connections | - | [L235](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L235) |
| 4 | verify owner filter for Asset level impact analysis | Owner filter for Asset level impact analysis | - | [L258](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L258) |
| 5 | verify tier for Asset level impact analysis | Tier for Asset level impact analysis | - | [L306](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L306) |
| 6 | Verify upstream/downstream counts for column level | Upstream/downstream counts for column level | - | [L329](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L329) |
| 7 | Verify column level downstream connections | Column level downstream connections | - | [L363](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L363) |
| 8 | Verify column level upstream connections | Column level upstream connections | - | [L428](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts#L428) |

---

## LineageSettings

📁 **File:** [`playwright/e2e/Flow/LineageSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 5 |
| Total | 7 |

### Lineage Settings Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify global lineage config | Global lineage config | 5 | [L89](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L89) |
| | ↳ *Lineage config should throw error if upstream depth is less than 0* | | | [L100](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L100) |
| | ↳ *Update global lineage config and verify lineage for column layer* | | | [L127](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L127) |
| | ↳ *Update global lineage config and verify lineage for entity layer* | | | [L155](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L155) |
| | ↳ *Verify Upstream and Downstream expand collapse buttons* | | | [L191](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L191) |
| | ↳ *Reset global lineage config and verify lineage* | | | [L219](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L219) |
| 2 | Verify lineage settings for PipelineViewMode as Edge | Lineage settings for PipelineViewMode as Edge | - | [L241](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts#L241) |

---

## PlatformLineage

📁 **File:** [`playwright/e2e/Flow/PlatformLineage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify Platform Lineage View | Platform Lineage View | - | [L19](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts#L19) |

---


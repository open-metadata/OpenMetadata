---
title: Lineage
---

# Lineage

## Table of contents
[[toc]]

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 3 |
| **Test Cases** | 15 |
| **Test Steps** | 25 |
| **Total Scenarios** | 40 |

---

## Lineage

📁 **File:** [`src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 12 |
| Steps | 20 |

### Standalone Tests

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Lineage creation from ${defaultEntity.getType()} entity | Lineage creation from ${defaultEntity.getType()} entity | 6 | [L88](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L88) |
| | ↳ *Should create lineage for the entity* | | | [L101](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L101) |
| | ↳ *Should create pipeline between entities* | | | [L158](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L158) |
| | ↳ *Verify Lineage Export CSV* | | | [L177](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L177) |
| | ↳ *Verify Lineage Export PNG* | | | [L182](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L182) |
| | ↳ *Remove lineage between nodes for the entity* | | | [L186](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L186) |
| | ↳ *Verify Lineage Config* | | | [L198](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L198) |
| 2 | Verify column lineage between tables | Column lineage between tables | - | [L208](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L208) |
| 3 | Verify column lineage between table and topic | Column lineage between table and topic | - | [L245](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L245) |
| 4 | Verify column lineage between topic and api endpoint | Column lineage between topic and api endpoint | - | [L315](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L315) |
| 5 | Verify column lineage between table and api endpoint | Column lineage between table and api endpoint | - | [L352](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L352) |
| 6 | Verify function data in edge drawer | Function data in edge drawer | - | [L387](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L387) |
| 7 | Verify table search with special characters as handled | Table search with special characters as handled | - | [L468](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L468) |
| 8 | Verify cycle lineage should be handled properly | Cycle lineage should be handled properly | 3 | [L544](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L544) |
| | ↳ *Add edges between T1-P1 and T2-P1* | | | [L760](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L760) |
| | ↳ *Navigate to T2-P2 and add edges between T1-P1 and T2-P2* | | | [L783](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L783) |
| | ↳ *Navigate to T1-P2 and add edges between T1-P2 and T2-P2* | | | [L821](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L821) |
| 9 | Verify column visibility across pagination pages | Column visibility across pagination pages | 6 | [L875](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L875) |
| | ↳ *Verify T1-P1: C1-C5 visible, C6-C11 hidden* | | | [L912](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L912) |
| | ↳ *Verify T2-P1: C1-C5 visible, C6-C12 hidden* | | | [L926](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L926) |
| | ↳ *Navigate to T1-P2 and verify visibility* | | | [L940](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L940) |
| | ↳ *Navigate to T2-P2 and verify visibility* | | | [L959](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L959) |
| | ↳ *Navigate to T1-P3 and verify visibility* | | | [L978](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L978) |
| | ↳ *Navigate to T2-P3 and verify visibility* | | | [L997](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L997) |
| 10 | Verify edges when no column is hovered or selected | Edges when no column is hovered or selected | 3 | [L1017](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1017) |
| | ↳ *Verify T1-P1 and T2-P1: Only (T1,C1)-(T2,C1), (T1,C2)-(T2,C2), (T1,C3)-(T2,C3) edges visible* | | | [L1040](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1040) |
| | ↳ *Navigate to T2-P2 and verify (T1,C1)-(T2,C6), (T1,C2)-(T2,C7), (T1,C4)-(T2,C8), (T1,C5)-(T2,C8) edges visible* | | | [L1091](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1091) |
| | ↳ *Navigate to T1-P2 and verify (T1,C6)-(T2,C6), (T1,C7)-(T2,C7), (T1,C9)-(T2,C8) edges visible* | | | [L1147](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1147) |
| 11 | Verify columns and edges when a column is hovered | Columns and edges when a column is hovered | 1 | [L1204](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1204) |
| | ↳ *Hover on (T1,C1) and verify highlighted columns and edges* | | | [L1217](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1217) |
| 12 | Verify columns and edges when a column is clicked | Columns and edges when a column is clicked | 1 | [L1265](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1265) |
| | ↳ *Navigate to T1-P2 and T2-P2, click (T2,C6) and verify highlighted columns and edges* | | | [L1278](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts#L1278) |

---


## LineageSettings

📁 **File:** [`src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 5 |

### Lineage Settings Tests

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

📁 **File:** [`src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |

### Standalone Tests

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify Platform Lineage View | Platform Lineage View | - | [L19](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts#L19) |

---


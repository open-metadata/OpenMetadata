---
layout: default
title: Tags & Classification
parent: Components
nav_order: 49
---

# Tags & Classification
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 6 |
| **Test Cases** | 28 |
| **Test Steps** | 21 |
| **Total Scenarios** | 49 |

---

## Tag

📁 **File:** [`playwright/e2e/Pages/Tag.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 18 |
| Steps | 8 |
| Total | 26 |

### Tag Page with Admin Roles
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify Tag UI | Tag UI | - | [L121](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L121) |
| 2 | Certification Page should not have Asset button | Certification Page should not have Asset button | - | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L125) |
| 3 | Rename Tag name | Rename Tag name | - | [L131](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L131) |
| 4 | Restyle Tag | Restyle Tag | - | [L156](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L156) |
| 5 | Edit Tag Description | Edit Tag Description | - | [L181](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L181) |
| 6 | Delete a Tag | Delete a Tag | - | [L203](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L203) |
| 7 | Add and Remove Assets | Add and Remove Assets | 2 | [L227](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L227) |
| | ↳ *Add Asset * | | | [L231](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L231) |
| | ↳ *Delete Asset* | | | [L235](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L235) |
| 8 | Create tag with domain | Create tag with domain | - | [L241](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L241) |
| 9 | Verify Owner Add Delete | Owner Add Delete | - | [L276](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L276) |

### Tag Page with Data Consumer Roles
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify Tag UI for Data Consumer | Tag UI for Data Consumer | - | [L336](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L336) |
| 2 | Certification Page should not have Asset button for Data Consumer | Certification Page should not have Asset button for Data Consumer | - | [L345](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L345) |
| 3 | Edit Tag Description for Data Consumer | Edit Tag Description for Data Consumer | - | [L351](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L351) |
| 4 | Add and Remove Assets for Data Consumer | Add and Remove Assets for Data Consumer | 2 | [L357](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L357) |
| | ↳ *Add Asset * | | | [L364](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L364) |
| | ↳ *Delete Asset* | | | [L368](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L368) |

### Tag Page with Data Steward Roles
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Verify Tag UI for Data Steward | Tag UI for Data Steward | - | [L393](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L393) |
| 2 | Certification Page should not have Asset button for Data Steward | Certification Page should not have Asset button for Data Steward | - | [L397](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L397) |
| 3 | Edit Tag Description for Data Steward | Edit Tag Description for Data Steward | - | [L403](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L403) |
| 4 | Add and Remove Assets for Data Steward | Add and Remove Assets for Data Steward | 2 | [L407](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L407) |
| | ↳ *Add Asset * | | | [L414](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L414) |
| | ↳ *Delete Asset* | | | [L418](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L418) |

### Tag Page with Limited EditTag Permission
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add and Remove Assets and Check Restricted Entity | Add and Remove Assets and Check Restricted Entity | 2 | [L471](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L471) |
| | ↳ *Add Asset * | | | [L482](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L482) |
| | ↳ *Delete Asset* | | | [L486](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L486) |

---

## Tags

📁 **File:** [`playwright/e2e/Pages/Tags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 4 |
| Steps | 9 |
| Total | 13 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Classification Page | Classification Page | 9 | [L104](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts#L104) |
| 2 | Search tag using classification display name should work | Search tag using classification display name should work | - | [L531](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts#L531) |
| 3 | Verify system classification term counts | System classification term counts | - | [L580](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts#L580) |
| 4 | Verify Owner Add Delete | Owner Add Delete | - | [L647](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts#L647) |

---

## TagsSuggestion

📁 **File:** [`playwright/e2e/Features/TagsSuggestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 4 |
| Total | 7 |

### Tags Suggestions Table Entity
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | View, Close, Reject and Accept the Suggestions | View, Close, Reject and Accept the Suggestions | 4 | [L58](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L58) |
| | ↳ *View and Open the Suggestions* | | | [L63](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L63) |
| | ↳ *Accept Single Suggestion* | | | [L95](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L95) |
| | ↳ *Reject Single Suggestion* | | | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L122) |
| | ↳ *Accept all Suggestion* | | | [L149](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L149) |
| 2 | Accept the Suggestions for Tier Card | Accept the Suggestions for Tier Card | - | [L185](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L185) |
| 3 | Reject All Suggestions | Reject All Suggestions | - | [L225](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L225) |

---

## MutuallyExclusiveColumnTags

📁 **File:** [`playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should show error toast when adding mutually exclusive tags to column | Show error toast when adding mutually exclusive tags to column | - | [L33](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts#L33) |

---

## ClassificationVersionPage

📁 **File:** [`playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Classification version page | Classification version page | - | [L55](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts#L55) |

---

## AutoClassification

📁 **File:** [`playwright/e2e/nightly/AutoClassification.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/AutoClassification.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Auto Classification
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should be able to auto classify data | Be able to auto classify data | - | [L38](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/AutoClassification.spec.ts#L38) |

---


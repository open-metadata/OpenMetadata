---
layout: default
title: Tags & Classification
parent: Components
nav_order: 28
---

# Tags & Classification

| Metric | Count |
|--------|-------|
| **Total Tests** | 28 |
| **Test Files** | 6 |

---

## Tag

**File:** [`playwright/e2e/Pages/Tag.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts)
**Tests:** 18

### Tag Page with Admin Roles

| Test | Line |
|------|------|
| Verify Tag UI | [L121](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L121) |
| Certification Page should not have Asset button | [L125](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L125) |
| Rename Tag name | [L131](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L131) |
| Restyle Tag | [L156](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L156) |
| Edit Tag Description | [L181](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L181) |
| Delete a Tag | [L203](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L203) |
| Add and Remove Assets | [L227](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L227) |
| Create tag with domain | [L241](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L241) |
| Verify Owner Add Delete | [L276](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L276) |

### Tag Page with Data Consumer Roles

| Test | Line |
|------|------|
| Verify Tag UI for Data Consumer | [L336](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L336) |
| Certification Page should not have Asset button for Data Consumer | [L345](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L345) |
| Edit Tag Description for Data Consumer | [L351](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L351) |
| Add and Remove Assets for Data Consumer | [L357](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L357) |

### Tag Page with Data Steward Roles

| Test | Line |
|------|------|
| Verify Tag UI for Data Steward | [L393](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L393) |
| Certification Page should not have Asset button for Data Steward | [L397](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L397) |
| Edit Tag Description for Data Steward | [L403](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L403) |
| Add and Remove Assets for Data Steward | [L407](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L407) |

### Tag Page with Limited EditTag Permission

| Test | Line |
|------|------|
| Add and Remove Assets and Check Restricted Entity | [L471](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts#L471) |

## Tags

**File:** [`playwright/e2e/Pages/Tags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts)
**Tests:** 4

### Root Tests

| Test | Line |
|------|------|
| Classification Page | [L104](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts#L104) |
| Search tag using classification display name should work | [L531](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts#L531) |
| Verify system classification term counts | [L580](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts#L580) |
| Verify Owner Add Delete | [L647](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts#L647) |

## TagsSuggestion

**File:** [`playwright/e2e/Features/TagsSuggestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts)
**Tests:** 3

### Tags Suggestions Table Entity

| Test | Line |
|------|------|
| View, Close, Reject and Accept the Suggestions | [L58](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L58) |
| Accept the Suggestions for Tier Card | [L185](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L185) |
| Reject All Suggestions | [L225](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts#L225) |

## MutuallyExclusiveColumnTags

**File:** [`playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Should show error toast when adding mutually exclusive tags to column | [L33](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts#L33) |

## ClassificationVersionPage

**File:** [`playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Classification version page | [L55](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts#L55) |

## AutoClassification

**File:** [`playwright/e2e/nightly/AutoClassification.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/AutoClassification.spec.ts)
**Tests:** 1

### Auto Classification

| Test | Line |
|------|------|
| should be able to auto classify data | [L38](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/AutoClassification.spec.ts#L38) |


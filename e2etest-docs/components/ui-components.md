---
layout: default
title: UI Components
parent: Components
nav_order: 21
---

# UI Components

| Metric | Count |
|--------|-------|
| **Total Tests** | 21 |
| **Test Files** | 6 |

---

## Pagination

**File:** [`playwright/e2e/Features/Pagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts)
**Tests:** 10

### Pagination tests for all pages

| Test | Line |
|------|------|
| should test pagination on Users page | [L29](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L29) |
| should test pagination on Roles page | [L36](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L36) |
| should test pagination on Policies page | [L43](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L43) |
| should test pagination on Database Services page | [L50](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L50) |
| should test pagination on Bots page | [L59](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L59) |
| should test pagination on Service version page | [L66](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L66) |

### Pagination tests for Classification Tags page

| Test | Line |
|------|------|
| should test pagination on Classification Tags page | [L108](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L108) |

### Pagination tests for Metrics page

| Test | Line |
|------|------|
| should test pagination on Metrics page | [L144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L144) |

### Pagination tests for Notification Alerts page

| Test | Line |
|------|------|
| should test pagination on Notification Alerts page | [L194](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L194) |

### Pagination tests for Observability Alerts page

| Test | Line |
|------|------|
| should test pagination on Observability Alerts page | [L246](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts#L246) |

## NavigationBlocker

**File:** [`playwright/e2e/Features/NavigationBlocker.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/NavigationBlocker.spec.ts)
**Tests:** 5

### Navigation Blocker Tests

| Test | Line |
|------|------|
| should show navigation blocker modal when trying to navigate away with unsaved changes | [L57](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/NavigationBlocker.spec.ts#L57) |
| should confirm navigation when  | [L105](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/NavigationBlocker.spec.ts#L105) |
| should navigate to new page when  | [L159](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/NavigationBlocker.spec.ts#L159) |
| should not show navigation blocker after saving changes | [L198](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/NavigationBlocker.spec.ts#L198) |
| should stay on current page and keep changes when X button is clicked | [L245](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/NavigationBlocker.spec.ts#L245) |

## Tour

**File:** [`playwright/e2e/Flow/Tour.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Tour.spec.ts)
**Tests:** 3

### Tour should work properly

| Test | Line |
|------|------|
| Tour should work from help section | [L161](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Tour.spec.ts#L161) |
| Tour should work from welcome screen | [L175](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Tour.spec.ts#L175) |
| Tour should work from URL directly | [L191](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Tour.spec.ts#L191) |

## DataAssetsWidget

**File:** [`playwright/e2e/Features/LandingPageWidgets/DataAssetsWidget.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DataAssetsWidget.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Check Data Asset and Service Filtration | [L48](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DataAssetsWidget.spec.ts#L48) |

## FollowingWidget

**File:** [`playwright/e2e/Features/LandingPageWidgets/FollowingWidget.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/FollowingWidget.spec.ts)
**Tests:** 1

### Root Tests

| Test | Line |
|------|------|
| Check followed entity present in following widget | [L77](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/FollowingWidget.spec.ts#L77) |

## Markdown

**File:** [`playwright/e2e/Features/Markdown.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Markdown.spec.ts)
**Tests:** 1

### Markdown

| Test | Line |
|------|------|
| should render markdown | [L69](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Markdown.spec.ts#L69) |


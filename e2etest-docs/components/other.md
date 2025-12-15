---
layout: default
title: Other
parent: Components
nav_order: 31
---

# Other
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 10 |
| **Test Cases** | 19 |
| **Test Steps** | 12 |
| **Total Scenarios** | 31 |

---

## Policies

📁 **File:** [`playwright/e2e/Pages/Policies.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 9 |
| Total | 12 |

### Policy page should work properly
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add new policy with invalid condition | Add new policy with invalid condition | 9 | [L101](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L101) |
| | ↳ *Default Policies and Roles should be displayed* | | | [L104](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L104) |
| | ↳ *Add new policy* | | | [L118](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L118) |
| | ↳ *Edit policy description* | | | [L185](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L185) |
| | ↳ *Edit policy display name* | | | [L206](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L206) |
| | ↳ *Add new rule* | | | [L218](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L218) |
| | ↳ *Edit rule name for created Rule* | | | [L248](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L248) |
| | ↳ *Delete new rule* | | | [L270](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L270) |
| | ↳ *Delete last rule and validate* | | | [L284](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L284) |
| | ↳ *Delete created policy* | | | [L298](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L298) |
| 2 | Policy should have associated rules and teams | Policy should have associated rules and teams | - | [L330](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L330) |
| 3 | Delete policy action from manage button options | Delete policy action from manage button options | - | [L373](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts#L373) |

---

## Customproperties-part2

📁 **File:** [`playwright/e2e/Pages/Customproperties-part2.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 7 |
| Steps | 0 |
| Total | 7 |

### Add update and delete Enum custom properties
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add Enum custom property for ${entity.name} | Add Enum custom property for ${entity.name} | - | [L36](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts#L36) |

### Add update and delete Table custom properties
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add Table custom property for ${entity.name} | Add Table custom property for ${entity.name} | - | [L76](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts#L76) |
| 2 | Add Entity Reference custom property for ${entity.name} | Add Entity Reference custom property for ${entity.name} | - | [L118](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts#L118) |
| 3 | Add Entity Reference list custom property for ${entity.name} | Add Entity Reference list custom property for ${entity.name} | - | [L163](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts#L163) |

### Add update and delete Date custom properties
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add Date custom property for ${entity.name} | Add Date custom property for ${entity.name} | - | [L210](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts#L210) |

### Add update and delete Time custom properties
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add Time custom property for ${entity.name} | Add Time custom property for ${entity.name} | - | [L238](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts#L238) |

### Add update and delete DateTime custom properties
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add DateTime custom property for ${entity.name} | Add DateTime custom property for ${entity.name} | - | [L278](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts#L278) |

---

## Dimensionality

📁 **File:** [`playwright/e2e/Features/DataQuality/Dimensionality.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/Dimensionality.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 3 |
| Total | 4 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Dimensionality Tests | Dimensionality Tests | 3 | [L45](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/Dimensionality.spec.ts#L45) |

---

## FrequentlyJoined

📁 **File:** [`playwright/e2e/Flow/FrequentlyJoined.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/FrequentlyJoined.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 0 |
| Total | 2 |

### Frequently Joined
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should display frequently joined columns | Display frequently joined columns | - | [L30](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/FrequentlyJoined.spec.ts#L30) |
| 2 | should display frequently joined table | Display frequently joined table | - | [L48](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/FrequentlyJoined.spec.ts#L48) |

---

## CronValidations

📁 **File:** [`playwright/e2e/Features/CronValidations.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CronValidations.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Cron Validations
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Validate different cron expressions | Validate different cron expressions | - | [L46](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CronValidations.spec.ts#L46) |

---

## RecentlyViewed

📁 **File:** [`playwright/e2e/Features/RecentlyViewed.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/RecentlyViewed.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Recently viewed data assets
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Check ${entity.getType()} in recently viewed | ${entity.getType()} in recently viewed | - | [L67](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/RecentlyViewed.spec.ts#L67) |

---

## AppBasic

📁 **File:** [`playwright/e2e/Flow/AppBasic.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AppBasic.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | should call installed app api and it should respond with 200 | Call installed app api and it should respond with 200 | - | [L18](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AppBasic.spec.ts#L18) |

---

## Collect

📁 **File:** [`playwright/e2e/Flow/Collect.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Collect.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Collect end point should work properly
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Visit ${pageDetails.name} page should trigger collect API | Visit ${pageDetails.name} page should trigger collect API | - | [L60](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Collect.spec.ts#L60) |

---

## Navbar

📁 **File:** [`playwright/e2e/Flow/Navbar.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Navbar.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Search Term - ${label} | Search Term - ${label} | - | [L25](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Navbar.spec.ts#L25) |

---

## Customproperties-part1

📁 **File:** [`playwright/e2e/Pages/Customproperties-part1.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part1.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Add update and delete ${property} custom properties
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add ${property} custom property for ${entity.name} | Add ${property} custom property for ${entity.name} | - | [L49](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part1.spec.ts#L49) |

---


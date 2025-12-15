---
layout: default
title: Activity & Collaboration
parent: Components
nav_order: 44
---

# Activity & Collaboration
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 3 |
| **Test Cases** | 20 |
| **Test Steps** | 24 |
| **Total Scenarios** | 44 |

---

## NotificationAlerts

📁 **File:** [`playwright/e2e/Flow/NotificationAlerts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 6 |
| Steps | 16 |
| Total | 22 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Single Filter Alert | Single Filter Alert | 4 | [L135](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L135) |
| 2 | Multiple Filters Alert | Multiple Filters Alert | 3 | [L197](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L197) |
| 3 | Task source alert | Task source alert | 2 | [L258](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L258) |
| 4 | Conversation source alert | Conversation source alert | 3 | [L276](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L276) |
| 5 | Alert operations for a user with and without permissions | Alert operations for a user with and without permissions | 4 | [L335](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L335) |
| 6 | destination should work properly | Destination should work properly | - | [L388](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L388) |

---

## ActivityFeed

📁 **File:** [`playwright/e2e/Features/ActivityFeed.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 9 |
| Steps | 3 |
| Total | 12 |

### FeedWidget on landing page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | renders widget wrapper and header with sort dropdown | Renders widget wrapper and header with sort dropdown | - | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L122) |
| 2 | clicking title navigates to explore page | Clicking title navigates to explore page | - | [L158](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L158) |
| 3 | feed body renders content or empty state | Feed body renders content or empty state | - | [L175](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L175) |
| 4 | changing filter triggers feed reload | Changing filter triggers feed reload | - | [L199](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L199) |
| 5 | footer shows view more link when applicable | Footer shows view more link when applicable | - | [L234](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L234) |
| 6 | feed cards render with proper structure when available | Feed cards render with proper structure when available | - | [L252](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L252) |
| 7 | emoji reactions can be added when feed messages exist | Emoji reactions can be added when feed messages exist | - | [L280](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L280) |
| 8 | thread drawer opens from reply count and allows posting a reply | Thread drawer opens from reply count and allows posting a reply | - | [L314](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L314) |

### Mention notifications in Notification Box
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Mention notification shows correct user details in Notification box | Mention notification shows correct user details in Notification box | 3 | [L416](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L416) |
| | ↳ *Admin user creates a conversation on an entity* | | | [L422](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L422) |
| | ↳ *User1 mentions admin user in a reply* | | | [L478](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L478) |
| | ↳ *Admin user checks notification for correct user and timestamp* | | | [L524](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L524) |

---

## DescriptionSuggestion

📁 **File:** [`playwright/e2e/Features/DescriptionSuggestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DescriptionSuggestion.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 5 |
| Steps | 5 |
| Total | 10 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | View, Close, Reject and Accept the Suggestions | View, Close, Reject and Accept the Suggestions | 5 | [L52](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DescriptionSuggestion.spec.ts#L52) |
| 2 | Reject All Suggestions | Reject All Suggestions | - | [L224](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DescriptionSuggestion.spec.ts#L224) |
| 3 | Fetch on avatar click and then all Pending Suggestions button click | Fetch on avatar click and then all Pending Suggestions button click | - | [L267](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DescriptionSuggestion.spec.ts#L267) |
| 4 | Should auto fetch more suggestions, when last user avatar is eliminated and there are more suggestions | Auto fetch more suggestions, when last user avatar is eliminated and there are more suggestions | - | [L319](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DescriptionSuggestion.spec.ts#L319) |
| 5 | Should fetch initial 10 suggestions on entity change from table1 to table2 | Fetch initial 10 suggestions on entity change from table1 to table2 | - | [L385](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DescriptionSuggestion.spec.ts#L385) |

---


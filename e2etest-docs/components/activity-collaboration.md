---
layout: default
title: Activity & Collaboration
parent: Components
nav_order: 15
---

# Activity & Collaboration

| Metric | Count |
|--------|-------|
| **Total Tests** | 15 |
| **Test Files** | 2 |

---

## ActivityFeed

**File:** [`playwright/e2e/Features/ActivityFeed.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts)
**Tests:** 9

### FeedWidget on landing page

| Test | Line |
|------|------|
| renders widget wrapper and header with sort dropdown | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L122) |
| clicking title navigates to explore page | [L158](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L158) |
| feed body renders content or empty state | [L175](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L175) |
| changing filter triggers feed reload | [L199](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L199) |
| footer shows view more link when applicable | [L234](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L234) |
| feed cards render with proper structure when available | [L252](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L252) |
| emoji reactions can be added when feed messages exist | [L280](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L280) |
| thread drawer opens from reply count and allows posting a reply | [L314](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L314) |

### Mention notifications in Notification Box

| Test | Line |
|------|------|
| Mention notification shows correct user details in Notification box | [L416](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L416) |

## NotificationAlerts

**File:** [`playwright/e2e/Flow/NotificationAlerts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts)
**Tests:** 6

### Root Tests

| Test | Line |
|------|------|
| Single Filter Alert | [L135](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L135) |
| Multiple Filters Alert | [L197](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L197) |
| Task source alert | [L258](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L258) |
| Conversation source alert | [L276](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L276) |
| Alert operations for a user with and without permissions | [L335](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L335) |
| destination should work properly | [L388](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/NotificationAlerts.spec.ts#L388) |


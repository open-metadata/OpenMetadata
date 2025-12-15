---
title: Activity & Collaboration
---

# Activity & Collaboration

## Table of contents
[[toc]]

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 1 |
| **Test Cases** | 9 |
| **Test Steps** | 3 |
| **Total Scenarios** | 12 |

---

## ActivityFeed

📁 **File:** [`src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 9 |
| Steps | 3 |

### FeedWidget on landing page

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

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Mention notification shows correct user details in Notification box | Mention notification shows correct user details in Notification box | 3 | [L416](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L416) |
| | ↳ *Admin user creates a conversation on an entity* | | | [L422](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L422) |
| | ↳ *User1 mentions admin user in a reply* | | | [L478](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L478) |
| | ↳ *Admin user checks notification for correct user and timestamp* | | | [L524](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts#L524) |

---


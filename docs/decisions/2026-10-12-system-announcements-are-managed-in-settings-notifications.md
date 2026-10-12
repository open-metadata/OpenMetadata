# System announcements are managed by admins in Settings › Notifications › Announcements

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `GlobalSettingsClassBase.test.ts` (Announcements card admin-only),
  `NotificationLanding.test.tsx` (native Announcements card), `useSystemAnnouncements.test.tsx`
  (title search and paging)
- **Related:** #34581, #34162

## Context
An announcement with no `entityLink` is a system announcement: it is shown to the whole
organization, and only admins and bots may write one (#34581). Nothing in the UI created or listed
them. Admins need one place to manage them, in both app modes, with search over the title.

## Decision
- The admin surface is a card under Settings › Notifications, keyed
  `notifications.announcements` (`GlobalSettingOptions.ANNOUNCEMENTS`). Its `isProtected` is the
  admin flag alone — no resource permission grants it, because the server allows no other user.
- Routes are `/settings/notifications/announcements`, `…/add`, `…/edit/:id` and
  `…/duplicate/:id`, behind `AdminProtectedRoute` with no `hasPermission`. A duplicate saves a new
  announcement; it is never a PATCH.
- In the AI-mode settings modal the same page is a **native** Notification section
  (`NATIVE_NOTIFICATION_SECTIONS`), keyed `announcements` and routed at
  `#notification/section/announcements/<subPath>`. Native sections go through the same
  `NotificationSectionContribution` contract and card-visibility rule as downstream contributions,
  and are listed before them. A downstream build must not contribute a section with a native key.
- The list fetches every system announcement matching the Status and Type filters in one
  request (`limit` = `SYSTEM_ANNOUNCEMENT_FETCH_LIMIT`, 1000), then searches by title, sorts by
  start date (newest first) and pages in the browser. Only admins write system announcements, so
  the set stays far below the cap, and searching one server page would miss matches on the others.

## Consequences
Collate and other downstream builds inherit the page without code of their own. If system
announcements ever approach the fetch cap, search and paging must move to the server (a `q`
list filter) and this record be amended. Renaming the menu
key, the section key or the routes breaks deep links and downstream tests. Letting non-admins
manage system announcements needs a server change first (`authorizeSystemAnnouncementWrite`), then
a permission-based `isProtected` here and an amendment to this record.

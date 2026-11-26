# System announcements are managed by admins in Settings › Notifications › Announcements

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial) · v2 2026-10-14 (users see only critical ones, as the Home banner) ·
  v3 2026-11-06 (users see every type: criticals in the banner, the rest in the rail)
- **Deciders:** Shrabanti Paul
- **Guard:** `GlobalSettingsClassBase.test.ts` (Announcements card admin-only),
  `NotificationLanding.test.tsx` (native Announcements card), `useSystemAnnouncements.test.tsx`
  (title search and paging), `CriticalAnnouncements.test.tsx` and `AnnouncementsRail.test.tsx`
  (what reaches users on Home)
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

## Amendment (v2, 2026-10-14)

> The first and third bullets are superseded by v3: non-critical system announcements now reach
> users too.

- Users see a system announcement only when it is **Critical and Active**, and only on Home, as
  the top banner (`CriticalAnnouncements`). Other types stay admin-only bookkeeping in Settings.
  Several live criticals share the banner slot as a carousel moved only by the user; it wraps at
  either end rather than disabling a button and dropping its focus.
- The banner reads **every** page of live criticals (until `paging.after` runs out) and orders them
  newest-first in the browser. The server pages in its own order, not by start time, so sorting a
  single page could silently leave the newest out; the page size is not a cap.
- The Home announcements rail and its dialog list asset announcements only (`system=false`), so a
  system announcement never appears twice.
- Dismissal stays per user and browser-local, as the rail's already was, but each Home surface
  keeps its own list (`DismissedAnnouncementsScope`): each prunes against what it shows, and a
  shared list would let the rail prune the banner's dismissals away.

## Amendment (v3, 2026-11-06)
- Users see **every** live system announcement on Home, whatever its type: an admin who publishes
  a Notice or a Custom one from Settings expects the organization to see it. Criticals keep the
  top banner; every other type shows as a card in the announcements rail, which now reads
  without the `system` filter and leaves out only the system criticals (`isCriticalSystemAnnouncement`),
  so none appears twice on the page.
- The "View all" dialog mirrors the rail: every live announcement but the system criticals, which
  the banner alone owns, dismissals included (each surface keeps its own dismissal scope). Its
  badge is the server's `paging.total` less the banner's live criticals, read from the banner's
  own cached query (`rest/queries/criticalAnnouncementsQuery.ts`).
- The carousels that show one announcement at a time — the critical banner and the announcement
  banner on data asset, domain, data product, Data Marketplace and service pages — draw core
  `PaginationDot` (`size="sm"`) under them, one dot per announcement, and a dot jumps there. The rail shows several cards at once, so it pages by its arrows alone.

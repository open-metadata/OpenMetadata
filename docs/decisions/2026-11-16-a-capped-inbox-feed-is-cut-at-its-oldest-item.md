# A capped Inbox feed is cut at its oldest item, and its shortest window is Today

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Harsh Vador
- **Guard:** `useInboxActivity.test.tsx` ("cuts the conversations at the oldest event of a capped
  activity list", "cuts the events at the oldest conversation of a capped conversation list"),
  `ActivityTab.test.tsx` ("marks the cut day as a floor and says the feed is capped"),
  `inbox.utils.test.ts` ("offers Today in place of Yesterday, up to 30 days", "bounds a window by
  the viewer's own days, not UTC's")
- **Related:** #37885, #37886, ADR:2026-10-28-inbox-activity-opens-on-the-filter-a-link-names

## Context
The Inbox Activity feed merges two lists: activity events from `/v1/activity` (at most 200, newest
first) and conversations from `/v1/conversations` (at most 100). Neither takes a cursor, and
`/v1/activity` takes a start time but no end time. On a busy server, 200 events covered the last
8 minutes. Past them the feed showed conversations alone for the rest of the 30 days, as if no
events happened, and the day header counted 200 as if it were the day's total. The date presets
came from the profiler: "Yesterday" ran from the start of yesterday to now, so it listed today.
Ending the window at midnight would fetch the newest 200 events from yesterday onwards and then drop
them, so a busy today would leave "Yesterday" empty.

## Decision
When either list comes back a full page, the merged feed is cut at that list's oldest item, so both
kinds cover the same span. The cut day's count, taken from the whole feed before any type filter,
reads "N+", and the end of the feed says only the newest updates in the range are shown. Every date
preset runs to now and starts at the beginning of a day in the viewer's own time zone, the days the
feed's headers name. The one-day preset is "Today" (start of today to now), not "Yesterday".

## Consequences
The feed never shows a stretch of one kind standing in for both. Older updates in the range can't be
reached from the Inbox until `/v1/activity` and `/v1/conversations` page by cursor or take an end
time; then the cut can give way to paging, and a "Yesterday" preset can return.

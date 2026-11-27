# A capped Inbox feed is cut at its oldest item, and its shortest window is Today

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial) · v2 2026-11-16 (the Mentions feed is not cut) · v3 2026-11-19 (older task mentions in All) · v4 2026-11-20 (bounded task mentions and seen marks)
- **Deciders:** Harsh Vador
- **Guard:** `useInboxActivity.test.tsx` ("cuts the conversations at the oldest event of a capped
  activity list", "cuts the events at the oldest conversation of a capped conversation list",
  "leaves Mentions whole when its conversations are capped", "places no cut when only the Mentions
  events are capped"),
  `ActivityTab.test.tsx` ("marks the cut day as a floor and says the feed is capped", "marks the day
  the feed was cut, not the day of its last card"),
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

## Amendment

v2 2026-11-16: the Mentions feed is left whole. A mention event carries the event's own time, not
the mention's, so an old event mentioned today would fall before any cut taken from the
conversations. When the Mentions conversations come back a full page, the feed can show mention
events older than its oldest conversation. The day marked "N+" is the one where the feed was cut,
not the day of its last card: for Mentions, where its conversations stop. When only its events are
capped no day is marked, since their times don't say where the mentions stop; the end-of-feed note
still shows. Every other feed is cut as above.

v3 2026-11-19: All retains task-comment mentions before the cutoff for activity and conversations.
Each visible day at or before that cutoff displays its count as a lower bound, including days
that contain only task mentions.

v4 2026-11-20: Inbox task mentions keep at most 100 comments, matching the conversation cap.
A full task-mention result marks the feed as capped; its oldest comment also bounds the complete
span of All's activity and conversations. Mentions retains older event cards because their event
time is not their mention time. The sidebar counts at most 100 task mentions and displays 99+.
The cached mention result carries the time its first request started. Opening it advances the
seen mark only through that time, never through the later time the view was opened.

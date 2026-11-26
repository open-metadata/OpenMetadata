# The Inbox Activity tab opens on the sub-tab a link's `?filter=` names

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `InboxPage/inbox.utils.test.ts` (the landing link names a real filter), `InboxContent.test.tsx` (an unknown value is ignored)
- **Related:** PR #36409

## Context
The landing page's Team Activity card reads the `my-feed` endpoint, which is the AI-mode Inbox's
**My Assets** sub-tab. Its "View All Activity" sent AI-mode users to the Classic profile Activity
tab, and the Inbox had no way to open on a sub-tab other than All. The Inbox already took a
`?taskId=` deep link for one task.

## Decision
- `/inbox/activity` accepts `?filter=<ActivityFilter value>` (`INBOX_ACTIVITY_FILTER_PARAM`) as the
  Activity tab's starting sub-tab. `InboxContent` reads it and passes it to `ActivityTab` as
  `initialFilter`.
- A value outside `ActivityFilter` is ignored and the tab opens on All. The parameter is read on
  mount only. Changing sub-tabs does not write it back to the URL.
- Links from outside the Inbox use the paths in `personalSpace.constants`
  (`INBOX_MY_ASSETS_ACTIVITY_PATH`), not `inbox.utils`. That module pulls a large graph (profiler
  constants and the date utilities), which a landing-page chunk must not load. The value is
  therefore spelled out by hand there, and the guard test pins it to the enum.

## Consequences
Any surface can deep-link a filtered Activity feed without the Inbox knowing who links to it.
Renaming an `ActivityFilter` value breaks every link that names it. The guard covers the landing
link, and a new link should be added to it. To revisit this, the filter would move into the URL
for real (written back on change), which also makes it bookmarkable.

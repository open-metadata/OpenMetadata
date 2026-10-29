# The grouped incidents' order lives in the page URL as `sortField` and `sortType`

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `IncidentGroupsView.test.tsx` ("should keep the ordering in the URL", "should open on
  the ordering a link carries") and `IncidentGroups.utils.test.ts` (`parseIncidentGroupSort`)
- **Related:** #34616, #34599, #36397

## Context

The grouped view of the AI-mode Incident Manager (#34599) kept the group-by dimension, the filters,
the open group and the page in the URL, but held the groups' order in component state. A comment in
`useIncidentGroups` recorded why: the order was a view preference the endpoint defaults on its own,
so a shared link could carry the groups without carrying their order too.

Release testing of 2.1.0 found the opposite expectation: sorting by Incidents, Severity or Last
seen and then reloading, or sharing the link, silently reset the order, which read as a bug. The
page and page size still live in component state (`useIncidentPaging`); this record does not move
them.

## Decision

- The groups' order is part of the page URL, as `sortField` and `sortType`. These names match the
  groups API's sort params (`INCIDENT_GROUP_SORT_FIELD_PARAM`, `INCIDENT_GROUP_SORT_TYPE_PARAM`).
- The URL is the only source of the order: `useIncidentGroups` reads it with
  `parseIncidentGroupSort` and holds no local copy.
- A sort change replaces the current history entry and keeps every other param, the same way the
  group-by and filter changes do.
- The field and the direction fall back to `DEFAULT_INCIDENT_GROUP_SORT` independently, rather
  than reaching the API: a missing or unknown `sortField` takes the default field, and a
  `sortType` other than `asc`/`desc` takes the default direction. So
  `?sortField=severity&sortType=bogus` sorts by severity in the default direction.

## Consequences

- A reload, Back/Forward and a shared link all keep the order. A link with no sort params opens in
  the default order, so links shared before this change behave as before.
- The two param names are now part of the page's URL contract: renaming either breaks saved and
  shared links, and another param on this route must not reuse them.
- Keeping the order out of the URL again would supersede this record. It would be worth revisiting
  only if the order stopped being something users share or return to.

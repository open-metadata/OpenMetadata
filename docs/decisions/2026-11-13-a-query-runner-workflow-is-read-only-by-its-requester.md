# A query runner workflow is read only by its requester, an admin or a bot

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Khairajani
- **Guard:** `WorkflowReadScopeIT`
- **Related:** ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read

## Context
A `QUERY_RUNNER` workflow stores the SQL a user ran, the query that was executed, the service and
the user's id. Every user may view workflows (`OrganizationPolicy` grants `ViewAll` on all
resources), so `GET /v1/automations/workflows?workflowType=QUERY_RUNNER` returned every user's
queries, while their results and a re-run were already limited to the requester.

## Decision
- A `QUERY_RUNNER` workflow is readable only by the user its `request.userId` names, an admin or a
  bot. A run with no `request.userId` is readable by admins and bots only.
- The listing applies this in SQL (`ListFilter` parameter `queryRunnerRequesterId`), so pages and
  `paging.total` count only readable rows. Workflows of other types are listed as before.
- The id, name and version reads refuse another user's query runner workflow with 403, the answer
  the results and trigger endpoints already give.
- The `/history` listing leaves another user's query runner snapshots out of its page rather than
  refusing the page.
- PATCH, PUT, DELETE and restore refuse another user's query runner workflow with 403 before the
  write: each returns the workflow it changed, and a PATCH or PUT could rewrite the requester.
- The requester may delete their own query runner workflow by id or by name without Delete on
  workflows. SQL Studio deletes a run as its requester once the results are read or the query is
  stopped, and a non-admin holds no Delete, so without this their runs were never removed. Any
  other caller still needs Delete, and the async delete still needs it from everyone. The
  requester gets no PATCH or PUT: a requester who could rewrite `request.userConfigId` could
  re-run their workflow with another user's credentials.

## Consequences
A user sees only their own SQL Studio runs and can remove them; admins and bots, which dispatch and clean up runs, see
all of them. A policy cannot grant another user's queries, because the rule is not a policy. A new
read path on workflows must apply the same check or it reopens the leak.

# The status badge says who set the status, from the entity's version history

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `EntityStatusDecision.utils.test.ts` (the lookup and every wording case);
  `EntityStatusBadge.test.tsx`; `WorkflowRunApprovalOutcome.spec.ts` (a reviewer approves a
  glossary term and the badge says so)
- **Related:** ADR:2026-11-13-a-workflow-run-records-how-each-approval-step-was-decided

## Context
An entity's status can be set by people deciding an approval, by a workflow approving it itself, by
an administrator's override, by a workflow that moves it with no approval at all (after someone's
edit, or on a schedule), or by a person. The badge showed only the status. The run records only the
approval decisions, not which status a run wrote or when, and a status set before decisions were
recorded has no run record to read at all.

## Decision
- Hovering an entity's status badge looks up who set the status; nothing is fetched until then.
- The entity's version history gives the newest version that changed `entityStatus`: the status,
  who wrote it and when. An entity whose status never changed reads its creating version.
- The status-setting workflow run that was active at that moment names the workflow. "Active" means
  started no later than, and ended no earlier than, the change, within 5 seconds either way: a
  workflow writes the status and ends its run within moments. One page of the entity's 10 runs
  started before the change is read, newest first, and only the runs active then have their
  workflow definition read. Status-setting means the definition sets `status`/`entityStatus` or is
  a lifecycle playbook, so an edit review in Enforce mode is never named for a status.
- Of the status-setting runs active then, the one that decided the status is named first, then one
  already running when the status changed: the status write itself fires an update that can start a
  short run of the same workflow just after it.
- From that run come its approval outcome (the one decided closest to the change, within 60
  seconds either way: a decision is written once its step commits, after the status write in the
  same step, so it can land just after the change), whose change
  started it (`global_updatedBy`), or that it ran on its schedule (a periodic trigger). With no such
  run, the version's author is named, and the governance bot reads as "a workflow".
- A lookup costs at most three requests and is cached per entity and status for 60 seconds, so
  hovering again reuses it and a status changed on the page is looked up afresh.

## Consequences
- The hover explains statuses set before approval outcomes were recorded, since version history
  predates them; for those runs it names the workflow without the decision.
- A run that changed the status after more than 10 newer runs of the entity started, or whose
  status write and run ends were more than 5 seconds apart, is not matched; the hover then names the
  version's author instead of the workflow.
- An entity with a very long version history pays for reading all of it on hover; revisit with a
  server-side "last status change" if that becomes slow.

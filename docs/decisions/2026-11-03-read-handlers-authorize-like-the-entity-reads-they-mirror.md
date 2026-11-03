# Read handlers authorize like the entity reads they mirror

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-04 (task listings check the task's entity)
- **Deciders:** Mohit Yadav
- **Guard:** `FeedAccessAuthzIT` (conversation and task by id, activity by link, task listings),
  `ReadHandlerAuthorizationIT`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Hand-written read handlers make their own authorization call, and several made none or checked
less than the entity read beside them: conversations and tasks by id checked only the
conversation or task resource although they disclose their target, `/activity/about` matched
events of any type sharing the link's FQN, and `/teams/hierarchy`, `/roles`, `/tasks/count`,
`/domains/hierarchy` and the type custom-property reads checked nothing. The profiler setting was
checked against whichever type the caller named.

## Decision
- Reading a conversation or a task by id (and its replies or versions) also needs ViewBasic on the
  entity it is about, while that entity exists; a refused conversation answers 404. Creators and
  assignees of a task are not exempt.
- Activity by entity link matches the link's entity type as well as its FQN, and keeps only events
  the caller may view.
- `/teams/hierarchy`, `/tasks/count`, `/domains/hierarchy` and the type custom-property reads
  need ViewBasic on their type; the hierarchy drops teams the caller may not view. `/roles` goes
  through the standard listing. Someone signing up (self sign-up on, no user yet) still lists the
  joinable teams.
- The global profiler setting is always decided on `table`.

## Consequences
A new hand-written read handler authorizes the operation its entity read would, on the entity it
discloses.

## Amendment (v2, 2026-11-04)
The task listings checked only the task row, so a task refused by id about a hidden entity was
still listed with its payload: by `aboutEntity`, which matches an FQN prefix, in the assignee's
`/tasks/assigned`, and in `/domains/{fqn}/tasks`. Every task listing (`/tasks`, `/assigned`,
`/visible`, `/owned`, `/created`, `/dataAccessRequests` and `/domains/{fqn}/tasks`) now drops the
tasks about an entity the caller may not view (`TaskAboutVisibility`): one relationship query per
page reads each task's entity, `ViewPermissionFilter` decides them in a batch per type, and a check
that fails hides the task. Types every entity of which the caller may view, as for an admin, are
not checked. Pages are not refilled, so they can come back short; `paging.total` and
`/tasks/count` still count every task.

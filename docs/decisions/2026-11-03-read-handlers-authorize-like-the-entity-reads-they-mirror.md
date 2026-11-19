# Read handlers authorize like the entity reads they mirror

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-04 (task listings check the task's entity)
- **Deciders:** Mohit Yadav
- **Guard:** `FeedAccessAuthzIT` (conversation and task by id, activity by link, task listings),
  `ReadHandlerAuthorizationIT`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Hand-written read handlers make their own authorization call instead of going through the entity
read. What a handler returns decides what it checks: a conversation or a task shows the entity it
is about, activity by entity link shows events about that entity, and the hierarchy, count and
custom-property reads show entities of their type. So each handler checks what the entity read
beside it would.

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
A task listing returns each task with its payload, which shows the entity the task is about, as
reading the task by id does. Every task listing (`/tasks`, `/assigned`, `/visible`, `/owned`,
`/created`, `/dataAccessRequests` and `/domains/{fqn}/tasks`) therefore drops the tasks about an
entity the caller may not view (`TaskAboutVisibility`): one relationship query per page reads each
task's entity, `ViewPermissionFilter` decides them in a batch per type, and a check that fails
hides the task. Types every entity of which the caller may view, as for an admin, are not checked.
Pages are not refilled, so they can come back short; `paging.total` and `/tasks/count` still count
every task.

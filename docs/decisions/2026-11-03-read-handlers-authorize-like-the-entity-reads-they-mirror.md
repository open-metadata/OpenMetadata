# Read handlers authorize like the entity reads they mirror

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `ReadHandlerAuthorizationIT`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Hand-written read handlers make their own authorization call, and several made none or checked
less than the entity read beside them: tasks by id checked only the task resource although they
disclose their target, `/activity/about` matched
events of any type sharing the link's FQN, and `/teams/hierarchy`, `/roles`, `/tasks/count`,
`/domains/hierarchy` and the type custom-property reads checked nothing. The profiler setting was
checked against whichever type the caller named.

## Decision
- Reading a task by id (and its versions) also needs ViewBasic on the entity it is about, while
  that entity exists. Creators and assignees of a task are not exempt.
- Activity by entity link matches the link's entity type as well as its FQN.
- `/teams/hierarchy`, `/tasks/count`, `/domains/hierarchy` and the type custom-property reads
  need ViewBasic on their type. `/roles` goes through the standard listing. Someone signing up (self sign-up on, no user yet) still lists the
  joinable teams.
- The global profiler setting is always decided on `table`.

## Consequences
A new hand-written read handler authorizes the operation its entity read would, on the entity it
discloses.

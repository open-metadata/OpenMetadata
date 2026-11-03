# A team with several parents is expanded once in hierarchy walks and listings

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** @sonika-shah
- **Guard:** `TeamResourceIT#test_exportListsEachTeamOfAMultiParentHierarchyOnce`, `PermissionDebugServiceTest#debugUserPermissionsProcessesAncestorReachedThroughMultipleParentsOnce`
- **Related:** —

## Context

Groups and Departments may have several parents, so the team hierarchy is a graph, not a tree. A walk
that descends along every path visits a team once per path, and the number of paths grows with the
product of the parents above it.

## Decision

The walks that read the hierarchy track the teams they have visited and descend into each once: the
team and user CSV exports, the group-team lookup, the permission debug view (across all of a user's
teams) and the CSV import's parent check. In a team CSV export a team appears once, with all its
parents in `parents*`. The cycle check on team create and update is not one of them.

`GET /v1/teams/hierarchy` lists a team below each of its parents but attaches its own children below
the first parent in reference order only; below the others it appears without children.

## Consequences

Walks and responses are linear in teams and edges. A client that renders `GET /v1/teams/hierarchy`
finds a multi-parent team's sub-teams under its first parent only.

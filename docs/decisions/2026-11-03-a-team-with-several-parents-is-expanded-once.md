# A team with several parents is visited once by hierarchy walks and listed under each parent within a node budget

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** @sonika-shah
- **Guard:** `TeamResourceIT#test_exportListsEachTeamOfAMultiParentHierarchyOnce`, `TeamRepositoryUnitTest#test_expandHierarchyStaysWithinItsBudgetAndExpandsEveryTeamOnce`, `PermissionDebugServiceTest#debugUserPermissionsProcessesAncestorReachedThroughMultipleParentsOnce`
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

`GET /v1/teams/hierarchy` lists a team with its full subtree below each of its parents, within a node
budget of `max(1000, 10 × teams)` (`TeamRepository.expandHierarchy`). Once the budget is spent, a team already
expanded elsewhere is listed without children, so every team's subtree still appears at least once.
Ten nodes per team leaves room for the multi-parent teams real hierarchies have; only a hierarchy
built so that the paths to its teams multiply reaches it.

## Consequences

Walks are linear in teams and edges, and the hierarchy response is bounded by its budget plus the
number of edges. Below the budget the response is unchanged. Raising the budget is safe as long as it
stays proportional to the number of teams.

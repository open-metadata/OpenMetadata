# A reviewer is matched by user id

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `DefaultAuthorizerTest.aReviewerIsMatchedByUserIdNotByName`,
  `PolicyEnforcementIT.aReviewerTeamDoesNotMakeAUserOfTheSameNameAReviewer`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`DefaultAuthorizer` lets the reviewers of an entity act on it without policy evaluation. It
compared the caller's name with each reviewer's name or FQN. Reviewers can be teams, and user and
team names live in separate namespaces, so a user whose name equals a reviewer team's name was
treated as that reviewer.

## Decision
The caller is a reviewer only when a reviewer reference has type `user` and the caller's user id.
A reviewer team does not exempt its members either; they are authorized by their policies.

## Consequences
Members of a reviewer team go through policy evaluation like anyone else. Exempting them would
need a team-membership check (the resolved team hierarchy), not a name comparison.

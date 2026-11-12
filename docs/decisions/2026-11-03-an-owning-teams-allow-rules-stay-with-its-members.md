# An owning team's allow rules stay with its members

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SubjectCacheTest.testOwnerTeamOfAResourceContributesOnlyItsDenyRules`,
  `PolicyEnforcementIT.anOwningTeamsAllowRulesApplyOnlyToItsMembers`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
When an entity is owned by a team, `SubjectContext.getPolicies` adds that team's policies (and its
parents') to the caller's own. For a caller outside the team, this applied the team's allow rules
too, so owning an asset handed the team's grants to everyone who touched it.

## Decision
For owner teams the caller does not belong to, only the deny rules of the team's policies are
evaluated. Members get the team's full policies through membership, as before. Team default roles
stay out of this path.

## Consequences
A team can still fence its assets off with deny rules that apply to everyone. Granting outsiders
access to a team's assets takes a role or a policy on a team they belong to.

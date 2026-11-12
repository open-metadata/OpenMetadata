# A disabled policy has no rules

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SubjectCacheTest.testDisabledPolicyContributesNoRules`,
  `PolicyEnforcementIT.aDisabledPolicyGrantsNothing`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
A policy carries `enabled`, and the UI offers to turn a policy off, but the evaluator compiled the
rules of every attached policy whatever the flag said.

## Decision
`CompiledRule.enforcedRules(policy)` is the one place a policy's rules are compiled for
evaluation, and it returns none for a policy with `enabled: false`. The subject cache, the
team-of-the-resource path and the permissions listing all go through it. A disabled policy
neither allows nor denies anything; it stays attached to its roles and teams.

## Consequences
Disabling a deny policy lifts its denials as well as its grants. The permission debugger still
lists a disabled policy's rules for inspection, but its evaluation steps skip them.

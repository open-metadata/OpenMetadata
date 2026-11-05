# Seeded policies are not rewritten on startup

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `CollectionRegistryTest.startupDoesNotRewriteSeededPolicies`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`CollectionRegistry` calls `upgrade()` on every resource at each start. `PolicyResource.upgrade()`,
written for 1.2.0, set the operations of `OrganizationPolicy-Owner-Rule` back to `All` whenever
they differed, so an admin who narrowed that rule had the change undone on the next restart.

## Decision
`PolicyResource` has no `upgrade()`. A seeded policy is created when missing and never edited at
startup. A change to a stored seed policy ships as a versioned data migration that runs once, and
leaves a policy an admin changed as it is.

## Consequences
A deployment that narrowed `OrganizationPolicy-Owner-Rule` keeps its rule. Deployments that never
ran the 1.2.0 upgrade already carry `All`, which every release since then has enforced.

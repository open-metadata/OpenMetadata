# Seeded policies are not rewritten on startup

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `CollectionRegistryTest.startupDoesNotRewriteSeededPolicies`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`CollectionRegistry` calls `upgrade()` on every resource at each start, so whatever an `upgrade()`
writes is written again on every restart. A seeded policy is the admin's to change once it exists,
for example to narrow the operations of `OrganizationPolicy-Owner-Rule`. A one-time change to a
seed, such as the 1.2.0 change to that rule, belongs in a data migration that runs once.

## Decision
`PolicyResource` has no `upgrade()`. A seeded policy is created when missing and never edited at
startup. A change to a stored seed policy ships as a versioned data migration that runs once, and
leaves a policy an admin changed as it is.

## Consequences
A deployment that narrowed `OrganizationPolicy-Owner-Rule` keeps its rule. Deployments that never
ran the 1.2.0 upgrade already carry `All`, which every release since then has enforced.

# DomainOnlyAccessRole cannot change administration resources

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `DomainIsolationIT.test_domainOnlyUser_cannotChangeAdministrationResources`,
  `DomainOnlyAccessPolicySqlMigrationTest`
- **Related:** ADR:2026-10-21-only-admins-change-a-users-domains,
  ADR:2026-10-30-only-admins-add-roles-or-policies-to-a-team

## Context
`DomainOnlyAccessPolicy` lets domain-only users work inside their domains and on assets in no
domain (`hasDomain()` is true for both). Administration resources are managed outside a domain
restriction: policies, roles, bots and apps act beyond the domain they are placed in, and teams and
users in no domain belong to no domain.

## Decision
- The allow and deny rules are unchanged. Two rules are added:
  - `Create`, `Delete`, `EditAll` (every edit) and `Deploy` are denied on `policy`, `role`, `bot` and
    `app`, whatever their domain: these control access beyond the domain they are placed in.
    Triggering an app as configured (e.g. AutoPilot for a service) stays allowed; changing its
    configuration while triggering needs `EditAll`.
  - `Create`, `Delete` and `EditAll` are denied on `team` and `user` when the resource is in no
    domain or is a bot user (`noDomain() || isBotUser()`).
  System settings are admin-only already.
- The 2.1.0 migration appends each rule to every stored `DomainOnlyAccessPolicy` that lacks it,
  customised ones included: a deny only removes access to these resources.

## Consequences
Domain-only users keep full access inside their domains and to assets in no domain, and keep reading
everything they could read. Changing a policy, role, app or bot in any domain, or a team or user in
no domain, now needs another role, and a deny rule wins over it, so such a user cannot
administer these through another role either. A domain-only user who has no domain can no longer edit
their own profile. Search filtering is unaffected, as the rules cover no view operation. Add a
resource type to these rules if it controls access.

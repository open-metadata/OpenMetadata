# DomainOnlyAccessRole cannot change administration resources that are in no domain

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `DomainIsolationIT.test_domainOnlyUser_cannotChangeAdministrationResourcesInNoDomain`,
  `DomainOnlyAccessPolicySqlMigrationTest`
- **Related:** ADR:2026-10-21-only-admins-change-a-users-domains,
  ADR:2026-10-30-only-admins-add-roles-or-policies-to-a-team

## Context
`hasDomain()` is true for a resource that has no domain, and `DomainOnlyAccessPolicy` allows every
operation when it is. That is intended for assets in no domain, which domain-only users keep
working on. It also covered policies, roles, teams, users, bots and apps, which have no domain and
control access, so the role reached further than a domain restriction should.

## Decision
- The allow and deny rules are unchanged. A third rule denies `Create`, `Delete`, `EditAll` (every
  edit), `Trigger` and `Deploy` on `policy`, `role`, `team`, `user`, `bot` and `app` when the resource
  is in no domain or is a bot (`noDomain() || isBotUser()`). These are the resources that grant access
  or hold credentials: an app runs as its bot, and a bot is included even inside the user's domain,
  since its own roles can reach further. System settings are admin-only already.
- The 2.1.0 migration appends the rule to every stored `DomainOnlyAccessPolicy` that lacks it,
  customised ones included: a deny only removes access to these resources.

## Consequences
Domain-only users keep full access inside their domains and to assets in no domain, and keep reading
everything they could read. Changing a policy, role, app, domain-less team, domain-less user or any
bot, or running an app, now needs another role, and a deny rule wins over it, so such a user cannot
administer these through another role either. A domain-only user who has no domain can no longer edit
their own profile. Search filtering is unaffected, as the rule covers no view operation. Add a
resource type to the rule if it grants access or credentials and has no domain.

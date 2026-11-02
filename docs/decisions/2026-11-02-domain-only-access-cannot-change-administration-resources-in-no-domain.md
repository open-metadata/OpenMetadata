# DomainOnlyAccessRole cannot change administration resources that are in no domain

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `DomainIsolationIT.test_domainOnlyUser_cannotChangeAdministrationResourcesInNoDomain`,
  `DomainOnlyAccessPolicySqlMigrationTest`
- **Related:** ADR:2026-10-21-only-admins-change-a-users-domains,
  ADR:2026-10-30-only-admins-add-roles-or-policies-to-a-team

## Context
`DomainOnlyAccessPolicy` lets domain-only users work inside their domains and on assets in no
domain (`hasDomain()` is true for both). Administration resources such as policies, roles, teams,
users, bots and apps are in no domain as well, and are managed outside a domain restriction.

## Decision
- The allow and deny rules are unchanged. A third rule denies `Create`, `Delete`, `EditAll` (every
  edit), `Trigger` and `Deploy` on `policy`, `role`, `team`, `user`, `bot` and `app` when the resource
  is in no domain or is a bot (`noDomain() || isBotUser()`). These are the resources that control
  access; an app runs as its bot, and bots are covered in any domain. System settings are admin-only
  already.
- The 2.1.0 migration appends the rule to every stored `DomainOnlyAccessPolicy` that lacks it,
  customised ones included: a deny only removes access to these resources.

## Consequences
Domain-only users keep full access inside their domains and to assets in no domain, and keep reading
everything they could read. Changing a policy, role, app, domain-less team, domain-less user or any
bot, or running an app, now needs another role, and a deny rule wins over it, so such a user cannot
administer these through another role either. A domain-only user who has no domain can no longer edit
their own profile. Search filtering is unaffected, as the rule covers no view operation. Add a
resource type to the rule if it controls access and has no domain.

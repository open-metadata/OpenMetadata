# DomainOnlyAccessRole grants full access only inside the user's domains

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `DomainIsolationIT.test_domainOnlyUser_cannotEditPoliciesOrMintBotTokens`
- **Related:** ADR:2026-10-21-only-admins-change-a-users-domains,
  ADR:2026-10-30-only-admins-add-roles-or-policies-to-a-team

## Context
`hasDomain()` is true for a resource that has no domain, so the deny rule of
`DomainOnlyAccessPolicy` never hides domain-less resources. Its allow rule used the same condition
for every operation, so a user confined by the role could edit any policy (including the one
confining them) and mint a token for any bot, since policies and bots are in no domain.

## Decision
- The policy grants every operation on resources in one of the user's domains and on listings or
  bulk requests, which are filtered per item (`inUserDomains()`, a new function), and only
  `ViewAll` on a single resource in no domain (`hasDomain()`). The deny rule is unchanged.
- The 2.1.0 migration rewrites the stored policy only while its rules are still the shipped ones; a
  customised policy is left as it is.

## Consequences
Users and bots that hold only this role keep reading and listing what they could before, and keep
full access inside their domains. Changing anything in no domain (policies, roles, bots, settings,
domain-less assets) now needs another role that grants it. An install that customised this policy
keeps its own rules and must apply the same split itself.

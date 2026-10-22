# A domain move is authorized once, where the write is built, for each domain it adds

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `DomainReassignmentAuthorizationIT`; `DomainMoveApprovalAuthorizationIT`;
  `EntityRepositoryMoveTargetsTest`; `DefaultAuthorizerTest`
- **Related:** #33420, #35455, PR #33471

## Context
A policy such as "allow EditAll when `hasDomain()`" lets a user edit the assets of the domains they
hold. Moving an asset into another domain must also be checked against the domain it enters, or
the user can push assets into domains they do not hold (#33420). PR #33471 added that check in four
`EntityResource` handlers, each working out the new domains on its own. Bulk PUT, CSV import, test
case PATCH and writes held for approval never reached those handlers.

`hasDomain()` passes when any of the resource's domains matches. Checked against the whole new
list, a user holding A could set an asset to [A, B]. Teams accept several domains whatever the
entity rules say, and every member inherits them.

## Decision
- `EntityRepository` authorizes `EditDomains` on a domain move when the updated entity is built,
  before it is stored or held for approval (`admit`, the bulk PUT loop, the CSV batch). Every write
  passes there: PATCH, PUT, bulk PUT, CSV rows and batches, Assets tab edits and their previews. A
  resource handler does not check the move itself.
- The check reads the domains the write leaves from the rule the updater stores them by
  (`writtenDomains`), so the checked domains are the stored ones.
- Each domain the write adds, one not among the entity's own stored domains, is authorized on its
  own: the entity as if it sat in that domain alone. A write that only removes domains is
  authorized against the domains it leaves. A write that keeps them is not checked. Reads keep
  "any domain matches".
- The author the write records is authorized (`Authorizer.authorizeActor`), with the bot that
  impersonated them. Not checked: system writes (the `admin` author, governance rollback) and
  entities that take their domains from another entity on every write (tasks). A user's write with
  no authorizer registered is refused.
- A CSV dry run runs the same check as the import, so it reports the rows the import refuses.

## Consequences
- A new write path is covered when it goes through the repository's write pipeline. A path that
  stores domains around it must call the same check.
- An `Authorizer` implementation must implement `authorizeActor`.
- A refusal names the domain that was refused.
- Clearing a domain is checked against the empty list, not against the domain the entity then
  inherits (#35856).
- Cost: one cached entity read per write that changes domains, and one policy evaluation per added
  domain.

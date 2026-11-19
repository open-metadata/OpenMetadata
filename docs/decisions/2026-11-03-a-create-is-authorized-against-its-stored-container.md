# A create is authorized against its stored container

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `RuleEvaluatorTest.test_hasDomain_onCreate_needsTheContainersDomainAndEveryRequestedDomain`,
  `DomainIsolationIT` (create, tag create and PUT cases), `TagResourceIT.post_tagWithParentFromAnotherClassification_rejected`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`CreateResourceContext.getDomains()` merged the domains named in the request with those of the
stored parent, and `hasDomain()` passes on one match, so naming one's own domain unlocked a create
inside another domain's container. A tag's classification arrived as a name-only reference, which
the context skipped, so the tag was authorized as if it had no parent. A PUT authorized on a
context that could not see a soft-deleted entity, although the write restores it.

## Decision
- On create, `hasDomain()` needs a domain of the container (the stored parents; a parent domain is
  its own) and every domain the request names. `getDomains()` keeps returning the union for the
  other conditions.
- A root parent reference without an id is loaded by name; one that cannot be loaded fails the
  request instead of being skipped. `TagMapper` resolves the classification by name.
- A tag's parent must belong to the tag's classification.
- A PUT context loads the entity with `Include.ALL`, the include the write uses. PATCH keeps
  `NON_DELETED`.

## Consequences
A domain-confined user creates only inside their domains and can label a new entity only with
their own domains. Creating a sub-domain or data product needs the parent domain. A PUT that
would restore a soft-deleted entity is decided on that entity's tags, owners and domains.

# A create is authorized against its stored container

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `RuleEvaluatorTest.test_hasDomain_onCreate_needsTheContainersDomainAndEveryRequestedDomain`,
  `DomainIsolationIT` (create, tag create and PUT cases), `TagResourceIT.post_tagWithParentFromAnotherClassification_rejected`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Domain conditions confine a caller's creates to containers of its domains. A create is decided
before the entity exists, on what the request names: its parents and the domains it asks for.
Since `hasDomain()` passes on a single match, the two are checked separately. A parent can arrive
as a name-only reference, as a tag's classification does, and a PUT can restore a soft-deleted
entity, so the context resolves the entities the write will actually touch.

## Decision
- On create, `hasDomain()` needs a domain of the container (the stored parents; a parent domain is
  its own) and every domain the request names. `getDomains()` keeps returning the union for the
  other conditions.
- A root parent reference without an id is loaded by name; one that cannot be loaded fails the
  request. `TagMapper` resolves the classification by name.
- A tag's parent must belong to the tag's classification.
- A PUT context loads the entity with `Include.ALL`, the include the write uses. PATCH keeps
  `NON_DELETED`.

## Consequences
A domain-confined user creates only inside their domains and can label a new entity only with
their own domains. Creating a sub-domain or data product needs the parent domain. A PUT that
would restore a soft-deleted entity is decided on that entity's tags, owners and domains.

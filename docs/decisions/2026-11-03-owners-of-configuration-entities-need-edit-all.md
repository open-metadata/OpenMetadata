# Setting the owners of a configuration entity needs EditAll

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-04 (test definitions and AI governance types
  join the list; EditOwners still applies)
- **Deciders:** Mohit Yadav
- **Guard:** `JsonPatchUtilsTest.ownersOfConfigurationEntitiesNeedEditAll`,
  `PolicyEnforcementIT.ownersOfConfigurationEntitiesCannotBeClaimedThroughTheNoOwnerRule`,
  `TestDefinitionOwnershipIT.anUnownedTestDefinitionCannotBeClaimedWithoutEditAll`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Setting an entity's owners is the `EditOwners` operation. `OrganizationPolicy` gives every user
`EditOwners` on an entity without owners, so a user can take ownership of an unowned data asset,
and gives its owner `All`. On some types the owner administers configuration: a policy's rules, a
team's default roles, a service's connection. Owning such an entity amounts to `All` over that
configuration, so setting its owners is a configuration change.

## Decision
- On these types, setting `owners` requests `EditAll` together with `EditOwners`: an allow needs
  `EditAll`, and a rule on `EditOwners`, allow or deny, still applies. The types are policy, team,
  app, app marketplace definition, automation workflow, workflow definition, event subscription,
  ingestion pipeline, test connection definition, test definition (v2), classification, AI
  governance policy, AI governance framework and AI framework control (v2), and every service type
  (`Entity.getServiceEntityTypes()`). An extension registers its own such types with
  `ResourceRegistry.registerOwnersRequireEditAll(type)`.
- The permissions response reports `EditOwners` on these types as allowed only as far as `EditAll`
  is.
- Ownership tasks on these types check `EditOwners` on its own as well as `EditAll`, and owner
  suggestions read the same mapping. Data assets keep `EditOwners`.

## Consequences
Users who hold only `EditOwners`, such as Data Stewards, cannot set owners on those types; admins
and existing owners can. Owners set before the change stay. The UI does not offer an owner edit on
these types that the server would refuse. A new configuration-like entity type has to be added to
the list, or registered by the extension that defines it.

## Amendment (v2, 2026-11-04)
- Test definitions join the list. A user-provided definition's `sqlExpression` is stored as its
  owner writes it, and every data quality run of a test on that definition renders and executes it
  on the service connection, so a definition's owner decides what runs with that connection's
  credentials.
- AI governance policies, frameworks and framework controls join the list as configuration too.
- Owner writes on these types request `EditOwners` beside `EditAll`, so a rule written for
  `EditOwners` keeps applying, and the permissions response follows `EditAll`. Extensions register
  their own types through `ResourceRegistry.registerOwnersRequireEditAll`.

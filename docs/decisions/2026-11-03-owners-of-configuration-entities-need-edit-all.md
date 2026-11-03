# Setting the owners of a configuration entity needs EditAll

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `JsonPatchUtilsTest.ownersOfConfigurationEntitiesNeedEditAll`,
  `PolicyEnforcementIT.ownersOfConfigurationEntitiesCannotBeClaimedThroughTheNoOwnerRule`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
A PATCH of `/owners` is authorized as `EditOwners` on every entity type. `OrganizationPolicy` gives
every user `EditOwners` on an ownerless entity, so they can claim unowned data assets, and `All`
to an owner. On entities whose owner administers configuration, that claim is a grant of `All`
over configuration.

## Decision
`ResourceRegistry` maps `owners` to `EditAll` for: policy, team, app, app marketplace definition,
automation workflow, workflow definition, event subscription, ingestion pipeline, test connection
definition, classification, and every service type (`Entity.getServiceEntityTypes()`). Ownership
tasks and owner suggestions read the same mapping. Data assets keep `EditOwners`.

## Consequences
Users who hold only `EditOwners`, such as Data Stewards, can no longer set owners on those types;
admins and existing owners can. Owners set before the change stay. The permissions endpoint still
reports `EditOwners` for these types, so the UI may offer an owner edit that the server refuses.
A new configuration-like entity type has to be added to the list.

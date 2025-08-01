/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static java.lang.Boolean.FALSE;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.POLICIES;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.teams.RoleResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class RoleRepository extends EntityRepository<Role> {
  public static final String DOMAIN_ONLY_ACCESS_ROLE = "DomainOnlyAccessRole";
  public static final String DEFAULT_BOT_ROLE = "DefaultBotRole";

  public RoleRepository() {
    super(
        RoleResource.COLLECTION_PATH,
        Entity.ROLE,
        Role.class,
        Entity.getCollectionDAO().roleDAO(),
        POLICIES,
        POLICIES);
  }

  @Override
  public void setFields(Role role, Fields fields) {
    role.setPolicies(fields.contains(POLICIES) ? getPolicies(role) : role.getPolicies());
    role.setTeams(fields.contains("teams") ? getTeams(role) : role.getTeams());
    role.withUsers(fields.contains("users") ? getUsers(role) : role.getUsers());
  }

  @Override
  public void clearFields(Role role, Fields fields) {
    role.setPolicies(fields.contains(POLICIES) ? role.getPolicies() : null);
    role.setTeams(fields.contains("teams") ? role.getTeams() : null);
    role.withUsers(fields.contains("users") ? role.getUsers() : null);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Role> roles) {
    if (roles == null || roles.isEmpty()) {
      return;
    }

    if (fields.contains(POLICIES)) {
      fetchAndSetPolicies(roles);
    }

    if (fields.contains("teams")) {
      fetchAndSetTeams(roles);
    }

    if (fields.contains("users")) {
      fetchAndSetUsers(roles);
    }

    // Handle standard fields that are managed by the parent class
    super.setFieldsInBulk(fields, roles);
  }

  private void fetchAndSetPolicies(List<Role> roles) {
    List<String> roleIds = roles.stream().map(Role::getId).map(UUID::toString).distinct().toList();

    // Bulk fetch policies for all roles
    List<CollectionDAO.EntityRelationshipObject> policyRecords =
        daoCollection
            .relationshipDAO()
            .findToBatch(roleIds, Relationship.HAS.ordinal(), Entity.ROLE, Entity.POLICY);

    // Create a map of role ID to policy references
    Map<UUID, List<EntityReference>> roleToPolicies = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : policyRecords) {
      UUID roleId = UUID.fromString(record.getFromId());
      EntityReference policyRef =
          Entity.getEntityReferenceById(
              Entity.POLICY, UUID.fromString(record.getToId()), Include.ALL);
      roleToPolicies.computeIfAbsent(roleId, k -> new ArrayList<>()).add(policyRef);
    }

    // Set policies on roles
    for (Role role : roles) {
      List<EntityReference> policies = roleToPolicies.get(role.getId());
      role.setPolicies(policies != null ? policies : new ArrayList<>());
    }
  }

  private void fetchAndSetTeams(List<Role> roles) {
    List<String> roleIds = roles.stream().map(Role::getId).map(UUID::toString).distinct().toList();

    // Bulk fetch teams for all roles
    List<CollectionDAO.EntityRelationshipObject> teamRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(roleIds, Relationship.HAS.ordinal(), Entity.ROLE, Entity.TEAM);

    // Create a map of role ID to team references
    Map<UUID, List<EntityReference>> roleToTeams = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : teamRecords) {
      UUID roleId = UUID.fromString(record.getFromId());
      EntityReference teamRef =
          Entity.getEntityReferenceById(
              Entity.TEAM, UUID.fromString(record.getToId()), Include.ALL);
      roleToTeams.computeIfAbsent(roleId, k -> new ArrayList<>()).add(teamRef);
    }

    // Set teams on roles
    for (Role role : roles) {
      List<EntityReference> teams = roleToTeams.get(role.getId());
      role.setTeams(teams != null ? teams : new ArrayList<>());
    }
  }

  private void fetchAndSetUsers(List<Role> roles) {
    List<String> roleIds = roles.stream().map(Role::getId).map(UUID::toString).distinct().toList();

    // Bulk fetch users for all roles
    List<CollectionDAO.EntityRelationshipObject> userRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(roleIds, Relationship.HAS.ordinal(), Entity.ROLE, Entity.USER);

    // Create a map of role ID to user references
    Map<UUID, List<EntityReference>> roleToUsers = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : userRecords) {
      UUID roleId = UUID.fromString(record.getFromId());
      EntityReference userRef =
          Entity.getEntityReferenceById(
              Entity.USER, UUID.fromString(record.getToId()), Include.ALL);
      roleToUsers.computeIfAbsent(roleId, k -> new ArrayList<>()).add(userRef);
    }

    // Set users on roles
    for (Role role : roles) {
      List<EntityReference> users = roleToUsers.get(role.getId());
      role.withUsers(users != null ? users : new ArrayList<>());
    }
  }

  private List<EntityReference> getPolicies(@NonNull Role role) {
    return findTo(role.getId(), Entity.ROLE, Relationship.HAS, Entity.POLICY);
  }

  private List<EntityReference> getUsers(@NonNull Role role) {
    return findFrom(role.getId(), Entity.ROLE, Relationship.HAS, Entity.USER);
  }

  private List<EntityReference> getTeams(@NonNull Role role) {
    return findFrom(role.getId(), Entity.ROLE, Relationship.HAS, Entity.TEAM);
  }

  /**
   * If policy does not exist for this role, create a new entity reference. The actual policy gets created within the
   * storeEntity method call.
   */
  @Override
  public void prepare(Role role, boolean update) {
    if (listOrEmpty(role.getPolicies()).isEmpty()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.EMPTY_POLICIES_IN_ROLE);
    }
    EntityUtil.populateEntityReferences(role.getPolicies());
  }

  /**
   * For regular incoming POST, PUT, PATCH operation calls, {@link RoleRepository#prepare(Role, boolean)} would create a
   * policy entity reference if it does not exist.
   *
   * <p>This method ensures that the role and its policy are stored correctly.
   */
  @Override
  public void storeEntity(Role role, boolean update) {
    // Don't store policy. Build it on the fly based on relationships
    List<EntityReference> policies = role.getPolicies();
    role.withPolicies(null);
    store(role, update);
    role.withPolicies(policies);
  }

  @Override
  public void storeRelationships(Role role) {
    for (EntityReference policy : listOrEmpty(role.getPolicies())) {
      addRelationship(role.getId(), policy.getId(), Entity.ROLE, Entity.POLICY, Relationship.HAS);
    }
  }

  @Override
  public EntityRepository<Role>.EntityUpdater getUpdater(
      Role original, Role updated, Operation operation, ChangeSource changeSource) {
    return new RoleUpdater(original, updated, operation);
  }

  @Override
  protected void preDelete(Role entity, String deletedBy) {
    if (FALSE.equals(entity.getAllowDelete())) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(entity.getName(), Entity.ROLE));
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class RoleUpdater extends EntityUpdater {
    public RoleUpdater(Role original, Role updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updatePolicies(listOrEmpty(original.getPolicies()), listOrEmpty(updated.getPolicies()));
    }

    private void updatePolicies(
        List<EntityReference> origPolicies, List<EntityReference> updatedPolicies) {
      // Record change description
      List<EntityReference> deletedPolicies = new ArrayList<>();
      List<EntityReference> addedPolicies = new ArrayList<>();
      boolean changed =
          recordListChange(
              "policies",
              origPolicies,
              updatedPolicies,
              addedPolicies,
              deletedPolicies,
              entityReferenceMatch);

      if (changed) {
        // Remove all the Role to policy relationships
        deleteFrom(original.getId(), Entity.ROLE, Relationship.HAS, Entity.POLICY);

        // Add Role to policy relationships back based on Updated entity
        storeRelationships(updated);
      }
    }
  }
}

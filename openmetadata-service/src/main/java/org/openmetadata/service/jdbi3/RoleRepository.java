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
import java.util.Set;
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
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.teams.RoleResource;
import org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository()
public class RoleRepository implements EntityPolicy<Role> {

  public static final String DOMAIN_ONLY_ACCESS_ROLE = "DomainOnlyAccessRole";

  public static final String DEFAULT_BOT_ROLE = "DefaultBotRole";

  public RoleRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                RoleResource.COLLECTION_PATH,
                Entity.ROLE,
                Role.class,
                Entity.getCollectionDAO().roleDAO()),
            new EntityPolicyContext.WriteFields(POLICIES, POLICIES, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
  }

  @Override
  public void setFields(Role role, Fields fields, RelationIncludes relationIncludes) {
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
    EntityPolicy.super.setFieldsInBulk(fields, roles);
  }

  private void fetchAndSetPolicies(List<Role> roles) {
    List<String> roleIds = roles.stream().map(Role::getId).map(UUID::toString).distinct().toList();
    // Bulk fetch policies for all roles
    List<CollectionDAO.EntityRelationshipObject> policyRecords =
        context()
            .dependencies()
            .daos()
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
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(roleIds, Relationship.HAS.ordinal(), Entity.TEAM, Entity.ROLE);

    // Create a map of role ID to team references
    Map<UUID, List<EntityReference>> roleToTeams = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : teamRecords) {
      UUID roleId = UUID.fromString(record.getToId());
      EntityReference teamRef =
          Entity.getEntityReferenceById(
              Entity.TEAM, UUID.fromString(record.getFromId()), Include.ALL);
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
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(roleIds, Relationship.HAS.ordinal(), Entity.USER, Entity.ROLE);

    // Create a map of role ID to user references
    Map<UUID, List<EntityReference>> roleToUsers = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : userRecords) {
      UUID roleId = UUID.fromString(record.getToId());
      EntityReference userRef =
          Entity.getEntityReferenceById(
              Entity.USER, UUID.fromString(record.getFromId()), Include.ALL);
      roleToUsers.computeIfAbsent(roleId, k -> new ArrayList<>()).add(userRef);
    }
    // Set users on roles
    for (Role role : roles) {
      List<EntityReference> users = roleToUsers.get(role.getId());
      role.withUsers(users != null ? users : new ArrayList<>());
    }
  }

  private List<EntityReference> getPolicies(@NonNull Role role) {
    return relationships()
        .to(
            new EntityRelationshipReader.Selection(
                role.getId(), Entity.ROLE, Relationship.HAS, Entity.POLICY),
            Include.NON_DELETED);
  }

  private List<EntityReference> getUsers(@NonNull Role role) {
    return relationships()
        .from(
            new EntityRelationshipReader.Selection(
                role.getId(), Entity.ROLE, Relationship.HAS, Entity.USER),
            Include.NON_DELETED);
  }

  private List<EntityReference> getTeams(@NonNull Role role) {
    return relationships()
        .from(
            new EntityRelationshipReader.Selection(
                role.getId(), Entity.ROLE, Relationship.HAS, Entity.TEAM),
            Include.NON_DELETED);
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
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("policies");
  }

  @Override
  public void storeEntity(Role role, boolean update) {
    persistence().store(role, update);
  }

  @Override
  public void storeEntities(List<Role> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Role> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Role::getId).toList();
    deleteFromMany(ids, Entity.ROLE, Relationship.HAS, Entity.POLICY);
  }

  @Override
  public void storeRelationships(Role role) {
    for (EntityReference policy : listOrEmpty(role.getPolicies())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  role.getId(), policy.getId(), Entity.ROLE, Entity.POLICY, Relationship.HAS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public EntityUpdater<Role> getUpdater(
      Role original, Role updated, EntityOperation operation, ChangeSource changeSource) {
    return new RoleUpdater(original, updated, operation).mutation();
  }

  @Override
  public void preDelete(Role entity, String deletedBy) {
    if (FALSE.equals(entity.getAllowDelete())) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(entity.getName(), Entity.ROLE));
    }
  }

  @Override
  public void postDelete(Role entity, boolean hardDelete) {
    EntityPolicy.super.postDelete(entity, hardDelete);
    PolicyConditionUpdater.updateAllPolicyConditions(
        condition ->
            PolicyConditionUpdater.removeFromCondition(
                condition, entity.getName(), PolicyConditionUpdater.ROLE_FUNCTIONS));
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class RoleUpdater implements EntitySpecificMutation<Role> {

    public RoleUpdater(Role original, Role updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Role> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "policies",
          () -> {
            updatePolicies(
                listOrEmpty(entityUpdate.getOriginal().getPolicies()),
                listOrEmpty(entityUpdate.getUpdated().getPolicies()));
            SubjectCache.invalidateAll();
          });
    }

    private void updatePolicies(
        List<EntityReference> origPolicies, List<EntityReference> updatedPolicies) {
      // Record change description
      List<EntityReference> deletedPolicies = new ArrayList<>();
      List<EntityReference> addedPolicies = new ArrayList<>();
      boolean changed =
          entityUpdate.recordListChange(
              "policies",
              origPolicies,
              updatedPolicies,
              addedPolicies,
              deletedPolicies,
              entityReferenceMatch);
      if (changed) {
        // Remove all the Role to policy relationships
        relationshipWrites()
            .deleteOutgoing(
                new EntityRelationshipWriter.Selection(
                    entityUpdate.getOriginal().getId(),
                    Entity.ROLE,
                    Relationship.HAS,
                    Entity.POLICY));
        // Add Role to policy relationships back based on Updated entity
        storeRelationships(entityUpdate.getUpdated());
      }
    }

    private final EntityUpdater<Role> entityUpdate;

    public EntityUpdater<Role> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Role> entityContext;

  @Override
  public final EntityPolicyContext<Role> context() {
    return entityContext;
  }
}

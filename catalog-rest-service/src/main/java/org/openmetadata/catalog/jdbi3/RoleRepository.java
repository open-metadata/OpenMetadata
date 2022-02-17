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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.util.EntityUtil.toBoolean;

import java.io.IOException;
import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.teams.RoleResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;

@Slf4j
public class RoleRepository extends EntityRepository<Role> {
  static final Fields ROLE_UPDATE_FIELDS = new Fields(RoleResource.FIELD_LIST, null);
  static final Fields ROLE_PATCH_FIELDS = new Fields(RoleResource.FIELD_LIST, null);

  public RoleRepository(CollectionDAO dao) {
    super(
        RoleResource.COLLECTION_PATH,
        Entity.ROLE,
        Role.class,
        dao.roleDAO(),
        dao,
        ROLE_PATCH_FIELDS,
        ROLE_UPDATE_FIELDS,
        false,
        false,
        false);
  }

  @Override
  public Role setFields(Role role, Fields fields) throws IOException {
    role.setPolicy(fields.contains("policy") ? getPolicyForRole(role) : null);
    role.setUsers(fields.contains("users") ? getUsersForRole(role) : null);
    return role;
  }

  private EntityReference getPolicyForRole(@NonNull Role role) throws IOException {
    List<String> result =
        findTo(role.getId(), Entity.ROLE, Relationship.CONTAINS, Entity.POLICY, toBoolean(toInclude(role)));
    if (result.size() != 1) {
      LOG.warn(
          "A role must have exactly one policy that is applicable to the role. Got {} policies for role {}",
          result.size(),
          role.getName());
      return null;
    }
    return Entity.getEntityReference(Entity.POLICY, UUID.fromString(result.get(0)));
  }

  private List<EntityReference> getUsersForRole(@NonNull Role role) {
    List<EntityReference> entityReferences =
        daoCollection
            .relationshipDAO()
            .findFromEntity(
                role.getId().toString(),
                Entity.ROLE,
                Relationship.HAS.ordinal(),
                Entity.USER,
                toBoolean(toInclude(role)));
    return Optional.ofNullable(entityReferences).orElse(Collections.emptyList()).stream()
        .map(
            ref -> {
              try {
                return Entity.getEntityReference(Entity.USER, ref.getId());
              } catch (IOException e) {
                LOG.warn("Could not get entity reference for user {}", ref.getId());
              }
              return ref;
            })
        .collect(Collectors.toList());
  }

  @Override
  public void restorePatchAttributes(Role original, Role updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withName(original.getName()).withId(original.getId());
  }

  @Override
  public EntityInterface<Role> getEntityInterface(Role entity) {
    return new RoleEntityInterface(entity);
  }

  /**
   * If policy does not exist for this role, create a new entity reference. The actual policy gets created within the
   * storeEntity method call.
   */
  @Override
  public void prepare(Role role) throws IOException {
    if (role.getPolicy() != null) {
      return;
    }
    // Set up new entity reference for the role's policy.
    role.setPolicy(
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.POLICY)
            .withName(String.format("%sRoleAccessControlPolicy", role.getName()))
            .withDisplayName(String.format("%s Role Access Control Policy", role.getDisplayName()))
            .withDescription(
                String.format("Policy for %s Role to perform operations on metadata entities", role.getDisplayName())));
  }

  /**
   * For regular incoming POST, PUT, PATCH operation calls, {@link RoleRepository#prepare(Role)} would create a policy
   * entity reference if it does not exist.
   *
   * <p>This method ensures that the role and its policy are stored correctly.
   */
  @Override
  @Transaction
  public void storeEntity(Role role, boolean update) throws IOException {
    EntityReference policyRef = role.getPolicy();
    if (policyRef != null) {
      try {
        policyRef = Entity.getEntityReferenceByName(Entity.POLICY, policyRef.getName());
      } catch (EntityNotFoundException e) {
        // If policy does not exist for this role, create one.
        Policy policy =
            new Policy()
                .withId(policyRef.getId())
                .withName(policyRef.getName())
                .withDisplayName(policyRef.getDisplayName())
                .withDescription(policyRef.getDescription())
                .withPolicyType(PolicyType.AccessControl)
                .withRules(Collections.emptyList())
                .withEnabled(true)
                .withDeleted(false)
                .withUpdatedAt(role.getUpdatedAt())
                .withUpdatedBy(role.getUpdatedBy());
        Entity.getEntityRepository(Entity.POLICY).storeEntity(policy, update);
      }
    }

    // Don't store policy and href as JSON. Build it on the fly based on relationships
    role.withPolicy(null).withHref(null);
    store(role.getId(), role, update);

    // Restore the relationships
    role.withPolicy(policyRef);
  }

  @Override
  public void storeRelationships(Role role) {
    addRelationship(role.getId(), role.getPolicy().getId(), Entity.ROLE, Entity.POLICY, Relationship.CONTAINS);
  }

  @Override
  public EntityUpdater getUpdater(Role original, Role updated, Operation operation) {
    return new RoleUpdater(original, updated, operation);
  }

  public static class RoleEntityInterface implements EntityInterface<Role> {
    private final Role entity;

    public RoleEntityInterface(Role entity) {
      this.entity = entity;
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getName();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.ROLE)
          .withHref(getHref());
    }

    @Override
    public Role getEntity() {
      return entity;
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Role withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class RoleUpdater extends EntityUpdater {
    public RoleUpdater(Role original, Role updated, Operation operation) {
      super(original, updated, operation);
    }
  }
}

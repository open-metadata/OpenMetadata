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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.teams.RoleResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class RoleRepository extends EntityRepository<Role> {
  public RoleRepository(CollectionDAO dao) {
    super(RoleResource.COLLECTION_PATH, Entity.ROLE, Role.class, dao.roleDAO(), dao, POLICIES, POLICIES);
  }

  @Override
  public Role setFields(Role role, Fields fields) throws IOException {
    role.setPolicies(fields.contains(POLICIES) ? getPolicies(role) : null);
    role.setTeams(fields.contains("teams") ? getTeams(role) : null);
    return role.withUsers(fields.contains("users") ? getUsers(role) : null);
  }

  private List<EntityReference> getPolicies(@NonNull Role role) throws IOException {
    List<EntityRelationshipRecord> result = findTo(role.getId(), Entity.ROLE, Relationship.HAS, Entity.POLICY);
    return EntityUtil.populateEntityReferences(result, Entity.POLICY);
  }

  private List<EntityReference> getUsers(@NonNull Role role) throws IOException {
    List<EntityRelationshipRecord> records = findFrom(role.getId(), Entity.ROLE, Relationship.HAS, Entity.USER);
    return EntityUtil.populateEntityReferences(records, Entity.USER);
  }

  private List<EntityReference> getTeams(@NonNull Role role) throws IOException {
    List<EntityRelationshipRecord> records = findFrom(role.getId(), Entity.ROLE, Relationship.HAS, Entity.TEAM);
    return EntityUtil.populateEntityReferences(records, Entity.TEAM);
  }

  @Override
  public void restorePatchAttributes(Role original, Role updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withName(original.getName()).withId(original.getId());
  }

  /**
   * If policy does not exist for this role, create a new entity reference. The actual policy gets created within the
   * storeEntity method call.
   */
  @Override
  public void prepare(Role role) throws IOException {
    if (listOrEmpty(role.getPolicies()).isEmpty()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.EMPTY_POLICIES_IN_ROLE);
    }
    EntityUtil.populateEntityReferences(role.getPolicies());
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
    // Don't store policy and href as JSON. Build it on the fly based on relationships
    List<EntityReference> policies = role.getPolicies();
    role.withPolicies(null).withHref(null);
    store(role, update);
    role.withPolicies(policies); // Restore policies
  }

  @Override
  public void storeRelationships(Role role) {
    for (EntityReference policy : listOrEmpty(role.getPolicies())) {
      addRelationship(role.getId(), policy.getId(), Entity.ROLE, Entity.POLICY, Relationship.HAS);
    }
  }

  @Override
  public RoleUpdater getUpdater(Role original, Role updated, Operation operation) {
    return new RoleUpdater(original, updated, operation);
  }

  @Override
  protected void preDelete(Role entity) {
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

    @Override
    public void entitySpecificUpdate() throws IOException {
      updatePolicies(listOrEmpty(original.getPolicies()), listOrEmpty(updated.getPolicies()));
    }

    private void updatePolicies(List<EntityReference> origPolicies, List<EntityReference> updatedPolicies)
        throws JsonProcessingException {
      // Record change description
      List<EntityReference> deletedPolicies = new ArrayList<>();
      List<EntityReference> addedPolicies = new ArrayList<>();
      boolean changed =
          recordListChange(
              "policies", origPolicies, updatedPolicies, addedPolicies, deletedPolicies, entityReferenceMatch);

      if (changed) {
        // Remove all the Role to policy relationships
        deleteFrom(original.getId(), Entity.ROLE, Relationship.HAS, Entity.POLICY);

        // Add Role to policy relationships back based on Updated entity
        storeRelationships(updated);
      }
    }
  }
}

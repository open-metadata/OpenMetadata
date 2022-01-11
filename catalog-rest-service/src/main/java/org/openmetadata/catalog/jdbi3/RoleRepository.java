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

import java.io.IOException;
import java.net.URI;
import java.util.Date;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.teams.RoleResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;

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
    // Nothing to set.
    return role;
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

  @Override
  public void prepare(Role role) throws IOException {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(Role role, boolean update) throws IOException {
    // Don't store href as JSON. Build it on the fly based on relationships
    role.withHref(null);
    store(role.getId(), role, update);
  }

  @Override
  public void storeRelationships(Role role) {
    /* Nothing to do */
  }

  @Override
  public EntityUpdater getUpdater(Role original, Role updated, boolean patchOperation) {
    return new RoleUpdater(original, updated, patchOperation);
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
    public Date getUpdatedAt() {
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
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
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
    public RoleUpdater(Role original, Role updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // Update operation cannot undelete a role.
      if (updated.getEntity().getDeleted() != original.getEntity().getDeleted()) {
        throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("Role", "deleted"));
      }
    }
  }
}

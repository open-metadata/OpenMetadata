/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
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
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.resources.types.TypeResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class TypeRepository extends EntityRepository<Type> {
  // TODO fix this
  private static final String UPDATE_FIELDS = "";
  private static final String PATCH_FIELDS = "";

  public TypeRepository(CollectionDAO dao) {
    super(
        TypeResource.COLLECTION_PATH,
        Entity.TYPE,
        Type.class,
        dao.genericEntityDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
    allowEdits = true;
  }

  @Override
  public Type setFields(Type attribute, Fields fields) throws IOException {
    return attribute;
  }

  @Override
  public void prepare(Type type) throws IOException {
    type.setFullyQualifiedName(getEntityInterface(type).getFullyQualifiedName());
  }

  @Override
  public void storeEntity(Type type, boolean update) throws IOException {
    URI href = type.getHref();
    type.withHref(null);
    store(type.getId(), type, update);
    type.withHref(href);
  }

  @Override
  public void storeRelationships(Type type) {
    // Nothing to do
  }

  @Override
  public EntityInterface<Type> getEntityInterface(Type entity) {
    return new TypeEntityInterface(entity);
  }

  @Override
  public EntityUpdater getUpdater(Type original, Type updated, Operation operation) {
    return new AttributeUpdater(original, updated, operation);
  }

  public static class TypeEntityInterface extends EntityInterface<Type> {
    public TypeEntityInterface(Type entity) {
      super(Entity.TYPE, entity);
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
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return false;
    }

    @Override
    public EntityReference getOwner() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return FullyQualifiedName.build(entityType, entity.getNameSpace(), entity.getName());
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
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public Type getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return null;
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
    public void setName(String name) {
      entity.setName(name);
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
    public void setDeleted(boolean flag) {}

    @Override
    public Type withHref(URI href) {
      return entity.withHref(href);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class AttributeUpdater extends EntityUpdater {
    public AttributeUpdater(Type original, Type updated, Operation operation) {
      super(original, updated, operation);
    }
  }
}

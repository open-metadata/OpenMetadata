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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Triple;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.TypeRegistry;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.entity.type.Category;
import org.openmetadata.catalog.entity.type.CustomProperty;
import org.openmetadata.catalog.resources.types.TypeResource;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;

@Slf4j
public class TypeRepository extends EntityRepository<Type> {
  private static final String UPDATE_FIELDS = "customProperties";
  private static final String PATCH_FIELDS = "customProperties";

  public TypeRepository(CollectionDAO dao) {
    super(TypeResource.COLLECTION_PATH, Entity.TYPE, Type.class, dao.typeEntityDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
    allowEdits = true;
  }

  @Override
  public Type setFields(Type type, Fields fields) throws IOException {
    type.withCustomProperties(fields.contains("customProperties") ? getCustomProperties(type) : null);
    return type;
  }

  @Override
  public void prepare(Type type) {
    setFullyQualifiedName(type);
    TypeRegistry.instance().validateCustomProperties(type);
  }

  @Override
  public void storeEntity(Type type, boolean update) throws IOException {
    URI href = type.getHref();
    List<CustomProperty> customProperties = type.getCustomProperties();
    type.withHref(null).withCustomProperties(null);
    store(type.getId(), type, update);
    type.withHref(href).withCustomProperties(customProperties);
    updateTypeMap(type);
  }

  @Override
  public void storeRelationships(Type type) {
    // Nothing to do
  }

  private void updateTypeMap(Type entity) {
    // Add entity type name to type map - example "email" -> email property type or "table" -> table entity type
    TypeRegistry.instance().addType(entity);
  }

  @Override
  protected void postDelete(Type entity) {
    TypeRegistry.instance().removeType(entity.getName());
  }

  @Override
  protected void postUpdate(Type entity) {
    TypeRegistry.instance().addType(entity);
  }

  @Override
  public EntityUpdater getUpdater(Type original, Type updated, Operation operation) {
    return new TypeUpdater(original, updated, operation);
  }

  public PutResponse<Type> addCustomProperty(UriInfo uriInfo, String updatedBy, String id, CustomProperty property)
      throws IOException {
    Type type = dao.findEntityById(UUID.fromString(id), Include.NON_DELETED);
    property.setPropertyType(dao.findEntityReferenceById(property.getPropertyType().getId(), Include.NON_DELETED));
    if (type.getCategory().equals(Category.Field)) {
      throw new IllegalArgumentException("Property types can't be extended");
    }
    setFields(type, putFields);

    dao.findEntityById(property.getPropertyType().getId()); // Validate customProperty type exists
    type.getCustomProperties().add(property);
    type.setUpdatedBy(updatedBy);
    type.setUpdatedAt(System.currentTimeMillis());
    return createOrUpdate(uriInfo, type);
  }

  private List<CustomProperty> getCustomProperties(Type type) throws IOException {
    if (type.getCategory().equals(Category.Field)) {
      return null; // Property types don't support custom properties
    }
    List<CustomProperty> customProperties = new ArrayList<>();
    List<Triple<String, String, String>> results =
        daoCollection
            .fieldRelationshipDAO()
            .listToByPrefix(
                getCustomPropertyFQNPrefix(type.getName()), Entity.TYPE, Entity.TYPE, Relationship.HAS.ordinal());
    for (Triple<String, String, String> result : results) {
      CustomProperty property = JsonUtils.readValue(result.getRight(), CustomProperty.class);
      property.setPropertyType(dao.findEntityReferenceByName(result.getMiddle()));
      customProperties.add(property);
    }
    customProperties.sort(EntityUtil.compareCustomProperty);
    return customProperties;
  }

  /** Handles entity updated from PUT and POST operation. */
  public class TypeUpdater extends EntityUpdater {
    public TypeUpdater(Type original, Type updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateCustomProperties();
    }

    private void updateCustomProperties() throws JsonProcessingException {
      List<CustomProperty> updatedFields = listOrEmpty(updated.getCustomProperties());
      List<CustomProperty> origFields = listOrEmpty(original.getCustomProperties());
      List<CustomProperty> added = new ArrayList<>();
      List<CustomProperty> deleted = new ArrayList<>();
      recordListChange("customProperty", origFields, updatedFields, added, deleted, EntityUtil.customFieldMatch);
      for (CustomProperty property : added) {
        String customPropertyFQN = getCustomPropertyFQN(updated.getName(), property.getName());
        String customPropertyJson = JsonUtils.pojoToJson(property);
        LOG.info(
            "Adding customProperty {} with type {} to the entity {}",
            customPropertyFQN,
            property.getPropertyType().getName(),
            updated.getName());
        daoCollection
            .fieldRelationshipDAO()
            .insert(
                customPropertyFQN,
                property.getPropertyType().getName(),
                Entity.TYPE,
                Entity.TYPE,
                Relationship.HAS.ordinal(),
                customPropertyJson);
      }
      for (CustomProperty property : deleted) {
        String customPropertyFQN = getCustomPropertyFQN(updated.getName(), property.getName());
        LOG.info(
            "Deleting customProperty {} with type {} from the entity {}",
            property.getName(),
            property.getPropertyType().getName(),
            updated.getName());
        daoCollection
            .fieldRelationshipDAO()
            .delete(
                customPropertyFQN,
                property.getPropertyType().getName(),
                Entity.TYPE,
                Entity.TYPE,
                Relationship.HAS.ordinal());
      }
    }
  }
}

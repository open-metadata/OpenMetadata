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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.TypeRegistry;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.entity.type.Category;
import org.openmetadata.catalog.entity.type.CustomField;
import org.openmetadata.catalog.resources.types.TypeResource;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;

@Slf4j
public class TypeRepository extends EntityRepository<Type> {
  private static final String UPDATE_FIELDS = "customFields";
  private static final String PATCH_FIELDS = "customFields";

  public TypeRepository(CollectionDAO dao) {
    super(TypeResource.COLLECTION_PATH, Entity.TYPE, Type.class, dao.typeEntityDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
    allowEdits = true;
  }

  @Override
  public Type setFields(Type type, Fields fields) throws IOException {
    type.withCustomFields(fields.contains("customFields") ? getCustomFields(type) : null);
    return type;
  }

  @Override
  public void prepare(Type type) {
    setFullyQualifiedName(type);
    TypeRegistry.instance().validateCustomFields(type);
  }

  @Override
  public void storeEntity(Type type, boolean update) throws IOException {
    URI href = type.getHref();
    List<CustomField> customFields = type.getCustomFields();
    type.withHref(null).withCustomFields(null);
    store(type.getId(), type, update);
    type.withHref(href).withCustomFields(customFields);
    updateTypeMap(type);
  }

  @Override
  public void storeRelationships(Type type) {
    // Nothing to do
  }

  private void updateTypeMap(Type entity) {
    // Add entity type name to type map - example "email" -> email field type or "table" -> table entity type
    TypeRegistry.instance().addType(entity);
  }

  @Override
  protected void postDelete(Type entity) {
    TypeRegistry.removeType(entity.getName());
  }

  @Override
  public EntityUpdater getUpdater(Type original, Type updated, Operation operation) {
    return new TypeUpdater(original, updated, operation);
  }

  public PutResponse<Type> addCustomField(UriInfo uriInfo, String updatedBy, String id, CustomField field)
      throws IOException {
    Type type = dao.findEntityById(UUID.fromString(id), Include.NON_DELETED);
    if (type.getCategory().equals(Category.Field)) {
      throw new IllegalArgumentException("Field types can't be extended");
    }
    setFields(type, putFields);

    dao.findEntityById(field.getFieldType().getId()); // Validate customField type exists
    type.getCustomFields().add(field);
    type.setUpdatedBy(updatedBy);
    type.setUpdatedAt(System.currentTimeMillis());
    return createOrUpdate(uriInfo, type);
  }

  private List<CustomField> getCustomFields(Type type) throws IOException {
    if (type.getCategory().equals(Category.Field)) {
      return null; // Field types don't support custom fields
    }
    List<CustomField> customFields = new ArrayList<>();
    List<List<String>> results =
        daoCollection
            .fieldRelationshipDAO()
            .listToByPrefix(
                getCustomFieldFQNPrefix(type.getName()), Entity.TYPE, Entity.TYPE, Relationship.HAS.ordinal());
    for (List<String> result : results) {
      CustomField field = JsonUtils.readValue(result.get(2), CustomField.class);
      field.setFieldType(dao.findEntityReferenceByName(result.get(1)));
      customFields.add(field);
    }
    customFields.sort(EntityUtil.compareCustomField);
    return customFields;
  }

  /** Handles entity updated from PUT and POST operation. */
  public class TypeUpdater extends EntityUpdater {
    public TypeUpdater(Type original, Type updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateCustomFields();
    }

    private void updateCustomFields() throws JsonProcessingException {
      List<CustomField> updatedFields = listOrEmpty(updated.getCustomFields());
      List<CustomField> origFields = listOrEmpty(original.getCustomFields());
      List<CustomField> added = new ArrayList<>();
      List<CustomField> deleted = new ArrayList<>();
      recordListChange("charts", origFields, updatedFields, added, deleted, EntityUtil.customFieldMatch);
      for (CustomField field : added) {
        String customFieldFQN = getCustomFieldFQN(updated.getName(), field.getName());
        String customFieldJson = JsonUtils.pojoToJson(field);
        LOG.info(
            "Adding customField {} with type {} to the entity {}",
            customFieldFQN,
            field.getFieldType().getName(),
            updated.getName());
        daoCollection
            .fieldRelationshipDAO()
            .insert(
                customFieldFQN,
                field.getFieldType().getName(),
                Entity.TYPE,
                Entity.TYPE,
                Relationship.HAS.ordinal(),
                customFieldJson);
      }
      for (CustomField field : deleted) {
        String customFieldFQN = getCustomFieldFQN(updated.getName(), field.getName());
        LOG.info(
            "Deleting customField {} with type {} from the entity {}",
            field.getName(),
            field.getFieldType().getName(),
            updated.getName());
        daoCollection
            .fieldRelationshipDAO()
            .delete(
                customFieldFQN, field.getFieldType().getName(), Entity.TYPE, Entity.TYPE, Relationship.HAS.ordinal());
      }
    }
  }
}

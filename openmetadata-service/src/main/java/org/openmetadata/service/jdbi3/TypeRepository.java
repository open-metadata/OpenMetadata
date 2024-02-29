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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.util.EntityUtil.customFieldMatch;
import static org.openmetadata.service.util.EntityUtil.getCustomField;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.customproperties.EnumConfig;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.resources.types.TypeResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Slf4j
public class TypeRepository extends EntityRepository<Type> {
  private static final String UPDATE_FIELDS = "customProperties";
  private static final String PATCH_FIELDS = "customProperties";

  public TypeRepository() {
    super(
        TypeResource.COLLECTION_PATH,
        Entity.TYPE,
        Type.class,
        Entity.getCollectionDAO().typeEntityDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public void setFields(Type type, Fields fields) {
    type.withCustomProperties(
        fields.contains("customProperties")
            ? getCustomProperties(type)
            : type.getCustomProperties());
  }

  @Override
  public void clearFields(Type type, Fields fields) {
    type.withCustomProperties(
        fields.contains("customProperties") ? type.getCustomProperties() : null);
  }

  @Override
  public void prepare(Type type, boolean update) {
    TypeRegistry.instance().validateCustomProperties(type);
  }

  @Override
  public void storeEntity(Type type, boolean update) {
    List<CustomProperty> customProperties = type.getCustomProperties();
    type.withCustomProperties(null);
    store(type, update);
    type.withCustomProperties(customProperties);
    updateTypeMap(type);
  }

  public void addToRegistry(Type type) {
    updateTypeMap(type);
  }

  @Override
  public void storeRelationships(Type type) {
    // No relationships to store beyond what is stored in the super class
  }

  private void updateTypeMap(Type entity) {
    // Add entity type name to type map - example "email" -> email property type or "table" -> table
    // entity type
    TypeRegistry.instance().addType(entity);
  }

  @Override
  protected void postDelete(Type entity) {
    TypeRegistry.instance().removeType(entity.getName());
  }

  @Override
  public EntityUpdater getUpdater(Type original, Type updated, Operation operation) {
    return new TypeUpdater(original, updated, operation);
  }

  public PutResponse<Type> addCustomProperty(
      UriInfo uriInfo, String updatedBy, UUID id, CustomProperty property) {
    Type type = find(id, Include.NON_DELETED);
    property.setPropertyType(
        Entity.getEntityReferenceById(
            Entity.TYPE, property.getPropertyType().getId(), NON_DELETED));
    validateProperty(property);
    if (type.getCategory().equals(Category.Field)) {
      throw new IllegalArgumentException(
          "Only entity types can be extended and field types can't be extended");
    }
    setFieldsInternal(type, putFields);

    find(property.getPropertyType().getId(), NON_DELETED); // Validate customProperty type exists

    // If property already exists, then update it. Else add the new property.
    List<CustomProperty> updatedProperties = new ArrayList<>(List.of(property));
    for (CustomProperty existing : type.getCustomProperties()) {
      if (!existing.getName().equals(property.getName())) {
        updatedProperties.add(existing);
      }
    }

    type.setCustomProperties(updatedProperties);
    type.setUpdatedBy(updatedBy);
    type.setUpdatedAt(System.currentTimeMillis());
    return createOrUpdate(uriInfo, type);
  }

  private List<CustomProperty> getCustomProperties(Type type) {
    if (type.getCategory().equals(Category.Field)) {
      return null; // Property type fields don't support custom properties
    }
    List<CustomProperty> customProperties = new ArrayList<>();
    List<Triple<String, String, String>> results =
        daoCollection
            .fieldRelationshipDAO()
            .listToByPrefix(
                getCustomPropertyFQNPrefix(type.getName()),
                Entity.TYPE,
                Entity.TYPE,
                Relationship.HAS.ordinal());
    for (Triple<String, String, String> result : results) {
      CustomProperty property = JsonUtils.readValue(result.getRight(), CustomProperty.class);
      property.setPropertyType(this.getReferenceByName(result.getMiddle(), NON_DELETED));
      customProperties.add(property);
    }
    customProperties.sort(EntityUtil.compareCustomProperty);
    return customProperties;
  }

  private void validateProperty(CustomProperty customProperty) {
    switch (customProperty.getPropertyType().getName()) {
      case "enum" -> {
        CustomPropertyConfig config = customProperty.getCustomPropertyConfig();
        if (config != null) {
          EnumConfig enumConfig = JsonUtils.convertValue(config.getConfig(), EnumConfig.class);
          if (enumConfig == null
              || (enumConfig.getValues() != null && enumConfig.getValues().isEmpty())) {
            throw new IllegalArgumentException(
                "Enum Custom Property Type must have EnumConfig populated with values.");
          } else if (enumConfig.getValues() != null
              && enumConfig.getValues().stream().distinct().count()
                  != enumConfig.getValues().size()) {
            throw new IllegalArgumentException(
                "Enum Custom Property values cannot have duplicates.");
          }
        } else {
          throw new IllegalArgumentException("Enum Custom Property Type must have EnumConfig.");
        }
      }
      case "int", "string" -> {}
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class TypeUpdater extends EntityUpdater {
    public TypeUpdater(Type original, Type updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      updateCustomProperties();
    }

    private void updateCustomProperties() {
      List<CustomProperty> updatedProperties = listOrEmpty(updated.getCustomProperties());
      List<CustomProperty> origProperties = listOrEmpty(original.getCustomProperties());
      List<CustomProperty> added = new ArrayList<>();
      List<CustomProperty> deleted = new ArrayList<>();
      recordListChange(
          "customProperties", origProperties, updatedProperties, added, deleted, customFieldMatch);
      for (CustomProperty property : added) {
        storeCustomProperty(property);
      }
      for (CustomProperty property : deleted) {
        deleteCustomProperty(property);
      }

      // Record changes to updated custom properties (only description can be updated)
      for (CustomProperty updateProperty : updatedProperties) {
        // Find property that matches name and type
        CustomProperty storedProperty =
            origProperties.stream()
                .filter(c -> customFieldMatch.test(c, updateProperty))
                .findAny()
                .orElse(null);
        if (storedProperty == null) { // New property added, which is already handled
          continue;
        }
        updateCustomPropertyDescription(updated, storedProperty, updateProperty);
        updateCustomPropertyConfig(updated, storedProperty, updateProperty);
      }
    }

    private void storeCustomProperty(CustomProperty property) {
      String customPropertyFQN = getCustomPropertyFQN(updated.getName(), property.getName());
      EntityReference propertyType = property.getPropertyType();
      String customPropertyJson =
          JsonUtils.pojoToJson(property.withPropertyType(null)); // Don't store entity reference
      property.withPropertyType(propertyType); // Restore entity reference
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
              customPropertyFQN,
              property.getPropertyType().getName(),
              Entity.TYPE,
              Entity.TYPE,
              Relationship.HAS.ordinal(),
              customPropertyJson);
    }

    private void deleteCustomProperty(CustomProperty property) {
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
      // Delete all the data stored in the entity extension for the custom property
      daoCollection.entityExtensionDAO().deleteExtension(customPropertyFQN);
    }

    private void updateCustomPropertyDescription(
        Type entity, CustomProperty origProperty, CustomProperty updatedProperty) {
      String fieldName = getCustomField(origProperty, FIELD_DESCRIPTION);
      if (recordChange(
          fieldName, origProperty.getDescription(), updatedProperty.getDescription())) {
        String customPropertyFQN =
            getCustomPropertyFQN(entity.getName(), updatedProperty.getName());
        EntityReference propertyType =
            updatedProperty.getPropertyType(); // Don't store entity reference
        String customPropertyJson = JsonUtils.pojoToJson(updatedProperty.withPropertyType(null));
        updatedProperty.withPropertyType(propertyType); // Restore entity reference
        daoCollection
            .fieldRelationshipDAO()
            .upsert(
                customPropertyFQN,
                updatedProperty.getPropertyType().getName(),
                customPropertyFQN,
                updatedProperty.getPropertyType().getName(),
                Entity.TYPE,
                Entity.TYPE,
                Relationship.HAS.ordinal(),
                "customProperty",
                customPropertyJson);
      }
    }

    private void updateCustomPropertyConfig(
        Type entity, CustomProperty origProperty, CustomProperty updatedProperty) {
      String fieldName = getCustomField(origProperty, "customPropertyConfig");
      if (previous == null || !previous.getVersion().equals(updated.getVersion())) {
        validatePropertyConfigUpdate(entity, origProperty, updatedProperty);
      }
      if (recordChange(
          fieldName,
          origProperty.getCustomPropertyConfig(),
          updatedProperty.getCustomPropertyConfig())) {
        String customPropertyFQN =
            getCustomPropertyFQN(entity.getName(), updatedProperty.getName());
        EntityReference propertyType =
            updatedProperty.getPropertyType(); // Don't store entity reference
        String customPropertyJson = JsonUtils.pojoToJson(updatedProperty.withPropertyType(null));
        updatedProperty.withPropertyType(propertyType); // Restore entity reference
        daoCollection
            .fieldRelationshipDAO()
            .upsert(
                customPropertyFQN,
                updatedProperty.getPropertyType().getName(),
                customPropertyFQN,
                updatedProperty.getPropertyType().getName(),
                Entity.TYPE,
                Entity.TYPE,
                Relationship.HAS.ordinal(),
                "customProperty",
                customPropertyJson);
      }
    }

    private void validatePropertyConfigUpdate(
        Type entity, CustomProperty origProperty, CustomProperty updatedProperty) {
      if (origProperty.getPropertyType().getName().equals("enum")) {
        EnumConfig origConfig =
            JsonUtils.convertValue(
                origProperty.getCustomPropertyConfig().getConfig(), EnumConfig.class);
        EnumConfig updatedConfig =
            JsonUtils.convertValue(
                updatedProperty.getCustomPropertyConfig().getConfig(), EnumConfig.class);
        HashSet<String> updatedValues = new HashSet<>(updatedConfig.getValues());
        if (updatedValues.size() != updatedConfig.getValues().size()) {
          throw new IllegalArgumentException("Enum Custom Property values cannot have duplicates.");
        } else if (!updatedValues.containsAll(origConfig.getValues())) {
          throw new IllegalArgumentException(
              "Existing Enum Custom Property values cannot be removed.");
        }
      }
    }
  }
}

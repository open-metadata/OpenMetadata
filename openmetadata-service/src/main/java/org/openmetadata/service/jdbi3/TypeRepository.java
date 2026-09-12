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

import com.fasterxml.jackson.databind.JsonNode;
import com.google.common.util.concurrent.Striped;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.UriInfo;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.Lock;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.jobs.EnumCleanupArgs;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.schema.type.customProperties.TableConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jobs.EnumCleanupHandler;
import org.openmetadata.service.resources.types.TypeResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ValidatorUtil;

@Slf4j
@Repository()
public class TypeRepository implements EntityPolicy<Type> {

  private static final String UPDATE_FIELDS = "customProperties";

  private static final String PATCH_FIELDS = "customProperties";

  private static final Striped<Lock> TYPE_PROPERTY_LOCKS = Striped.lock(4096);

  public TypeRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                TypeResource.COLLECTION_PATH,
                Entity.TYPE,
                Type.class,
                Entity.getCollectionDAO().typeEntityDAO()),
            new EntityPolicyContext.WriteFields(PATCH_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    Entity.setTypeRepository(this);
  }

  @Override
  public void setFields(Type type, Fields fields, RelationIncludes relationIncludes) {
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
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("customProperties");
  }

  @Override
  public void storeEntity(Type type, boolean update) {
    persistence().store(type, update);
    updateTypeMap(type);
  }

  public void storeEntities(List<Type> types) {
    persistence().insertMany(types);
    for (Type type : types) {
      updateTypeMap(type);
    }
  }

  public void addToRegistry(Type type) {
    updateTypeMap(type);
  }

  public void populateRegistryFromDatabase() {
    collections()
        .all(fieldPolicy().parse(UPDATE_FIELDS), new ListFilter(NON_DELETED))
        .forEach(this::addToRegistry);
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
  public void postDelete(Type entity, boolean hardDelete) {
    EntityPolicy.super.postDelete(entity, hardDelete);
    TypeRegistry.instance().removeType(entity.getName());
  }

  @Override
  public EntityUpdater<Type> getUpdater(
      Type original, Type updated, EntityOperation operation, ChangeSource changeSource) {
    return new TypeUpdater(original, updated, operation).mutation();
  }

  @Override
  public void postUpdate(Type original, Type updated) {
    EntityPolicy.super.postUpdate(original, updated);
    // Refresh TypeRegistry to ensure custom property changes are reflected
    updateTypeMap(updated);
  }

  public PutResponse<Type> addCustomProperty(
      UriInfo uriInfo, String updatedBy, UUID id, CustomProperty property) {
    Lock lock = TYPE_PROPERTY_LOCKS.get(id);
    lock.lock();
    try {
      Type type = lookup().byId(id, Include.NON_DELETED);
      property.setPropertyType(
          Entity.getEntityReferenceById(
              Entity.TYPE, property.getPropertyType().getId(), NON_DELETED));
      validateProperty(property);
      if (type.getCategory().equals(Category.Field)) {
        throw new IllegalArgumentException(
            "Only entity types can be extended and field types can't be extended");
      }
      setFieldsInternal(type, context().putFields());
      lookup()
          .byId( // Validate customProperty type exists
              property.getPropertyType().getId(), NON_DELETED);
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
      return creates().upsert(uriInfo, type, new EntityCommandActor(updatedBy, null), false);
    } finally {
      lock.unlock();
    }
  }

  private List<CustomProperty> getCustomProperties(Type type) {
    if (type.getCategory().equals(Category.Field)) {
      // Property type fields don't support custom properties
      return null;
    }
    List<CustomProperty> customProperties = new ArrayList<>();
    List<Triple<String, String, String>> results =
        context()
            .dependencies()
            .daos()
            .fieldRelationshipDAO()
            .listToByPrefix(
                getCustomPropertyFQNPrefix(type.getName()),
                Entity.TYPE,
                Entity.TYPE,
                Relationship.HAS.ordinal());
    for (Triple<String, String, String> result : results) {
      CustomProperty property = JsonUtils.readValue(result.getRight(), CustomProperty.class);
      property.setPropertyType(this.lookup().referenceByName(result.getMiddle(), NON_DELETED));
      if ("enum".equals(property.getPropertyType().getName())) {
        sortEnumKeys(property);
      }
      customProperties.add(property);
    }
    customProperties.sort(EntityUtil.compareCustomProperty);
    return customProperties;
  }

  private void validateProperty(CustomProperty customProperty) {
    switch (customProperty.getPropertyType().getName()) {
      case "enum" -> validateEnumConfig(customProperty.getCustomPropertyConfig());
      case "table-cp" -> validateTableTypeConfig(customProperty.getCustomPropertyConfig());
      case "date-cp" -> validateDateFormat(
          customProperty.getCustomPropertyConfig(), getDateTokens(), "Invalid date format");
      case "dateTime-cp" -> validateDateFormat(
          customProperty.getCustomPropertyConfig(), getDateTimeTokens(), "Invalid dateTime format");
      case "time-cp" -> validateDateFormat(
          customProperty.getCustomPropertyConfig(), getTimeTokens(), "Invalid time format");
        // hyperlink-cp requires no special config validation - URL protocol validation
        // (http/https only) is enforced in EntityRepository.validateHyperlinkUrl
      case "int", "string", "hyperlink-cp" -> {}
    }
  }

  private void validateDateFormat(
      CustomPropertyConfig config, Set<Character> validTokens, String errorMessage) {
    if (config != null) {
      String format = String.valueOf(config.getConfig());
      for (char c : format.toCharArray()) {
        if (Character.isLetter(c) && !validTokens.contains(c)) {
          throw new IllegalArgumentException(errorMessage + ": " + format);
        }
      }
      try {
        DateTimeFormatter.ofPattern(format);
      } catch (IllegalArgumentException e) {
        throw new IllegalArgumentException(errorMessage + ": " + format, e);
      }
    } else {
      throw new IllegalArgumentException(errorMessage + " must have Config populated with format.");
    }
  }

  private Set<Character> getDateTokens() {
    return Set.of('y', 'M', 'd', 'E', 'D', 'W', 'w');
  }

  private Set<Character> getDateTimeTokens() {
    return Set.of(
        'y', 'M', 'd', 'E', 'D', 'W', 'w', 'H', 'h', 'm', 's', 'a', 'T', 'X', 'Z', '+', '-', 'S');
  }

  private Set<Character> getTimeTokens() {
    return Set.of('H', 'h', 'm', 's', 'a', 'S');
  }

  private void validateEnumConfig(CustomPropertyConfig config) {
    if (config != null) {
      EnumConfig enumConfig = JsonUtils.convertValue(config.getConfig(), EnumConfig.class);
      if (enumConfig == null
          || (enumConfig.getValues() != null && enumConfig.getValues().isEmpty())) {
        throw new IllegalArgumentException(
            "Enum Custom Property Type must have EnumConfig populated with values.");
      } else if (enumConfig.getValues() != null
          && enumConfig.getValues().stream().distinct().count() != enumConfig.getValues().size()) {
        throw new IllegalArgumentException("Enum Custom Property values cannot have duplicates.");
      }
    } else {
      throw new IllegalArgumentException("Enum Custom Property Type must have EnumConfig.");
    }
  }

  private void validateTableTypeConfig(CustomPropertyConfig config) {
    if (config == null) {
      throw new IllegalArgumentException("Table Custom Property Type must have config populated.");
    }
    JsonNode configNode = JsonUtils.valueToTree(config.getConfig());
    TableConfig tableConfig = JsonUtils.convertValue(config.getConfig(), TableConfig.class);
    List<String> columns = new ArrayList<>();
    configNode.path("columns").forEach(node -> columns.add(node.asText()));
    Set<String> uniqueColumns = new HashSet<>(columns);
    if (uniqueColumns.size() != columns.size()) {
      throw new IllegalArgumentException("Column names must be unique.");
    }
    if (columns.size() < tableConfig.getMinColumns()
        || columns.size() > tableConfig.getMaxColumns()) {
      throw new IllegalArgumentException(
          "Custom Property table has invalid value columns size must be between "
              + tableConfig.getMinColumns()
              + " and "
              + tableConfig.getMaxColumns());
    }
    try {
      JsonUtils.validateJsonSchema(config.getConfig(), TableConfig.class);
    } catch (ConstraintViolationException e) {
      String validationErrors =
          e.getConstraintViolations().stream()
              .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
              .collect(Collectors.joining(", "));
      throw new IllegalArgumentException(
          CatalogExceptionMessage.customPropertyConfigError("table", validationErrors));
    }
  }

  @SuppressWarnings("unchecked")
  private void sortEnumKeys(CustomProperty property) {
    Object enumConfig = property.getCustomPropertyConfig().getConfig();
    if (enumConfig instanceof Map) {
      Map<String, Object> configMap = (Map<String, Object>) enumConfig;
      if (configMap.get("values") instanceof List) {
        List<String> values = (List<String>) configMap.get("values");
        List<String> sortedValues = values.stream().sorted().collect(Collectors.toList());
        configMap.put("values", sortedValues);
      }
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class TypeUpdater implements EntitySpecificMutation<Type> {

    private final List<CustomProperty> requestedAdditions;

    private final List<CustomProperty> requestedDeletions;

    private boolean membershipChangesApplied;

    public TypeUpdater(Type original, Type updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
      requestedAdditions =
          getPropertiesAbsentByName(updated.getCustomProperties(), original.getCustomProperties());
      requestedDeletions =
          getPropertiesAbsentByName(original.getCustomProperties(), updated.getCustomProperties());
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Type> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate("customProperties", this::updateCustomProperties);
    }

    @Override
    public void reset() {
      membershipChangesApplied = false;
    }

    private void updateCustomProperties() {
      List<CustomProperty> updatedProperties =
          listOrEmpty(entityUpdate.getUpdated().getCustomProperties());
      List<CustomProperty> origProperties =
          listOrEmpty(entityUpdate.getOriginal().getCustomProperties());
      List<CustomProperty> added = new ArrayList<>();
      List<CustomProperty> deleted = new ArrayList<>();
      entityUpdate.recordListChange(
          "customProperties", origProperties, updatedProperties, added, deleted, customFieldMatch);
      applyRequestedMembershipChanges();
      // Record changes to updated custom properties (only description can be updated)
      for (CustomProperty updateProperty : updatedProperties) {
        // Find property that matches name and type
        CustomProperty storedProperty =
            origProperties.stream()
                .filter(c -> customFieldMatch.test(c, updateProperty))
                .findAny()
                .orElse(null);
        if (storedProperty == null) {
          // New property added, which is already handled
          continue;
        }
        updateCustomPropertyDescription(entityUpdate.getUpdated(), storedProperty, updateProperty);
        updateDisplayName(entityUpdate.getUpdated(), storedProperty, updateProperty);
        updateCustomPropertyConfig(entityUpdate.getUpdated(), storedProperty, updateProperty);
      }
    }

    private List<CustomProperty> getPropertiesAbsentByName(
        List<CustomProperty> candidates, List<CustomProperty> existingProperties) {
      Set<String> existingNames =
          listOrEmpty(existingProperties).stream()
              .map(CustomProperty::getName)
              .collect(Collectors.toSet());
      Set<String> collectedNames = new HashSet<>();
      return listOrEmpty(candidates).stream()
          .filter(property -> !existingNames.contains(property.getName()))
          .filter(property -> collectedNames.add(property.getName()))
          .map(property -> JsonUtils.deepCopy(property, CustomProperty.class))
          .toList();
    }

    private void applyRequestedMembershipChanges() {
      if (membershipChangesApplied) {
        return;
      }
      // Legacy names from existing data are not re-validated; only newly added ones.
      for (CustomProperty property : requestedAdditions) {
        String violations = ValidatorUtil.validate(property);
        if (violations != null) {
          throw new IllegalArgumentException(violations);
        }
      }
      for (CustomProperty property : requestedAdditions) {
        storeCustomProperty(property);
      }
      for (CustomProperty property : requestedDeletions) {
        deleteCustomProperty(property);
      }
      membershipChangesApplied = true;
    }

    private void storeCustomProperty(CustomProperty property) {
      String customPropertyFQN =
          getCustomPropertyFQN(entityUpdate.getUpdated().getName(), property.getName());
      EntityReference propertyType = property.getPropertyType();
      // Don't store entity reference
      String // Don't store entity reference
          customPropertyJson = JsonUtils.pojoToJson(property.withPropertyType(null));
      // Restore entity reference
      property.withPropertyType(propertyType);
      LOG.info(
          "Adding customProperty {} with type {} to the entity {}",
          customPropertyFQN,
          property.getPropertyType().getName(),
          entityUpdate.getUpdated().getName());
      context()
          .dependencies()
          .daos()
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
      String customPropertyFQN =
          getCustomPropertyFQN(entityUpdate.getUpdated().getName(), property.getName());
      LOG.info(
          "Deleting customProperty {} with type {} from the entity {}",
          property.getName(),
          property.getPropertyType().getName(),
          entityUpdate.getUpdated().getName());
      context()
          .dependencies()
          .daos()
          .fieldRelationshipDAO()
          .delete(
              customPropertyFQN,
              property.getPropertyType().getName(),
              Entity.TYPE,
              Entity.TYPE,
              Relationship.HAS.ordinal());
      // Delete all the data stored in the entity extension for the custom property
      context().dependencies().daos().entityExtensionDAO().deleteExtension(customPropertyFQN);
      if (Entity.hasEntityRepository(Entity.INTAKE_FORM)) {
        IntakeFormRepository intakeFormRepository =
            (IntakeFormRepository) Entity.getEntityRepository(Entity.INTAKE_FORM);
        intakeFormRepository.removeCustomPropertyField(
            entityUpdate.getUpdated().getName(),
            property.getName(),
            entityUpdate.getUpdated().getUpdatedBy());
      }
      // Remove from TypeRegistry cache
      TypeRegistry.instance()
          .removeCustomProperty(entityUpdate.getUpdated().getName(), property.getName());
    }

    private void updateCustomPropertyDescription(
        Type entity, CustomProperty origProperty, CustomProperty updatedProperty) {
      String fieldName = getCustomField(origProperty, FIELD_DESCRIPTION);
      if (entityUpdate.recordChange(
          fieldName, origProperty.getDescription(), updatedProperty.getDescription())) {
        String customPropertyFQN =
            getCustomPropertyFQN(entity.getName(), updatedProperty.getName());
        // Don't store entity reference
        EntityReference // Don't store entity reference
            propertyType = updatedProperty.getPropertyType();
        String customPropertyJson = JsonUtils.pojoToJson(updatedProperty.withPropertyType(null));
        // Restore entity reference
        updatedProperty.withPropertyType(propertyType);
        context()
            .dependencies()
            .daos()
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

    private void updateDisplayName(
        Type entity, CustomProperty origProperty, CustomProperty updatedProperty) {
      String fieldName = getCustomField(origProperty, "displayName");
      if (entityUpdate.recordChange(
          fieldName, origProperty.getDisplayName(), updatedProperty.getDisplayName())) {
        String customPropertyFQN =
            getCustomPropertyFQN(entity.getName(), updatedProperty.getName());
        // Don't store entity reference
        EntityReference // Don't store entity reference
            propertyType = updatedProperty.getPropertyType();
        String customPropertyJson = JsonUtils.pojoToJson(updatedProperty.withPropertyType(null));
        // Restore entity reference
        updatedProperty.withPropertyType(propertyType);
        context()
            .dependencies()
            .daos()
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
      if (entityUpdate.getPrevious() == null
          || !entityUpdate
              .getPrevious()
              .getVersion()
              .equals(entityUpdate.getUpdated().getVersion())) {
        validatePropertyConfigUpdate(entity, origProperty, updatedProperty);
        if (entityUpdate.recordChange(
            fieldName,
            origProperty.getCustomPropertyConfig(),
            updatedProperty.getCustomPropertyConfig())) {
          String customPropertyFQN =
              getCustomPropertyFQN(entity.getName(), updatedProperty.getName());
          // Don't store entity reference
          EntityReference // Don't store entity reference
              propertyType = updatedProperty.getPropertyType();
          String customPropertyJson = JsonUtils.pojoToJson(updatedProperty.withPropertyType(null));
          // Restore entity reference
          updatedProperty.withPropertyType(propertyType);
          context()
              .dependencies()
              .daos()
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
          postUpdateCustomPropertyConfig(entity, origProperty, updatedProperty);
        }
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
        }
      }
    }

    private void postUpdateCustomPropertyConfig(
        Type entity, CustomProperty origProperty, CustomProperty updatedProperty) {
      String updatedBy = entity.getUpdatedBy();
      if (origProperty.getPropertyType().getName().equals("enum")) {
        sortEnumKeys(updatedProperty);
        EnumConfig origConfig =
            JsonUtils.convertValue(
                origProperty.getCustomPropertyConfig().getConfig(), EnumConfig.class);
        EnumConfig updatedConfig =
            JsonUtils.convertValue(
                updatedProperty.getCustomPropertyConfig().getConfig(), EnumConfig.class);
        HashSet<String> origKeys = new HashSet<>(origConfig.getValues());
        HashSet<String> updatedKeys = new HashSet<>(updatedConfig.getValues());
        HashSet<String> removedKeys = new HashSet<>(origKeys);
        removedKeys.removeAll(updatedKeys);
        HashSet<String> addedKeys = new HashSet<>(updatedKeys);
        addedKeys.removeAll(origKeys);
        if (!removedKeys.isEmpty()) {
          List<String> removedEnumKeys = new ArrayList<>(removedKeys);
          try {
            EnumCleanupArgs enumCleanupArgs =
                new EnumCleanupArgs()
                    .withPropertyName(updatedProperty.getName())
                    .withRemovedEnumKeys(removedEnumKeys)
                    .withEntityType(entity.getName());
            String jobArgs = JsonUtils.pojoToJson(enumCleanupArgs);
            long jobId =
                context()
                    .dependencies()
                    .jobs()
                    .insertJob(
                        BackgroundJob.JobType.CUSTOM_PROPERTY_ENUM_CLEANUP,
                        new EnumCleanupHandler(context().dependencies().daos()),
                        jobArgs,
                        updatedBy);
          } catch (Exception e) {
            LOG.error("Failed to trigger background job for enum cleanup", e);
            throw new RuntimeException("Failed to trigger background job", e);
          }
        }
      }
    }

    private final EntityUpdater<Type> entityUpdate;

    public EntityUpdater<Type> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Type> entityContext;

  @Override
  public final EntityPolicyContext<Type> context() {
    return entityContext;
  }
}

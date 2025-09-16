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

package org.openmetadata.service;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.resources.types.TypeResource.PROPERTIES_FIELD;

import com.networknt.schema.JsonSchema;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/** Type registry used for storing Types in OpenMetadata and customProperties of entity types. */
@Slf4j
public class TypeRegistry {
  /** Type map used for storing both Property Types and Entity Types */
  protected static final Map<String, Type> TYPES = new ConcurrentHashMap<>();

  /** Custom property map (fully qualified customPropertyName) to (customProperty) */
  protected static final Map<String, CustomProperty> CUSTOM_PROPERTIES = new ConcurrentHashMap<>();

  /** Custom property map (fully qualified customPropertyName) to (jsonSchema) */
  protected static final Map<String, JsonSchema> CUSTOM_PROPERTY_SCHEMAS =
      new ConcurrentHashMap<>();

  private static final TypeRegistry INSTANCE = new TypeRegistry();

  private TypeRegistry() {
    /* Singleton instance */
  }

  public static TypeRegistry instance() {
    return INSTANCE;
  }

  public final void initialize(TypeRepository repository) {
    // Load types defined in OpenMetadata schemas
    long now = System.currentTimeMillis();
    List<Type> types = JsonUtils.getTypes();
    types.forEach(
        type -> {
          type.withId(UUID.randomUUID()).withUpdatedBy(ADMIN_USER_NAME).withUpdatedAt(now);
          LOG.debug("Loading type {}", type.getName());
          try {
            EntityUtil.Fields fields = repository.getFields(PROPERTIES_FIELD);
            try {
              Type storedType = repository.getByName(null, type.getName(), fields);
              type.setId(storedType.getId());
              // If entity type already exists, then carry forward custom properties
              if (storedType.getCategory().equals(Category.Entity)) {
                type.setCustomProperties(storedType.getCustomProperties());
              }
            } catch (Exception e) {
              LOG.debug(
                  "Type '{}' not found. Proceeding to add new type entity in database.",
                  type.getName());
            }
            repository.addToRegistry(type);
          } catch (Exception e) {
            LOG.error("Error loading type {}", type.getName(), e);
          }
        });
  }

  public void addType(Type type) {
    TYPES.put(type.getName(), type);

    // Store custom properties added to a type
    for (CustomProperty property : type.getCustomProperties()) {
      TypeRegistry.instance().addCustomProperty(type.getName(), property.getName(), property);
    }
  }

  public void removeType(String typeName) {
    TYPES.remove(typeName);
    LOG.info("Deleted type {}", typeName);
    // TODO cleanup custom properties
  }

  private void addCustomProperty(
      String entityType, String propertyName, CustomProperty customProperty) {
    String customPropertyFQN = getCustomPropertyFQN(entityType, propertyName);
    CUSTOM_PROPERTIES.put(customPropertyFQN, customProperty);

    try {
      JsonSchema jsonSchema =
          JsonUtils.getJsonSchema(
              TYPES.get(customProperty.getPropertyType().getName()).getSchema());
      CUSTOM_PROPERTY_SCHEMAS.put(customPropertyFQN, jsonSchema);
      LOG.info("Adding custom property {} with JSON schema {}", customPropertyFQN, jsonSchema);

    } catch (Exception e) {
      CUSTOM_PROPERTIES.remove(customPropertyFQN);
      LOG.info("Failed to add custom property {}: {}", customPropertyFQN, e.getMessage());
    }
  }

  public JsonSchema getSchema(String entityType, String propertyName) {
    String customPropertyFQN = getCustomPropertyFQN(entityType, propertyName);
    return CUSTOM_PROPERTY_SCHEMAS.get(customPropertyFQN);
  }

  public void validateCustomProperties(Type type) {
    // Validate custom properties added to a type
    for (CustomProperty property : listOrEmpty(type.getCustomProperties())) {
      if (TYPES.get(property.getPropertyType().getName()) == null) {
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(
                Entity.TYPE, property.getPropertyType().getName()));
      }
    }
  }

  public static String getCustomPropertyFQNPrefix(String entityType) {
    return FullyQualifiedName.build(entityType, "customProperties");
  }

  public static String getCustomPropertyFQN(String entityType, String propertyName) {
    return FullyQualifiedName.build(entityType, "customProperties", propertyName);
  }

  public static String getPropertyName(String propertyFQN) {
    return FullyQualifiedName.split(propertyFQN)[2];
  }

  public static String getCustomPropertyType(String entityType, String propertyName) {
    String fqn = getCustomPropertyFQN(entityType, propertyName);
    CustomProperty property = CUSTOM_PROPERTIES.get(fqn);
    if (property == null) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityNotFound(propertyName, entityType));
    }
    return property.getPropertyType().getName();
  }

  public static String getCustomPropertyConfig(String entityType, String propertyName) {
    String fqn = getCustomPropertyFQN(entityType, propertyName);
    CustomProperty property = CUSTOM_PROPERTIES.get(fqn);
    if (property != null
        && property.getCustomPropertyConfig() != null
        && property.getCustomPropertyConfig().getConfig() != null) {
      Object config = property.getCustomPropertyConfig().getConfig();
      return (config instanceof String || config instanceof Integer)
          ? config.toString() // for simple type config return as string
          : JsonUtils.pojoToJson(config); // for complex object in config return as JSON string
    }
    return null;
  }
}

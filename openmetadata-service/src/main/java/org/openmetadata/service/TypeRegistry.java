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

import com.networknt.schema.Schema;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
  protected static final Map<String, Schema> CUSTOM_PROPERTY_SCHEMAS = new ConcurrentHashMap<>();

  private static final TypeRegistry INSTANCE = new TypeRegistry();

  private TypeRepository typeRepository;

  /** Tracks when each entity type was last refreshed from DB, for TTL-based staleness detection */
  protected static final Map<String, Long> TYPE_LAST_REFRESHED = new ConcurrentHashMap<>();

  private static final long REFRESH_INTERVAL_MS = 900_000; // 15 minutes
  private static final long CACHE_MISS_DEBOUNCE_MS = 30_000; // 30 seconds

  private TypeRegistry() {
    /* Singleton instance */
  }

  public static TypeRegistry instance() {
    return INSTANCE;
  }

  public final void initialize(TypeRepository repository) {
    this.typeRepository = repository;
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
    for (CustomProperty property : listOrEmpty(type.getCustomProperties())) {
      TypeRegistry.instance().addCustomProperty(type.getName(), property.getName(), property);
    }
    TYPE_LAST_REFRESHED.put(type.getName(), System.currentTimeMillis());
  }

  public void removeType(String typeName) {
    var removedType = TYPES.remove(typeName);
    TYPE_LAST_REFRESHED.remove(typeName);
    LOG.info("Deleted type {}", typeName);

    // Cleanup custom properties for removed type using Optional for cleaner null handling
    Optional.ofNullable(removedType).map(Type::getCustomProperties).stream()
        .flatMap(List::stream)
        .forEach(property -> removeCustomProperty(typeName, property.getName()));
  }

  private void addCustomProperty(
      String entityType, String propertyName, CustomProperty customProperty) {
    String customPropertyFQN = getCustomPropertyFQN(entityType, propertyName);
    CUSTOM_PROPERTIES.put(customPropertyFQN, customProperty);

    try {
      Schema jsonSchema =
          JsonUtils.getJsonSchema(
              TYPES.get(customProperty.getPropertyType().getName()).getSchema());
      CUSTOM_PROPERTY_SCHEMAS.put(customPropertyFQN, jsonSchema);
      LOG.info("Adding custom property {} with JSON schema {}", customPropertyFQN, jsonSchema);

    } catch (Exception e) {
      CUSTOM_PROPERTIES.remove(customPropertyFQN);
      LOG.info("Failed to add custom property {}: {}", customPropertyFQN, e.getMessage());
    }
  }

  public void removeCustomProperty(String entityType, String propertyName) {
    String customPropertyFQN = getCustomPropertyFQN(entityType, propertyName);
    CUSTOM_PROPERTIES.remove(customPropertyFQN);
    CUSTOM_PROPERTY_SCHEMAS.remove(customPropertyFQN);
    LOG.info("Removed custom property {} from TypeRegistry cache", customPropertyFQN);
  }

  public Schema getSchema(String entityType, String propertyName) {
    String customPropertyFQN = getCustomPropertyFQN(entityType, propertyName);
    Schema schema = CUSTOM_PROPERTY_SCHEMAS.get(customPropertyFQN);
    if (isTypeStale(entityType) || (schema == null && shouldRefreshOnMiss(entityType))) {
      refreshTypeFromDB(entityType);
      schema = CUSTOM_PROPERTY_SCHEMAS.get(customPropertyFQN);
    }
    return schema;
  }

  private static boolean isTypeStale(String entityType) {
    Long lastRefreshed = TYPE_LAST_REFRESHED.get(entityType);
    return lastRefreshed == null
        || (System.currentTimeMillis() - lastRefreshed) > REFRESH_INTERVAL_MS;
  }

  private static boolean shouldRefreshOnMiss(String entityType) {
    Long lastRefreshed = TYPE_LAST_REFRESHED.get(entityType);
    return lastRefreshed == null
        || (System.currentTimeMillis() - lastRefreshed) > CACHE_MISS_DEBOUNCE_MS;
  }

  private void refreshTypeFromDB(String entityType) {
    if (typeRepository == null) {
      LOG.warn("TypeRepository not yet initialized, cannot refresh type '{}' from DB", entityType);
      return;
    }
    try {
      EntityUtil.Fields fields = typeRepository.getFields(PROPERTIES_FIELD);
      Type type = typeRepository.getByName(null, entityType, fields);

      // Clear stale custom property entries before re-adding fresh data from DB
      String prefix = getCustomPropertyFQNPrefix(entityType) + Entity.SEPARATOR;
      CUSTOM_PROPERTIES.keySet().removeIf(fqn -> fqn.startsWith(prefix));
      CUSTOM_PROPERTY_SCHEMAS.keySet().removeIf(fqn -> fqn.startsWith(prefix));

      addType(type);
      LOG.info(
          "Refreshed type '{}' from DB into TypeRegistry cache ({} custom properties)",
          entityType,
          listOrEmpty(type.getCustomProperties()).size());
    } catch (EntityNotFoundException e) {
      LOG.debug("Type '{}' not found in DB during cache refresh", entityType);
      TYPE_LAST_REFRESHED.put(entityType, System.currentTimeMillis());
    } catch (Exception e) {
      LOG.warn("Failed to refresh type '{}' from DB: {}", entityType, e.getMessage());
      TYPE_LAST_REFRESHED.put(entityType, System.currentTimeMillis());
    }
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
    if (isTypeStale(entityType) || (property == null && shouldRefreshOnMiss(entityType))) {
      TypeRegistry.instance().refreshTypeFromDB(entityType);
      property = CUSTOM_PROPERTIES.get(fqn);
    }
    if (property == null) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityNotFound(propertyName, entityType));
    }
    return property.getPropertyType().getName();
  }

  public static String getCustomPropertyConfig(String entityType, String propertyName) {
    String fqn = getCustomPropertyFQN(entityType, propertyName);
    CustomProperty property = CUSTOM_PROPERTIES.get(fqn);
    if (isTypeStale(entityType) || (property == null && shouldRefreshOnMiss(entityType))) {
      TypeRegistry.instance().refreshTypeFromDB(entityType);
      property = CUSTOM_PROPERTIES.get(fqn);
    }
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

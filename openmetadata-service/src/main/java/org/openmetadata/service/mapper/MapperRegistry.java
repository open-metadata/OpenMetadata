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

package org.openmetadata.service.mapper;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Registry for managing entity mappers.
 *
 * <p>This registry provides a centralized location for storing and retrieving mapper instances.
 * Mappers are registered by their entity type string (e.g., "table", "database") and can be
 * retrieved by type or mapper class.
 *
 * <p>This follows the same pattern as ServiceRegistry:
 *
 * <ul>
 *   <li>Easily tested with mock mappers
 *   <li>Injected into services via constructor
 *   <li>Managed with clear lifecycle
 * </ul>
 */
@Slf4j
public class MapperRegistry {
  private static final MapperRegistry INSTANCE = new MapperRegistry();

  private final Map<String, EntityMapper<?, ?>> mappersByEntityType = new ConcurrentHashMap<>();
  private final Map<Class<?>, EntityMapper<?, ?>> mappersByClass = new ConcurrentHashMap<>();

  private MapperRegistry() {}

  public static MapperRegistry getInstance() {
    return INSTANCE;
  }

  /**
   * Register a mapper for an entity type.
   *
   * @param entityType The entity type string (e.g., "table", "database")
   * @param mapper The mapper instance
   * @param <T> The entity type
   * @param <C> The create entity type
   */
  public <T extends EntityInterface, C extends CreateEntity> void register(
      String entityType, EntityMapper<T, C> mapper) {
    if (mappersByEntityType.containsKey(entityType)) {
      LOG.warn("Mapper for entity type '{}' is being re-registered", entityType);
    }
    mappersByEntityType.put(entityType, mapper);
    mappersByClass.put(mapper.getClass(), mapper);
    LOG.debug("Registered mapper for entity type: {}", entityType);
  }

  /**
   * Get mapper by entity type string.
   *
   * @param entityType The entity type (e.g., "table", "database")
   * @param <T> The entity type
   * @param <C> The create entity type
   * @return The mapper instance
   * @throws EntityNotFoundException if no mapper is registered for the entity type
   */
  @SuppressWarnings("unchecked")
  public <T extends EntityInterface, C extends CreateEntity> EntityMapper<T, C> getMapper(
      String entityType) {
    EntityMapper<T, C> mapper = (EntityMapper<T, C>) mappersByEntityType.get(entityType);
    if (mapper == null) {
      throw EntityNotFoundException.byMessage(
          String.format("No mapper registered for entity type: %s", entityType));
    }
    return mapper;
  }

  /**
   * Get mapper by mapper class.
   *
   * @param mapperClass The mapper class
   * @param <M> The mapper type
   * @return The mapper instance
   * @throws EntityNotFoundException if no mapper of the specified class is registered
   */
  @SuppressWarnings("unchecked")
  public <M extends EntityMapper<?, ?>> M getMapper(Class<M> mapperClass) {
    M mapper = (M) mappersByClass.get(mapperClass);
    if (mapper == null) {
      throw EntityNotFoundException.byMessage(
          String.format("No mapper registered for class: %s", mapperClass.getName()));
    }
    return mapper;
  }

  /**
   * Check if a mapper is registered for an entity type.
   *
   * @param entityType The entity type
   * @return true if mapper is registered
   */
  public boolean hasMapper(String entityType) {
    return mappersByEntityType.containsKey(entityType);
  }

  /**
   * Check if a mapper is registered for a mapper class.
   *
   * @param mapperClass The mapper class
   * @return true if mapper is registered
   */
  public boolean hasMapper(Class<?> mapperClass) {
    return mappersByClass.containsKey(mapperClass);
  }

  /**
   * Get all registered entity types.
   *
   * @return Set of entity type strings
   */
  public Set<String> getRegisteredEntityTypes() {
    return mappersByEntityType.keySet();
  }

  /** Clear all registered mappers. Useful for testing. */
  public void clear() {
    mappersByEntityType.clear();
    mappersByClass.clear();
    LOG.debug("Cleared all registered mappers");
  }

  /**
   * Get the number of registered mappers.
   *
   * @return Number of mappers
   */
  public int size() {
    return mappersByEntityType.size();
  }
}

package org.openmetadata.sdk.fluent;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent API for updating custom properties on entities.
 *
 * <pre>
 * // Update custom properties on a Table
 * Table table = CustomProperties.update(Tables.class, tableId)
 *     .withProperty("businessImportance", "HIGH")
 *     .withProperty("dataClassification", "CONFIDENTIAL")
 *     .withProperty("refreshFrequency", "DAILY")
 *     .execute();
 *
 * // Bulk update properties
 * Map<String, Object> properties = new HashMap<>();
 * properties.put("businessImportance", "HIGH");
 * properties.put("dataClassification", "CONFIDENTIAL");
 *
 * Table table = CustomProperties.update(Tables.class, tableId)
 *     .withProperties(properties)
 *     .execute();
 *
 * // Clear a specific property
 * Table table = CustomProperties.update(Tables.class, tableId)
 *     .clearProperty("businessImportance")
 *     .execute();
 *
 * // Clear all custom properties
 * Table table = CustomProperties.update(Tables.class, tableId)
 *     .clearAll()
 *     .execute();
 * </pre>
 */
@Slf4j
public class CustomProperties {

  private CustomProperties() {} // Prevent instantiation

  /**
   * Create a custom property updater for any entity type.
   *
   * @param entityClass The entity class (e.g., Tables.class, Glossaries.class)
   * @param entityId The entity UUID
   * @return A CustomPropertyUpdater instance
   */
  public static <T> CustomPropertyUpdater<T> update(Class<?> entityClass, UUID entityId) {
    return new CustomPropertyUpdater<>(entityClass, entityId.toString());
  }

  /**
   * Create a custom property updater for any entity type.
   *
   * @param entityClass The entity class (e.g., Tables.class, Glossaries.class)
   * @param entityId The entity ID as string
   * @return A CustomPropertyUpdater instance
   */
  public static <T> CustomPropertyUpdater<T> update(Class<?> entityClass, String entityId) {
    return new CustomPropertyUpdater<>(entityClass, entityId);
  }

  /**
   * Create a custom property updater using entity name/FQN.
   *
   * @param entityClass The entity class (e.g., Tables.class, Glossaries.class)
   * @param entityName The entity name or FQN
   * @return A CustomPropertyUpdater instance
   */
  public static <T> CustomPropertyUpdater<T> updateByName(Class<?> entityClass, String entityName) {
    return new CustomPropertyUpdater<>(entityClass, entityName, true);
  }

  public static class CustomPropertyUpdater<T> {
    final Class<?> entityClass;
    final String identifier;
    final boolean isFqn;
    final Map<String, Object> properties = new HashMap<>();
    boolean clearAll = false;
    private static final org.slf4j.Logger LOG =
        org.slf4j.LoggerFactory.getLogger(CustomPropertyUpdater.class);

    CustomPropertyUpdater(Class<?> entityClass, String identifier) {
      this(entityClass, identifier, false);
    }

    CustomPropertyUpdater(Class<?> entityClass, String identifier, boolean isFqn) {
      this.entityClass = entityClass;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    /**
     * Add or update a custom property.
     *
     * @param key The property key
     * @param value The property value
     * @return This updater for chaining
     */
    public CustomPropertyUpdater<T> withProperty(String key, Object value) {
      properties.put(key, value);
      return this;
    }

    /**
     * Add or update multiple custom properties.
     *
     * @param properties Map of properties to add/update
     * @return This updater for chaining
     */
    public CustomPropertyUpdater<T> withProperties(Map<String, Object> properties) {
      this.properties.putAll(properties);
      return this;
    }

    /**
     * Clear a specific custom property.
     *
     * @param key The property key to remove
     * @return This updater for chaining
     */
    public CustomPropertyUpdater<T> clearProperty(String key) {
      properties.put(key, null);
      return this;
    }

    /**
     * Clear all custom properties.
     *
     * @return This updater for chaining
     */
    public CustomPropertyUpdater<T> clearAll() {
      this.clearAll = true;
      return this;
    }

    /**
     * Execute the custom property update.
     *
     * @return The updated entity
     */
    @SuppressWarnings("unchecked")
    public T execute() {
      OpenMetadataClient client = getClient(entityClass);

      // Get the current entity
      T entity = fetchEntity(client);

      // Update extension field
      Object extension = getExtension(entity);
      Map<String, Object> extensionMap =
          extension instanceof Map
              ? new HashMap<>((Map<String, Object>) extension)
              : new HashMap<>();

      if (clearAll) {
        extensionMap.clear();
      } else {
        // Apply property changes
        for (Map.Entry<String, Object> entry : properties.entrySet()) {
          if (entry.getValue() == null) {
            extensionMap.remove(entry.getKey());
          } else {
            extensionMap.put(entry.getKey(), entry.getValue());
          }
        }
      }

      // Set the updated extension
      setExtension(entity, extensionMap.isEmpty() ? null : extensionMap);

      // Update the entity
      return updateEntity(client, entity);
    }

    @SuppressWarnings("unchecked")
    private T fetchEntity(OpenMetadataClient client) {
      // Use reflection to call the appropriate finder method
      try {
        if (entityClass == Tables.class) {
          if (isFqn) {
            return (T) client.tables().getByName(identifier, "extension");
          } else {
            return (T) client.tables().get(identifier, "extension");
          }
        } else if (entityClass == Glossaries.class) {
          if (isFqn) {
            return (T) client.glossaries().getByName(identifier, "extension");
          } else {
            return (T) client.glossaries().get(identifier, "extension");
          }
        }
        // Add more entity types as needed

        throw new UnsupportedOperationException(
            "Entity type not supported: " + entityClass.getName());
      } catch (Exception e) {
        throw new RuntimeException("Failed to fetch entity", e);
      }
    }

    private Object getExtension(T entity) {
      try {
        var method = entity.getClass().getMethod("getExtension");
        return method.invoke(entity);
      } catch (Exception e) {
        LOG.warn("Failed to get extension field", e);
        return null;
      }
    }

    private void setExtension(T entity, Object extension) {
      try {
        var method = entity.getClass().getMethod("setExtension", Object.class);
        method.invoke(entity, extension);
      } catch (Exception e) {
        throw new RuntimeException("Failed to set extension field", e);
      }
    }

    @SuppressWarnings("unchecked")
    private T updateEntity(OpenMetadataClient client, T entity) {
      try {
        // Get entity ID and update
        var getIdMethod = entity.getClass().getMethod("getId");
        UUID entityId = (UUID) getIdMethod.invoke(entity);

        if (entity instanceof Table) {
          return (T) client.tables().update(entityId.toString(), (Table) entity);
        } else if (entity instanceof org.openmetadata.schema.entity.data.Glossary) {
          return (T)
              client
                  .glossaries()
                  .update(
                      entityId.toString(), (org.openmetadata.schema.entity.data.Glossary) entity);
        }
        // Add more entity types as needed

        throw new UnsupportedOperationException("Entity type not supported for update");
      } catch (Exception e) {
        throw new RuntimeException("Failed to update entity", e);
      }
    }

    private OpenMetadataClient getClient(Class<?> entityClass) {
      try {
        // Use reflection to get the default client from the entity class
        var method = entityClass.getDeclaredMethod("getClient");
        method.setAccessible(true);
        return (OpenMetadataClient) method.invoke(null);
      } catch (Exception e) {
        throw new RuntimeException("Failed to get OpenMetadata client", e);
      }
    }
  }
}

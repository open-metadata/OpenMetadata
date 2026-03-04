package org.openmetadata.sdk;

import java.lang.reflect.Method;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;

/**
 * Utility class for converting entities to EntityReference objects.
 *
 * <p>Use this when setting owners, domains, or other reference fields that expect EntityReference
 * objects rather than full entities.
 *
 * <p>Example usage:
 *
 * <pre>{@code
 * import org.openmetadata.sdk.EntityReferences;
 * import org.openmetadata.sdk.entities.Teams;
 * import org.openmetadata.sdk.entities.Users;
 *
 * Team team = Teams.getByName("engineering");
 * User user = Users.getByName("john.doe");
 *
 * database.setOwners(List.of(
 *     EntityReferences.from(team),
 *     EntityReferences.from(user)
 * ));
 * }</pre>
 */
public final class EntityReferences {

  private EntityReferences() {} // Prevent instantiation

  /**
   * Convert any entity to an EntityReference.
   *
   * @param entity The entity to convert (must have getId(), getName(), and getEntityType() or
   *     similar methods)
   * @return EntityReference containing id, type, name, and fullyQualifiedName
   * @throws IllegalArgumentException if the entity doesn't have required fields
   */
  public static EntityReference from(Object entity) {
    if (entity == null) {
      throw new IllegalArgumentException("Entity cannot be null");
    }

    UUID id = invokeGetter(entity, "getId", UUID.class);
    if (id == null) {
      throw new IllegalArgumentException("Entity must have an id (getId() returned null)");
    }

    String entityType = invokeGetter(entity, "getEntityType", String.class);
    if (entityType == null) {
      // Fallback: derive type from class name
      entityType = entity.getClass().getSimpleName().toLowerCase();
    }

    String name = invokeGetter(entity, "getName", String.class);
    String fqn = invokeGetter(entity, "getFullyQualifiedName", String.class);

    EntityReference ref = new EntityReference();
    ref.setId(id);
    ref.setType(entityType);
    if (name != null) {
      ref.setName(name);
    }
    if (fqn != null) {
      ref.setFullyQualifiedName(fqn);
    }

    return ref;
  }

  /**
   * Create an EntityReference directly from id and type.
   *
   * @param id The entity UUID
   * @param type The entity type (e.g., "team", "user", "database")
   * @return EntityReference with the specified id and type
   */
  public static EntityReference of(UUID id, String type) {
    EntityReference ref = new EntityReference();
    ref.setId(id);
    ref.setType(type);
    return ref;
  }

  /**
   * Create an EntityReference with id, type, and name.
   *
   * @param id The entity UUID
   * @param type The entity type (e.g., "team", "user", "database")
   * @param name The entity name
   * @return EntityReference with the specified fields
   */
  public static EntityReference of(UUID id, String type, String name) {
    EntityReference ref = new EntityReference();
    ref.setId(id);
    ref.setType(type);
    ref.setName(name);
    return ref;
  }

  @SuppressWarnings("unchecked")
  private static <T> T invokeGetter(Object obj, String methodName, Class<T> returnType) {
    try {
      Method method = obj.getClass().getMethod(methodName);
      Object result = method.invoke(obj);
      if (result == null) {
        return null;
      }
      if (returnType.isInstance(result)) {
        return (T) result;
      }
      // Handle cases where getter returns a wrapper type (e.g., UUID wrapper)
      return (T) result.toString();
    } catch (NoSuchMethodException e) {
      return null;
    } catch (Exception e) {
      throw new RuntimeException("Failed to invoke " + methodName + " on " + obj.getClass(), e);
    }
  }
}

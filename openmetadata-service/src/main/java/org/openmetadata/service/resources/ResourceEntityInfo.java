package org.openmetadata.service.resources;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;
import org.openmetadata.schema.EntityInterface;

@Getter
public class ResourceEntityInfo<T extends EntityInterface> {
  protected final Class<T> entityClass;
  protected final String entityType;
  protected final Set<String> allowedFields;

  public ResourceEntityInfo(String entityType, Class<T> entityClass) {
    this.entityType = entityType;
    this.entityClass = entityClass;
    this.allowedFields = getEntityFields(entityClass);
  }

  /**
   * Get list of all the entity field names from JsonPropertyOrder annotation from generated java class from entity.json
   */
  public static <T> Set<String> getEntityFields(Class<T> clz) {
    JsonPropertyOrder propertyOrder = clz.getAnnotation(JsonPropertyOrder.class);
    return new HashSet<>(Arrays.asList(propertyOrder.value()));
  }
}

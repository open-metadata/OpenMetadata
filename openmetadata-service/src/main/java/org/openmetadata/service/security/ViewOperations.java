package org.openmetadata.service.security;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * The view operations a read of {@code fields} needs, as each resource registers them: no field
 * needs ViewBasic, and a field no resource maps needs ViewAll. Every read path that returns
 * entity fields derives its check here, so a field cannot be cheaper to read through one endpoint
 * than through the entity's own GET (ADR:2026-11-03-every-read-path-checks-the-fields-it-returns).
 */
public final class ViewOperations {
  private static final List<MetadataOperation> VIEW_BASIC = List.of(MetadataOperation.VIEW_BASIC);
  private static final List<MetadataOperation> VIEW_ALL = List.of(MetadataOperation.VIEW_ALL);

  private ViewOperations() {}

  public static List<MetadataOperation> forFields(String entityType, Fields fields) {
    if (fields == null || fields.getFieldList().isEmpty()) {
      return VIEW_BASIC;
    }
    Map<String, MetadataOperation> fieldOperations = fieldOperations(entityType);
    Set<MetadataOperation> operations = new TreeSet<>();
    for (String field : fields.getFieldList()) {
      MetadataOperation operation = fieldOperations.get(field);
      if (operation == null) {
        return VIEW_ALL;
      }
      operations.add(operation);
    }
    return List.copyOf(operations);
  }

  private static Map<String, MetadataOperation> fieldOperations(String entityType) {
    try {
      return ResourceRegistry.getResourceFieldViewOperations(entityType);
    } catch (IllegalArgumentException e) {
      // A type no resource registered maps nothing, so every field needs ViewAll.
      return Map.of();
    }
  }
}

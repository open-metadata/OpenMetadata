package org.openmetadata.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourceDescriptor;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class ResourceRegistry {
  private static final List<ResourceDescriptor> RESOURCE_DESCRIPTORS = new ArrayList<>();
  public static final Map<String, MetadataOperation> FIELD_TO_EDIT_OPERATION_MAP = new HashMap<>();
  public static final Map<MetadataOperation, String> EDIT_OPERATION_TO_OPERATION_MAP = new HashMap<>();

  static {
    mapFieldOperation(MetadataOperation.EDIT_DESCRIPTION, Entity.FIELD_DESCRIPTION);
    mapFieldOperation(MetadataOperation.EDIT_DISPLAY_NAME, Entity.FIELD_DISPLAY_NAME);
    mapFieldOperation(MetadataOperation.EDIT_TAGS, Entity.FIELD_TAGS);
    mapFieldOperation(MetadataOperation.EDIT_OWNER, Entity.FIELD_OWNER);
    mapFieldOperation(MetadataOperation.EDIT_CUSTOM_FIELDS, "extension");
    mapFieldOperation(MetadataOperation.EDIT_USERS, "users");
    mapFieldOperation(MetadataOperation.EDIT_ROLE, "defaultRoles");
    mapFieldOperation(MetadataOperation.EDIT_ROLE, "roles");
    mapFieldOperation(MetadataOperation.EDIT_POLICY, "policies");
    // TODO tier, lineage, statues, reviewers, tests, queries, data profile, sample data
  }

  private ResourceRegistry() {}

  public static void initialize(List<ResourceDescriptor> resourceDescriptors) {
    RESOURCE_DESCRIPTORS.clear();
    RESOURCE_DESCRIPTORS.addAll(resourceDescriptors);
    RESOURCE_DESCRIPTORS.sort(Comparator.comparing(ResourceDescriptor::getName));
  }

  public static List<ResourceDescriptor> listResourceDescriptors() {
    return Collections.unmodifiableList(RESOURCE_DESCRIPTORS);
  }

  public static ResourceDescriptor getResourceDescriptor(String resourceType) {
    ResourceDescriptor rd =
        RESOURCE_DESCRIPTORS.stream().filter(r -> r.getName().equalsIgnoreCase(resourceType)).findAny().orElse(null);
    if (rd == null) {
      throw new IllegalArgumentException(CatalogExceptionMessage.resourceTypeNotFound(resourceType));
    }
    return rd;
  }

  /** Given an entity field name get the corresponding entity edit operation */
  public static MetadataOperation getEditOperation(String field) {
    return FIELD_TO_EDIT_OPERATION_MAP.get(field);
  }

  /** Given an edit operation get the corresponding entity field */
  public static String getField(MetadataOperation operation) {
    return EDIT_OPERATION_TO_OPERATION_MAP.get(operation);
  }

  public static String[] getEditableFields() {
    return FIELD_TO_EDIT_OPERATION_MAP.keySet().toArray(new String[0]);
  }

  private static void mapFieldOperation(MetadataOperation operation, String field) {
    FIELD_TO_EDIT_OPERATION_MAP.put(field, operation);
    EDIT_OPERATION_TO_OPERATION_MAP.put(operation, field);
  }
}

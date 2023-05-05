package org.openmetadata.service;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_OWNER;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourceDescriptor;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class ResourceRegistry {
  private static final List<ResourceDescriptor> RESOURCE_DESCRIPTORS = new ArrayList<>();
  public static final Map<String, MetadataOperation> FIELD_TO_EDIT_OPERATION_MAP = new HashMap<>();
  public static final Map<MetadataOperation, String> EDIT_OPERATION_TO_OPERATION_MAP = new HashMap<>();

  // Operations common to all the entities
  public static final List<MetadataOperation> COMMON_OPERATIONS =
      new ArrayList<>(
          listOf(
              MetadataOperation.CREATE,
              MetadataOperation.DELETE,
              MetadataOperation.VIEW_ALL,
              MetadataOperation.EDIT_ALL,
              MetadataOperation.EDIT_DESCRIPTION,
              MetadataOperation.EDIT_DISPLAY_NAME));

  static {
    mapFieldOperation(MetadataOperation.EDIT_DESCRIPTION, Entity.FIELD_DESCRIPTION);
    mapFieldOperation(MetadataOperation.EDIT_DISPLAY_NAME, Entity.FIELD_DISPLAY_NAME);
    mapFieldOperation(MetadataOperation.EDIT_TAGS, Entity.FIELD_TAGS);
    mapFieldOperation(MetadataOperation.EDIT_OWNER, FIELD_OWNER);
    mapFieldOperation(MetadataOperation.EDIT_CUSTOM_FIELDS, "extension");
    mapFieldOperation(MetadataOperation.EDIT_USERS, "users");
    mapFieldOperation(MetadataOperation.EDIT_ROLE, "defaultRoles");
    mapFieldOperation(MetadataOperation.EDIT_ROLE, "roles");
    mapFieldOperation(MetadataOperation.EDIT_POLICY, "policies");
    mapFieldOperation(MetadataOperation.EDIT_TEAMS, "teams");
    // TODO tier, lineage, statues, reviewers, tests, queries, data profile, sample data

    // Set up "all" resource descriptor that includes operations for all entities
    List<MetadataOperation> allOperations = Arrays.asList(MetadataOperation.values());
    Collections.sort(allOperations);
    RESOURCE_DESCRIPTORS.add(new ResourceDescriptor().withName("all").withOperations(allOperations));
  }

  private ResourceRegistry() {}

  public static void addResource(String resourceName, List<MetadataOperation> entitySpecificOperations) {
    // If resourceName already exists, then no need to add the resource again
    if (RESOURCE_DESCRIPTORS.stream().anyMatch(d -> d.getName().equals(resourceName))) {
      return;
    }
    Set<MetadataOperation> operations = new TreeSet<>(COMMON_OPERATIONS);
    if (!nullOrEmpty(entitySpecificOperations)) {
      operations.addAll(entitySpecificOperations);
    }
    ResourceDescriptor resourceDescriptor =
        new ResourceDescriptor().withName(resourceName).withOperations(new ArrayList<>(operations));
    RESOURCE_DESCRIPTORS.sort(Comparator.comparing(ResourceDescriptor::getName));
    RESOURCE_DESCRIPTORS.add(resourceDescriptor);
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

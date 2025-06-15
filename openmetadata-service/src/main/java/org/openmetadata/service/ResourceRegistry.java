package org.openmetadata.service;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
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
  protected static final Map<String, MetadataOperation> FIELD_TO_EDIT_OPERATION_MAP =
      new HashMap<>();
  protected static final Map<MetadataOperation, String> EDIT_OPERATION_TO_OPERATION_MAP =
      new EnumMap<>(MetadataOperation.class);

  // Operations common to all the entities
  protected static final List<MetadataOperation> COMMON_OPERATIONS =
      new ArrayList<>(
          listOf(
              MetadataOperation.CREATE,
              MetadataOperation.DELETE,
              MetadataOperation.VIEW_ALL,
              MetadataOperation.VIEW_BASIC,
              MetadataOperation.EDIT_ALL,
              MetadataOperation.EDIT_DESCRIPTION,
              MetadataOperation.EDIT_DISPLAY_NAME,
              MetadataOperation.EDIT_GLOSSARY_TERMS,
              MetadataOperation.EDIT_TIER));

  static {
    mapFieldOperation(MetadataOperation.EDIT_TAGS, Entity.FIELD_TAGS);
    mapFieldOperation(MetadataOperation.EDIT_OWNERS, Entity.FIELD_OWNERS);
    mapFieldOperation(MetadataOperation.EDIT_REVIEWERS, Entity.FIELD_REVIEWERS);
    mapFieldOperation(MetadataOperation.EDIT_CUSTOM_FIELDS, "extension");
    mapFieldOperation(MetadataOperation.EDIT_USERS, "users");
    mapFieldOperation(MetadataOperation.EDIT_ROLE, "defaultRoles");
    mapFieldOperation(MetadataOperation.EDIT_ROLE, "roles");
    mapFieldOperation(MetadataOperation.EDIT_POLICY, "policies");
    mapFieldOperation(MetadataOperation.EDIT_TEAMS, "teams");
    mapFieldOperation(MetadataOperation.EDIT_DESCRIPTION, Entity.FIELD_DESCRIPTION);
    mapFieldOperation(MetadataOperation.EDIT_DISPLAY_NAME, Entity.FIELD_DISPLAY_NAME);
    mapFieldOperation(MetadataOperation.EDIT_CERTIFICATION, Entity.FIELD_CERTIFICATION);

    // Set up "all" resource descriptor that includes operations for all entities
    List<MetadataOperation> allOperations = Arrays.asList(MetadataOperation.values());
    Collections.sort(allOperations);
    RESOURCE_DESCRIPTORS.add(
        new ResourceDescriptor().withName("all").withOperations(allOperations));
  }

  private ResourceRegistry() {}

  public static void addResource(
      String resourceName,
      List<MetadataOperation> entitySpecificOperations,
      Set<String> entityFields) {
    // If resourceName already exists, then no need to add the resource again
    if (RESOURCE_DESCRIPTORS.stream().anyMatch(d -> d.getName().equals(resourceName))) {
      return;
    }
    ResourceDescriptor resourceDescriptor =
        new ResourceDescriptor()
            .withName(resourceName)
            .withOperations(getOperations(entitySpecificOperations, new ArrayList<>(entityFields)));
    RESOURCE_DESCRIPTORS.sort(Comparator.comparing(ResourceDescriptor::getName));
    RESOURCE_DESCRIPTORS.add(resourceDescriptor);
  }

  private static List<MetadataOperation> getOperations(
      List<MetadataOperation> entitySpecificOperations, List<String> entityFields) {
    Set<MetadataOperation> operations = new TreeSet<>(COMMON_OPERATIONS);
    if (!nullOrEmpty(entitySpecificOperations)) {
      operations.addAll(entitySpecificOperations);
    }
    // Set up operations based on common fields present in an entity
    if (entityFields.contains(Entity.FIELD_TAGS)) {
      operations.add(MetadataOperation.EDIT_TAGS);
    }
    if (entityFields.contains(Entity.FIELD_OWNERS)) {
      operations.add(MetadataOperation.EDIT_OWNERS);
    }
    if (entityFields.contains(Entity.FIELD_EXTENSION)) {
      operations.add(MetadataOperation.EDIT_CUSTOM_FIELDS);
    }
    if (entityFields.contains("roles") || entityFields.contains("defaultRoles")) {
      operations.add(MetadataOperation.EDIT_ROLE);
    }
    if (entityFields.contains("reviewers")) {
      operations.add(MetadataOperation.EDIT_REVIEWERS);
    }
    if (entityFields.contains(Entity.FIELD_CERTIFICATION)) {
      operations.add(MetadataOperation.EDIT_CERTIFICATION);
    }
    return new ArrayList<>(operations);
  }

  public static List<ResourceDescriptor> listResourceDescriptors() {
    return Collections.unmodifiableList(RESOURCE_DESCRIPTORS);
  }

  public static ResourceDescriptor getResourceDescriptor(String resourceType) {
    ResourceDescriptor rd =
        RESOURCE_DESCRIPTORS.stream()
            .filter(r -> r.getName().equalsIgnoreCase(resourceType))
            .findAny()
            .orElse(null);
    if (rd == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.resourceTypeNotFound(resourceType));
    }
    return rd;
  }

  /** Given an entity field name get the corresponding entity edit operation */
  public static MetadataOperation getEditOperation(String field) {
    return FIELD_TO_EDIT_OPERATION_MAP.get(field);
  }

  public static boolean hasEditOperation(String field) {
    return FIELD_TO_EDIT_OPERATION_MAP.containsKey(field);
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

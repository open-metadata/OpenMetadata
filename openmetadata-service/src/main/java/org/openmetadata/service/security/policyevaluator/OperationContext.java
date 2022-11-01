package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.List;
import javax.json.JsonPatch;
import lombok.Getter;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.util.JsonPatchUtils;

/** OperationContext for Access Control Policy */
@Slf4j
public class OperationContext {
  @Getter @NonNull private final String resource;
  List<MetadataOperation> operations; // All requested operations
  @Getter private JsonPatch patch;

  public OperationContext(@NonNull String resource, MetadataOperation... operations) {
    this.resource = resource;
    this.operations = new ArrayList<>();
    this.operations.addAll(List.of(operations));
  }

  public OperationContext(@NonNull String resource, JsonPatch patch) {
    this.resource = resource;
    this.patch = patch;
  }

  public List<MetadataOperation> getOperations() {
    // Lazy resolve patch operations
    if (operations != null) {
      return operations;
    }
    if (patch != null) { // Lazy initialize operations for PATCH
      operations = new ArrayList<>();
      operations.addAll(JsonPatchUtils.getMetadataOperations(patch));
    }
    return operations;
  }

  public static List<MetadataOperation> getAllOperations(MetadataOperation... exclude) {
    return getOperations("", exclude);
  }

  public static boolean isEditOperation(MetadataOperation operation) {
    return operation.value().startsWith("Edit");
  }

  public static boolean isViewOperation(MetadataOperation operation) {
    return operation.value().startsWith("View");
  }

  public static List<MetadataOperation> getViewOperations(MetadataOperation... exclude) {
    return getOperations("View", exclude);
  }

  private static List<MetadataOperation> getOperations(String startsWith, MetadataOperation... exclude) {
    List<MetadataOperation> list = new ArrayList<>();
    List<MetadataOperation> excludeList = new ArrayList<>(List.of(exclude));
    if (!excludeList.isEmpty()) {
      excludeList.add(MetadataOperation.ALL); // If any operation is excluded then 'All' operation is excluded
    }
    for (MetadataOperation operation : MetadataOperation.values()) {
      if (!excludeList.contains(operation) && operation.value().startsWith(startsWith)) {
        list.add(operation);
      }
    }
    return list;
  }
}

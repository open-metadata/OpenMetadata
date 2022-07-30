package org.openmetadata.catalog.security.policyevaluator;

import java.util.ArrayList;
import java.util.List;
import javax.json.JsonPatch;
import lombok.Getter;
import lombok.NonNull;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.util.JsonPatchUtils;

/** OperationContext for Access Control Policy */
public class OperationContext {
  @Getter @NonNull private final String resource;
  List<MetadataOperation> operations;
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

  public boolean isEditOperation() {
    for (MetadataOperation operation : operations) {
      if (!operation.value().startsWith("Edit")) {
        return false;
      }
    }
    return true;
  }

  public boolean isViewOperation() {
    for (MetadataOperation operation : operations) {
      if (!operation.value().startsWith("View")) {
        return false;
      }
    }
    return true;
  }
}

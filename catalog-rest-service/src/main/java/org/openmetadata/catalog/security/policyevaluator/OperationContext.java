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
  @NonNull private final List<MetadataOperation> operations = new ArrayList<>();
  @Getter private JsonPatch patch;

  public OperationContext(String resource, MetadataOperation... operations) {
    this.resource = resource;
    this.operations.addAll(List.of(operations));
  }

  public OperationContext(String resource, JsonPatch patch) {
    this.resource = resource;
    this.patch = patch;
  }

  public List<MetadataOperation> getOperations() {
    // Lazy resolve patch operations
    if (patch != null) {
      operations.addAll(JsonPatchUtils.getMetadataOperations(patch));
    }
    return operations;
  }
}

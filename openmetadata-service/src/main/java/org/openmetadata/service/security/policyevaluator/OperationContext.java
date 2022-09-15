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

  public void allowAll() {
    LOG.debug("allowAll operations");
    operations.clear();
  }

  public void allowViewAll() {
    LOG.debug("allowViewAll operations");
    operations.removeIf(OperationContext::isViewOperation);
  }

  public void allowEditAll() {
    LOG.debug("allowEditAll operations");
    operations.removeIf(OperationContext::isEditOperation);
  }

  public static boolean isEditOperation(MetadataOperation operation) {
    return operation.value().startsWith("Edit");
  }

  public static boolean isViewOperation(MetadataOperation operation) {
    return operation.value().startsWith("View");
  }
}

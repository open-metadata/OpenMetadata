package org.openmetadata.service.security.policyevaluator;

import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.util.JsonPatchUtils;

/** OperationContext for Access Control Policy */
@Slf4j
public class OperationContext {
  @Getter @NonNull private final String resource;
  // Working list of requested operations. Policy evaluation drains granted operations from this
  // list via iterator.remove() to track what remains ungranted; an empty list means everything was
  // allowed. Because the drain is destructive, this list MUST NOT be reused across authorization
  // decisions without calling {@link #resetOperations()} first.
  List<MetadataOperation> operations;
  // Immutable snapshot of the originally requested operations, used by {@link #resetOperations()}
  // to restore the working list so a reused context evaluates each decision against the full set.
  private List<MetadataOperation> requestedOperations;
  @Getter private JsonPatch patch;

  public OperationContext(@NonNull String resource, MetadataOperation... operations) {
    this.resource = resource;
    this.requestedOperations = List.of(operations);
    this.operations = new ArrayList<>(this.requestedOperations);
  }

  public OperationContext(@NonNull String resource, JsonPatch patch) {
    this.resource = resource;
    this.patch = patch;
  }

  public List<MetadataOperation> getOperations(ResourceContextInterface resourceContext) {
    // Lazy resolve patch operations
    if (operations != null) {
      return operations;
    }
    if (patch != null) { // Lazy initialize operations for PATCH
      requestedOperations =
          List.copyOf(JsonPatchUtils.getMetadataOperations(resourceContext, patch));
      operations = new ArrayList<>(requestedOperations);
      LOG.debug("Lazy initializing operations to {}", Arrays.toString(operations.toArray()));
    }
    return operations;
  }

  /**
   * Restores the working operations list to the originally requested operations.
   *
   * <p>Policy evaluation drains granted operations from {@link #operations} to track what remains
   * ungranted, and an empty list makes {@link PolicyEvaluator#hasPermission} skip deny evaluation
   * and pass its final check vacuously. Reusing one OperationContext across decisions without a
   * reset therefore lets the first success drain the list and every later decision authorize
   * without evaluating any deny rule - an authorization bypass. {@link
   * PolicyEvaluator#hasPermission} calls this before every evaluation so a reused context is safe.
   */
  void resetOperations() {
    if (requestedOperations != null) {
      operations = new ArrayList<>(requestedOperations);
    }
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

  private static List<MetadataOperation> getOperations(
      String startsWith, MetadataOperation... exclude) {
    List<MetadataOperation> list = CommonUtil.listOf(MetadataOperation.values());
    return getOperations(list, startsWith, exclude);
  }

  public static List<MetadataOperation> getOperations(
      String entityType, String startsWith, MetadataOperation... exclude) {
    List<MetadataOperation> list =
        ResourceRegistry.getResourceDescriptor(entityType).getOperations();
    return getOperations(list, startsWith, exclude);
  }

  private static List<MetadataOperation> getOperations(
      List<MetadataOperation> list, String startsWith, MetadataOperation... exclude) {
    List<MetadataOperation> excludeList = CommonUtil.listOf(exclude);
    if (!excludeList.isEmpty()) {
      list.remove(
          MetadataOperation
              .ALL); // If any operation is excluded then 'All' operation is also excluded
    }

    for (MetadataOperation e : excludeList) {
      list.remove(e);
      if (isViewOperation(e)) { // Any view operation is excluded, then 'VIEW_ALL' is also excluded
        list.remove(MetadataOperation.VIEW_ALL);
      } else if (isEditOperation(
          e)) { // Any edit operation is excluded, then 'EDIT_ALL' is also excluded
        list.remove(MetadataOperation.EDIT_ALL);
      }
    }
    // Only include operation name that starts with given string filter out the others
    return list.stream()
        .filter(operation -> operation.value().startsWith(startsWith))
        .collect(Collectors.toList());
  }
}

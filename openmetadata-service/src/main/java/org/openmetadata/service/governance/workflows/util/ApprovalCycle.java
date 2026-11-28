/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.governance.workflows.util;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;

import java.util.List;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.UUID;
import java.util.function.DoubleSupplier;
import java.util.stream.DoubleStream;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

/** Where an approval cycle begins when its tasks supersede one another. */
public final class ApprovalCycle {
  public static final String REVIEWED_RANGE_VARIABLE = "approvalCycleReviewedRange";

  private ApprovalCycle() {}

  /**
   * The earliest recorded start, including the edit that triggered this run. For a task from an
   * older server without a start, the triggering edit's predecessor still suffices. When no
   * start can be found, use the predecessor of the latest edit.
   */
  public static double baseVersion(
      OptionalDouble triggeringBase, List<Double> carriedBases, DoubleSupplier unknownBase) {
    return DoubleStream.concat(
            triggeringBase.stream(), carriedBases.stream().mapToDouble(Double::doubleValue))
        .min()
        .orElseGet(unknownBase);
  }

  /** The exact history interval the approval task displayed. */
  public record ReviewedRange(UUID entityId, double base, double tip, Long tipUpdatedAt) {
    ReviewedRange(double base, double tip) {
      this(null, base, tip, null);
    }
  }

  public static void recordReviewedRange(WorkflowVariableHandler variables, ReviewedRange range) {
    String value = JsonUtils.pojoToJson(range);
    String node = variables.getNodeNamespace();
    if (node != null) {
      variables.setNamespacedVariable(node, REVIEWED_RANGE_VARIABLE, value);
    }
    variables.setGlobalVariable(REVIEWED_RANGE_VARIABLE, value);
  }

  public static Optional<ReviewedRange> reviewedRange(
      WorkflowVariableHandler variables, String approvalNode, UUID entityId) {
    String namespace = approvalNode == null ? GLOBAL_NAMESPACE : approvalNode;
    return rangeFor(variables.getNamespacedVariable(namespace, REVIEWED_RANGE_VARIABLE), entityId)
        .or(
            () ->
                rangeFor(
                    variables.getNamespacedVariable(GLOBAL_NAMESPACE, REVIEWED_RANGE_VARIABLE),
                    entityId));
  }

  public static Optional<ReviewedRange> rangeFor(Object variable, UUID entityId) {
    return variable instanceof String json
        ? Optional.ofNullable(JsonUtils.readValue(json, ReviewedRange.class))
            .filter(range -> entityId.equals(range.entityId()))
        : Optional.empty();
  }
}

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

package org.openmetadata.service.governance.approval;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeRef;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;

/**
 * A change applies when every approving decision selects it and no decision rejects it. All other
 * changes are discarded. Decisions without change lists cover the whole revision; an administrator
 * override applies everything.
 */
public record ChangeSelection(List<MutationOp> approved, List<MutationOp> rejected) {

  public static ChangeSelection of(
      List<MutationOp> ops, List<ApprovalDecision> decisions, String requester) {
    List<ApprovalDecision> reviews =
        decisions.stream()
            .filter(
                d ->
                    d.getDecision() == DecisionType.OVERRIDE || !d.getDecidedBy().equals(requester))
            .toList();
    boolean overridden = reviews.stream().anyMatch(d -> d.getDecision() == DecisionType.OVERRIDE);
    List<ApprovalDecision> approvals =
        reviews.stream().filter(d -> d.getDecision() == DecisionType.APPROVE).toList();
    List<MutationOp> approved = new ArrayList<>();
    List<MutationOp> rejected = new ArrayList<>();
    for (MutationOp op : ops) {
      String target = MutationPlanner.targetOf(op);
      boolean rejectedByAny = reviews.stream().anyMatch(d -> rejects(d, target));
      boolean approvedByAll =
          !approvals.isEmpty() && approvals.stream().allMatch(d -> approves(d, target));
      if (overridden || (approvedByAll && !rejectedByAny)) {
        approved.add(op);
      } else {
        rejected.add(op);
      }
    }
    return new ChangeSelection(List.copyOf(approved), List.copyOf(rejected));
  }

  /** Whether some changes were approved while others were discarded. */
  public boolean partial() {
    return !approved.isEmpty() && !rejected.isEmpty();
  }

  /** The changes as a reviewer reads them, for example {@code description, tags PII.Sensitive}. */
  public static String describe(List<MutationOp> ops) {
    return ops.stream()
        .map(
            op ->
                op.getKey() == null ? op.getField() : "%s %s".formatted(op.getField(), op.getKey()))
        .collect(Collectors.joining(", "));
  }

  private static boolean approves(ApprovalDecision decision, String target) {
    boolean wholeRevision =
        nullOrEmpty(decision.getApprovedChanges()) && nullOrEmpty(decision.getRejectedChanges());
    return wholeRevision || covers(decision.getApprovedChanges(), target);
  }

  private static boolean rejects(ApprovalDecision decision, String target) {
    return decision.getDecision() == DecisionType.REJECT
        || (decision.getRejectedChanges() != null && covers(decision.getRejectedChanges(), target));
  }

  private static boolean covers(List<ChangeRef> changes, String target) {
    return !nullOrEmpty(changes)
        && changes.stream()
            .anyMatch(
                change ->
                    MutationPlanner.targetOf(change.getField(), change.getKey()).equals(target));
  }
}

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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.ReviewPolicy;

/**
 * Changes whose reviewers can no longer agree. A change still pending is out of reach once the
 * reviewers who have not voted on it could not bring either its approvals or its rejections to
 * their threshold, for example two reviewers who must both agree and voted one each way. Such a
 * change is not published; review of the rest of the request goes on.
 */
final class ReviewDisagreement {
  private ReviewDisagreement() {}

  /**
   * The pending changes of {@code selection} out of reach, given the reviewers who can vote on the
   * request. A change nobody voted on is never out of reach, and without known reviewers nothing
   * is, so a task whose assignees cannot be read keeps waiting rather than dropping changes.
   */
  static List<MutationOp> outOfReach(
      ChangeSelection selection,
      List<ApprovalDecision> decisions,
      ReviewPolicy policy,
      Set<String> reviewers,
      String requester) {
    List<ApprovalDecision> reviews =
        decisions.stream().filter(d -> !requester.equals(d.getDecidedBy())).toList();
    return reviewers.isEmpty()
        ? List.of()
        : selection.pending().stream()
            .filter(op -> outOfReach(op, reviews, policy, reviewers, requester))
            .toList();
  }

  private static boolean outOfReach(
      MutationOp op,
      List<ApprovalDecision> reviews,
      ReviewPolicy policy,
      Set<String> reviewers,
      String requester) {
    String target = MutationPlanner.targetOf(op);
    Set<String> approvers = ChangeSelection.voters(reviews, target, DecisionType.APPROVE);
    Set<String> rejecters = ChangeSelection.voters(reviews, target, DecisionType.REJECT);
    Set<String> undecided = new HashSet<>(reviewers);
    undecided.remove(requester);
    undecided.removeAll(approvers);
    undecided.removeAll(rejecters);
    boolean voted = !approvers.isEmpty() || !rejecters.isEmpty();
    return voted
        && approvers.size() + undecided.size() < ChangeSelection.approvalThreshold(policy)
        && rejecters.size() + undecided.size() < ChangeSelection.rejectionThreshold(policy);
  }

  /**
   * What happened to the changes, as the review task's comment reads it, for example {@code
   * Reviewers could not agree on description (approved: karan; rejected: sonika), so it is not
   * published.}
   */
  static String describe(List<MutationOp> ops, List<ApprovalDecision> decisions, String requester) {
    List<ApprovalDecision> reviews =
        decisions.stream().filter(d -> !requester.equals(d.getDecidedBy())).toList();
    String changes =
        ops.stream()
            .map(
                op -> {
                  String target = MutationPlanner.targetOf(op);
                  return "%s (approved: %s; rejected: %s)"
                      .formatted(
                          ChangeSelection.describe(List.of(op)),
                          names(ChangeSelection.voters(reviews, target, DecisionType.APPROVE)),
                          names(ChangeSelection.voters(reviews, target, DecisionType.REJECT)));
                })
            .collect(Collectors.joining(", "));
    return "Reviewers could not agree on %s, so %s not published."
        .formatted(changes, ops.size() == 1 ? "it is" : "they are");
  }

  private static String names(Set<String> users) {
    return users.isEmpty() ? "nobody" : String.join(", ", users);
  }
}

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
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeRef;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.ReviewPolicy;

/**
 * Where each change of a revision stands, from the decisions recorded on it, the changes it
 * already published and the ones another change published: applied, already published elsewhere,
 * agreed and ready to apply, rejected, or still pending.
 *
 * <p>A change is rejected once as many reviewers as the rejection threshold reject it, and agreed
 * once as many reviewers as the approval threshold approve it. Until then it stays pending, also
 * when reviewers disagree, until the reviewers left cannot reach either threshold. A change its
 * reviewers can no longer agree on, or whose field was published with another value after
 * submission, is dropped like a rejected one. A decision without change lists covers every change, the requester's
 * own decisions never count, and an administrator override approves every change still open; it
 * never publishes a change its reviewers rejected.
 */
public record ChangeSelection(
    List<MutationOp> applied,
    List<MutationOp> publishedElsewhere,
    List<MutationOp> toApply,
    List<MutationOp> rejected,
    List<MutationOp> pending) {

  public static ChangeSelection of(
      List<MutationOp> ops,
      List<ApprovalDecision> decisions,
      String requester,
      ReviewPolicy policy,
      Set<String> appliedTargets,
      Set<String> publishedElsewhereTargets,
      Set<String> droppedTargets) {
    List<ApprovalDecision> reviews =
        decisions.stream().filter(d -> !requester.equals(d.getDecidedBy())).toList();
    boolean overridden = decisions.stream().anyMatch(d -> d.getDecision() == DecisionType.OVERRIDE);
    List<MutationOp> applied = new ArrayList<>();
    List<MutationOp> publishedElsewhere = new ArrayList<>();
    List<MutationOp> toApply = new ArrayList<>();
    List<MutationOp> rejected = new ArrayList<>();
    List<MutationOp> pending = new ArrayList<>();
    for (MutationOp op : ops) {
      String target = MutationPlanner.targetOf(op);
      if (appliedTargets.contains(target)) {
        applied.add(op);
      } else if (publishedElsewhereTargets.contains(target)) {
        publishedElsewhere.add(op);
      } else if (droppedTargets.contains(target)
          || reviewers(reviews, target, DecisionType.REJECT) >= rejectionThreshold(policy)) {
        rejected.add(op);
      } else if (overridden) {
        toApply.add(op);
      } else if (reviewers(reviews, target, DecisionType.APPROVE) >= approvalThreshold(policy)) {
        toApply.add(op);
      } else {
        pending.add(op);
      }
    }
    return new ChangeSelection(
        List.copyOf(applied),
        List.copyOf(publishedElsewhere),
        List.copyOf(toApply),
        List.copyOf(rejected),
        List.copyOf(pending));
  }

  /**
   * The selection once review has ended: changes still waiting for a decision are dropped with the
   * rejected ones.
   */
  public ChangeSelection closed() {
    return new ChangeSelection(
        applied,
        publishedElsewhere,
        toApply,
        Stream.concat(rejected.stream(), pending.stream()).toList(),
        List.of());
  }

  /** Changes neither published nor dropped yet. */
  public List<MutationOp> open() {
    return Stream.concat(toApply.stream(), pending.stream()).toList();
  }

  /** Whether every change is published, dropped, or agreed and only waiting to be published. */
  public boolean settled() {
    return pending.isEmpty();
  }

  /** Whether any change of the revision was approved, published or not. */
  public boolean anyApproved() {
    return !applied.isEmpty() || !toApply.isEmpty();
  }

  /** The changes as a reviewer reads them, for example {@code description, tags PII.Sensitive}. */
  public static String describe(List<MutationOp> ops) {
    return ops.stream().map(ChangeNames::of).collect(Collectors.joining(", "));
  }

  public static Set<String> refTargets(List<ChangeRef> refs) {
    Set<String> targets = new HashSet<>();
    if (refs != null) {
      refs.forEach(ref -> targets.add(MutationPlanner.targetOf(ref.getField(), ref.getKey())));
    }
    return targets;
  }

  public static Set<String> targets(List<MutationOp> ops) {
    Set<String> targets = new HashSet<>();
    ops.forEach(op -> targets.add(MutationPlanner.targetOf(op)));
    return targets;
  }

  static int approvalThreshold(ReviewPolicy policy) {
    return policy == null || policy.getApprovalThreshold() == null
        ? 1
        : policy.getApprovalThreshold();
  }

  static int rejectionThreshold(ReviewPolicy policy) {
    return policy == null || policy.getRejectionThreshold() == null
        ? 1
        : policy.getRejectionThreshold();
  }

  static boolean partialDecisions(ReviewPolicy policy) {
    return policy != null && Boolean.TRUE.equals(policy.getPartialDecisions());
  }

  // Distinct reviewers whose decisions give the change this verdict.
  private static long reviewers(
      List<ApprovalDecision> reviews, String target, DecisionType verdict) {
    return voters(reviews, target, verdict).size();
  }

  /** The reviewers whose decisions give the change {@code target} this verdict. */
  static Set<String> voters(List<ApprovalDecision> reviews, String target, DecisionType verdict) {
    return reviews.stream()
        .filter(d -> gives(d, target, verdict))
        .map(ApprovalDecision::getDecidedBy)
        .collect(Collectors.toCollection(TreeSet::new));
  }

  private static boolean gives(ApprovalDecision decision, String target, DecisionType verdict) {
    boolean wholeRevision =
        nullOrEmpty(decision.getApprovedChanges()) && nullOrEmpty(decision.getRejectedChanges());
    boolean gives;
    if (wholeRevision) {
      gives = decision.getDecision() == verdict;
    } else {
      List<ChangeRef> changes =
          verdict == DecisionType.APPROVE
              ? decision.getApprovedChanges()
              : decision.getRejectedChanges();
      gives = !nullOrEmpty(changes) && covers(changes, target);
    }
    return gives;
  }

  private static boolean covers(List<ChangeRef> changes, String target) {
    return changes.stream()
        .anyMatch(
            change -> MutationPlanner.targetOf(change.getField(), change.getKey()).equals(target));
  }
}

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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeRef;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.MutationOpType;
import org.openmetadata.schema.governance.changeRequest.ReviewPolicy;
import org.openmetadata.schema.utils.JsonUtils;

class ChangeSelectionTest {
  private static final String REQUESTER = "ram";
  private static final MutationOp DESCRIPTION =
      new MutationOp().withOp(MutationOpType.SET).withField("description").withValue("\"new\"");
  private static final MutationOp TAG =
      new MutationOp().withOp(MutationOpType.ADD).withField("tags").withKey("PII.Sensitive");
  private static final List<MutationOp> OPS = List.of(DESCRIPTION, TAG);
  private static final ReviewPolicy ONE_REVIEWER =
      new ReviewPolicy().withApprovalThreshold(1).withRejectionThreshold(1);
  private static final ReviewPolicy TWO_REVIEWERS =
      new ReviewPolicy().withApprovalThreshold(2).withRejectionThreshold(2);

  private static ApprovalDecision whole(String by, DecisionType type) {
    return new ApprovalDecision().withId(UUID.randomUUID()).withDecidedBy(by).withDecision(type);
  }

  private static ApprovalDecision changes(
      String by, List<MutationOp> approved, List<MutationOp> rejected) {
    return whole(by, approved.isEmpty() ? DecisionType.REJECT : DecisionType.APPROVE)
        .withApprovedChanges(approved.isEmpty() ? null : refs(approved))
        .withRejectedChanges(rejected.isEmpty() ? null : refs(rejected));
  }

  private static List<ChangeRef> refs(List<MutationOp> ops) {
    return ops.stream()
        .map(op -> new ChangeRef().withField(op.getField()).withKey(op.getKey()))
        .toList();
  }

  private static ChangeSelection select(
      ReviewPolicy policy, Set<String> published, ApprovalDecision... decisions) {
    return ChangeSelection.of(
        OPS, List.of(decisions), REQUESTER, policy, published, Set.of(), Set.of());
  }

  @Test
  void aChangeAnotherChangePublishedLeavesTheReviewAndTheRestStaysOpen() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS,
            List.of(),
            REQUESTER,
            ONE_REVIEWER,
            Set.of(),
            Set.of(MutationPlanner.targetOf(TAG)),
            Set.of());
    assertEquals(List.of(TAG), selection.publishedElsewhere());
    assertEquals(List.of(DESCRIPTION), selection.open());
    assertFalse(selection.anyApproved());
  }

  @Test
  void aChangePublishedElsewhereIsNotRejectedByEarlierVotes() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS,
            List.of(changes("karan", List.of(), List.of(TAG))),
            REQUESTER,
            ONE_REVIEWER,
            Set.of(),
            Set.of(MutationPlanner.targetOf(TAG)),
            Set.of());
    assertEquals(List.of(TAG), selection.publishedElsewhere());
    assertTrue(selection.rejected().isEmpty());
  }

  @Test
  void aChangeItsReviewersCouldNotAgreeOnIsDroppedLikeARejectedOne() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS,
            List.of(),
            REQUESTER,
            TWO_REVIEWERS,
            Set.of(),
            Set.of(),
            Set.of(MutationPlanner.targetOf(DESCRIPTION)));
    assertEquals(List.of(DESCRIPTION), selection.rejected());
    assertEquals(List.of(TAG), selection.pending());
  }

  @Test
  void anOverrideNeverPublishesAChangeItsReviewersRejected() {
    ChangeSelection selection =
        select(
            ONE_REVIEWER,
            Set.of(),
            changes("karan", List.of(), List.of(TAG)),
            whole("admin", DecisionType.OVERRIDE));
    assertEquals(List.of(DESCRIPTION), selection.toApply());
    assertEquals(List.of(TAG), selection.rejected());
  }

  @Test
  void aClosedReviewDropsTheChangesNobodyDecided() {
    ChangeSelection closed =
        select(TWO_REVIEWERS, Set.of(), changes("karan", List.of(TAG), List.of())).closed();
    assertTrue(closed.settled());
    assertTrue(closed.toApply().isEmpty());
    assertEquals(OPS, closed.rejected());
  }

  @Test
  void aWholeRevisionApprovalAgreesOnEveryChange() {
    ChangeSelection selection =
        select(ONE_REVIEWER, Set.of(), whole("karan", DecisionType.APPROVE));
    assertEquals(OPS, selection.toApply());
    assertTrue(selection.settled());
  }

  @Test
  void aWholeRevisionRejectionRejectsEveryChange() {
    ChangeSelection selection = select(ONE_REVIEWER, Set.of(), whole("karan", DecisionType.REJECT));
    assertEquals(OPS, selection.rejected());
    assertFalse(selection.anyApproved());
  }

  @Test
  void aChangeLeftUndecidedStaysPending() {
    ChangeSelection selection =
        select(ONE_REVIEWER, Set.of(), changes("karan", List.of(TAG), List.of()));
    assertEquals(List.of(TAG), selection.toApply());
    assertEquals(List.of(DESCRIPTION), selection.pending());
    assertFalse(selection.settled());
  }

  @Test
  void aPublishedChangeIsAppliedAndNoLongerOpen() {
    ChangeSelection selection =
        select(
            ONE_REVIEWER,
            ChangeSelection.targets(List.of(TAG)),
            changes("karan", List.of(TAG), List.of()));
    assertEquals(List.of(TAG), selection.applied());
    assertEquals(List.of(DESCRIPTION), selection.open());
  }

  @Test
  void withTwoReviewersAChangeNeedsBothApprovals() {
    ChangeSelection oneVote =
        select(TWO_REVIEWERS, Set.of(), changes("karan", List.of(TAG, DESCRIPTION), List.of()));
    assertTrue(oneVote.toApply().isEmpty());
    ChangeSelection bothVotes =
        select(
            TWO_REVIEWERS,
            Set.of(),
            changes("karan", List.of(TAG, DESCRIPTION), List.of()),
            changes("admin", List.of(TAG), List.of()));
    assertEquals(List.of(TAG), bothVotes.toApply());
    assertEquals(List.of(DESCRIPTION), bothVotes.pending());
  }

  @Test
  void reviewersWhoDisagreeLeaveTheChangePendingUntilTheRejectionThreshold() {
    ChangeSelection disputed =
        select(
            TWO_REVIEWERS,
            Set.of(),
            changes("karan", List.of(TAG), List.of()),
            changes("admin", List.of(), List.of(TAG)));
    assertEquals(List.of(DESCRIPTION, TAG), disputed.pending());
    ChangeSelection rejected =
        select(
            TWO_REVIEWERS,
            Set.of(),
            changes("karan", List.of(), List.of(TAG)),
            changes("admin", List.of(), List.of(TAG)));
    assertEquals(List.of(TAG), rejected.rejected());
  }

  @Test
  void aReviewerDecidingInSeveralStepsCountsOnce() {
    ChangeSelection selection =
        select(
            TWO_REVIEWERS,
            Set.of(),
            changes("karan", List.of(TAG), List.of()),
            changes("karan", List.of(DESCRIPTION), List.of()));
    assertTrue(selection.toApply().isEmpty());
    assertEquals(OPS, selection.pending());
  }

  @Test
  void decisionsReadBackFromStorageKeepTheirMeaning() {
    ApprovalDecision stored =
        JsonUtils.readValue(
            JsonUtils.pojoToJson(changes("karan", List.of(TAG), List.of())),
            ApprovalDecision.class);
    ApprovalDecision storedWhole =
        JsonUtils.readValue(
            JsonUtils.pojoToJson(whole("admin", DecisionType.APPROVE)), ApprovalDecision.class);
    assertEquals(List.of(TAG), select(ONE_REVIEWER, Set.of(), stored).toApply());
    assertEquals(OPS, select(ONE_REVIEWER, Set.of(), storedWhole).toApply());
  }

  @Test
  void theRequestersOwnDecisionIsIgnoredAndAnOverrideApprovesEverythingOpen() {
    assertTrue(
        select(ONE_REVIEWER, Set.of(), whole(REQUESTER, DecisionType.APPROVE)).toApply().isEmpty());
    assertEquals(
        List.of(DESCRIPTION),
        select(
                ONE_REVIEWER,
                ChangeSelection.targets(List.of(TAG)),
                whole("admin", DecisionType.OVERRIDE))
            .toApply());
  }

  @Test
  void describeNamesFieldsAndElements() {
    assertEquals("description, tags PII.Sensitive", ChangeSelection.describe(OPS));
  }
}

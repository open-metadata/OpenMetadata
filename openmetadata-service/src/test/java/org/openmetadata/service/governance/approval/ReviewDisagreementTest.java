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

class ReviewDisagreementTest {
  private static final String REQUESTER = "ram";
  private static final MutationOp DESCRIPTION =
      new MutationOp().withOp(MutationOpType.SET).withField("description").withValue("\"new\"");
  private static final MutationOp TAG =
      new MutationOp().withOp(MutationOpType.ADD).withField("tags").withKey("PII.Sensitive");
  private static final List<MutationOp> OPS = List.of(DESCRIPTION, TAG);
  private static final ReviewPolicy BOTH_MUST_AGREE =
      new ReviewPolicy().withApprovalThreshold(2).withRejectionThreshold(2);
  private static final Set<String> TWO_REVIEWERS = Set.of("karan", "sonika");

  private static ApprovalDecision vote(String by, DecisionType type, MutationOp op) {
    ChangeRef ref = new ChangeRef().withField(op.getField()).withKey(op.getKey());
    return new ApprovalDecision()
        .withId(UUID.randomUUID())
        .withDecidedBy(by)
        .withDecision(type)
        .withApprovedChanges(type == DecisionType.APPROVE ? List.of(ref) : null)
        .withRejectedChanges(type == DecisionType.REJECT ? List.of(ref) : null);
  }

  private static List<MutationOp> outOfReach(Set<String> reviewers, ApprovalDecision... votes) {
    List<ApprovalDecision> decisions = List.of(votes);
    ChangeSelection selection =
        ChangeSelection.of(
            OPS, decisions, REQUESTER, BOTH_MUST_AGREE, Set.of(), Set.of(), Set.of());
    return ReviewDisagreement.outOfReach(
        selection, decisions, BOTH_MUST_AGREE, reviewers, REQUESTER);
  }

  @Test
  void twoReviewersWhoMustBothAgreeAndVoteOppositeWaysCannotAgree() {
    assertEquals(
        List.of(DESCRIPTION),
        outOfReach(
            TWO_REVIEWERS,
            vote("karan", DecisionType.APPROVE, DESCRIPTION),
            vote("sonika", DecisionType.REJECT, DESCRIPTION)));
  }

  @Test
  void aChangeAReviewerStillHasToVoteOnCanStillBeAgreed() {
    assertTrue(
        outOfReach(TWO_REVIEWERS, vote("karan", DecisionType.APPROVE, DESCRIPTION)).isEmpty());
  }

  @Test
  void aThirdReviewerKeepsASplitChangeOpen() {
    assertTrue(
        outOfReach(
                Set.of("karan", "sonika", "priya"),
                vote("karan", DecisionType.APPROVE, DESCRIPTION),
                vote("sonika", DecisionType.REJECT, DESCRIPTION))
            .isEmpty());
  }

  @Test
  void withoutKnownReviewersNothingIsDropped() {
    assertTrue(
        outOfReach(
                Set.of(),
                vote("karan", DecisionType.APPROVE, DESCRIPTION),
                vote("sonika", DecisionType.REJECT, DESCRIPTION))
            .isEmpty());
  }

  @Test
  void theRequesterNeverCountsAsAReviewerStillToVote() {
    assertEquals(
        List.of(DESCRIPTION),
        outOfReach(
            Set.of("karan", "sonika", REQUESTER),
            vote("karan", DecisionType.APPROVE, DESCRIPTION),
            vote("sonika", DecisionType.REJECT, DESCRIPTION)));
  }

  @Test
  void theCommentSaysWhoVotedWhichWay() {
    assertEquals(
        "Reviewers could not agree on description (approved: karan; rejected: sonika), so it is"
            + " not published.",
        ReviewDisagreement.describe(
            List.of(DESCRIPTION),
            List.of(
                vote("karan", DecisionType.APPROVE, DESCRIPTION),
                vote("sonika", DecisionType.REJECT, DESCRIPTION)),
            REQUESTER));
  }
}

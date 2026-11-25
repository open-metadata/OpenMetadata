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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.MutationOpType;
import org.openmetadata.service.governance.approval.ApprovalDecisionService.ReviewOutcome;

class ReviewOutcomeTest {
  private static final MutationOp DESCRIPTION =
      new MutationOp().withOp(MutationOpType.SET).withField("description");
  private static final MutationOp TAG =
      new MutationOp().withOp(MutationOpType.ADD).withField("tags").withKey("PII.Sensitive");

  private static ChangeSelection selection(
      List<MutationOp> applied,
      List<MutationOp> toApply,
      List<MutationOp> rejected,
      List<MutationOp> pending) {
    return new ChangeSelection(applied, List.of(), toApply, rejected, pending);
  }

  private static final ChangeSelection UNDECIDED =
      selection(List.of(), List.of(), List.of(), List.of(DESCRIPTION, TAG));

  @Test
  void aVoteThatAgreesNothingWaits() {
    assertEquals(ReviewOutcome.WAIT, ApprovalDecisionService.outcomeOf(UNDECIDED, UNDECIDED));
  }

  @Test
  void anAgreedApprovalWithChangesLeftIsAPartialApproval() {
    ChangeSelection after = selection(List.of(), List.of(TAG), List.of(), List.of(DESCRIPTION));
    assertEquals(
        ReviewOutcome.PARTIAL_APPROVE, ApprovalDecisionService.outcomeOf(UNDECIDED, after));
    assertEquals("partialApprove", ReviewOutcome.PARTIAL_APPROVE.transition());
  }

  @Test
  void aNewAgreedRejectionWithChangesLeftIsAPartialRejection() {
    ChangeSelection after = selection(List.of(), List.of(), List.of(TAG), List.of(DESCRIPTION));
    assertEquals(ReviewOutcome.PARTIAL_REJECT, ApprovalDecisionService.outcomeOf(UNDECIDED, after));
    assertEquals(ReviewOutcome.WAIT, ApprovalDecisionService.outcomeOf(after, after));
  }

  @Test
  void aSettledRevisionWithAnythingApprovedIsAnApproval() {
    ChangeSelection partlyPublished =
        selection(List.of(TAG), List.of(), List.of(DESCRIPTION), List.of());
    assertEquals(
        ReviewOutcome.APPROVE, ApprovalDecisionService.outcomeOf(UNDECIDED, partlyPublished));
  }

  @Test
  void aSettledRevisionWithNothingApprovedIsARejection() {
    ChangeSelection allRejected =
        selection(List.of(), List.of(), List.of(DESCRIPTION, TAG), List.of());
    assertEquals(ReviewOutcome.REJECT, ApprovalDecisionService.outcomeOf(UNDECIDED, allRejected));
  }
}

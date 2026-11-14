package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.ApprovalOutcomeDecision;
import org.openmetadata.service.governance.approval.ChangeApplyService.RevisionReview;

class ApprovalOutcomeRecorderTest {

  @Test
  void anApprovalThatDroppedAChangeIsPartial() {
    assertEquals(ApprovalOutcomeDecision.APPROVED, ApprovalOutcomeRecorder.decisionOf(true, false));
    assertEquals(
        ApprovalOutcomeDecision.PARTIALLY_APPROVED, ApprovalOutcomeRecorder.decisionOf(true, true));
    assertEquals(ApprovalOutcomeDecision.REJECTED, ApprovalOutcomeRecorder.decisionOf(false, true));
  }

  @Test
  void aChangeRequestNamesTheReviewersOnTheDecidingSide() {
    RevisionReview review = new RevisionReview(List.of("ana", "ben"), List.of("cy"), true);

    assertEquals(
        List.of("ana", "ben"),
        ApprovalOutcomeRecorder.decidersOf(ApprovalOutcomeDecision.APPROVED, review, List.of()));
    assertEquals(
        List.of("cy"),
        ApprovalOutcomeRecorder.decidersOf(ApprovalOutcomeDecision.REJECTED, review, List.of()));
    assertEquals(
        List.of("ana", "ben", "cy"),
        ApprovalOutcomeRecorder.decidersOf(
            ApprovalOutcomeDecision.PARTIALLY_APPROVED, review, List.of()));
  }

  @Test
  void aStepOutsideAChangeRequestNamesItsTaskVoters() {
    assertEquals(
        List.of("ana"),
        ApprovalOutcomeRecorder.decidersOf(ApprovalOutcomeDecision.APPROVED, null, List.of("ana")));
  }

  @Test
  void aMultiVoteTaskNamesEveryVoterOnItsSide() {
    assertEquals(
        List.of("ana", "ben"), RecordVotedApprovalImpl.votersOf(List.of("ana", "ben"), "ben"));
  }

  @Test
  void aSingleVoteTaskNamesTheUserWhoCompletedIt() {
    assertEquals(List.of("ana"), RecordVotedApprovalImpl.votersOf(null, "ana"));
    assertEquals(List.of("ana"), RecordVotedApprovalImpl.votersOf(List.of(), "ana"));
  }

  @Test
  void aTaskWithNoRecordedVoterNamesNoOne() {
    assertEquals(List.of(), RecordVotedApprovalImpl.votersOf(null, null));
  }
}

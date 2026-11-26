package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.schema.utils.JsonUtils;

class TaskReviewVotesTest {
  private final EntityReference alice = user("alice");
  private final EntityReference bob = user("bob");
  private final EntityReference team = team("reviewers");

  @Test
  void recordKeepsEarlierVotesAndTheirComments() {
    List<TaskReviewVote> votes =
        TaskReviewVotes.record(
            null, vote(alice, alice, TaskReviewVoteDecision.Approved, "Looks right", 1L));
    votes =
        TaskReviewVotes.record(
            votes, vote(bob, bob, TaskReviewVoteDecision.Rejected, "Rename Funds Transfer", 2L));

    assertEquals(2, votes.size());
    assertEquals("Looks right", votes.get(0).getComment());
    assertEquals(TaskReviewVoteDecision.Approved, votes.get(0).getDecision());
    assertEquals("Rename Funds Transfer", votes.get(1).getComment());
    assertEquals(TaskReviewVoteDecision.Rejected, votes.get(1).getDecision());
    assertTrue(TaskReviewVotes.hasVoted(votes, "alice"));
    assertFalse(TaskReviewVotes.hasVoted(votes, "carol"));
  }

  @Test
  void workflowResultsIdentifyCountedDecisionsIncludingNonTerminalApprovals() {
    for (Object result : List.of(true, "true", " APPROVE ", "Approved")) {
      assertEquals(TaskReviewVoteDecision.Approved, TaskReviewVotes.decisionForResult(result));
    }
    for (Object result : List.of(false, "false", " REJECT ", "Rejected")) {
      assertEquals(TaskReviewVoteDecision.Rejected, TaskReviewVotes.decisionForResult(result));
    }
    assertNull(TaskReviewVotes.decisionForResult(null));
    assertNull(TaskReviewVotes.decisionForResult("grant"));
    assertNull(TaskReviewVotes.decisionForResult(1));
  }

  @Test
  void durableVotesSurviveSerializationAndRepeatedProjection() {
    List<TaskReviewVote> first =
        List.of(vote(alice, alice, TaskReviewVoteDecision.Approved, "First", 1L));
    List<TaskReviewVote> incoming =
        List.of(
            vote(alice, alice, TaskReviewVoteDecision.Approved, "Retry", 2L),
            vote(bob, team, TaskReviewVoteDecision.Rejected, "Reason", 3L));
    List<TaskReviewVote> merged = TaskReviewVotes.merge(first, incoming);
    String json = JsonUtils.pojoToJson(merged);
    assertEquals(merged, TaskReviewVotes.read(json));
    assertEquals(merged, TaskReviewVotes.merge(merged, incoming));
    assertEquals("First", merged.getFirst().getComment());
    assertEquals(team, merged.getLast().getAssignee());
    assertEquals(List.of(), TaskReviewVotes.read(null));
  }

  @Test
  void repeatVoterIsRecordedOnce() {
    List<TaskReviewVote> first =
        TaskReviewVotes.record(
            List.of(), vote(alice, alice, TaskReviewVoteDecision.Approved, "Looks right", 1L));
    List<TaskReviewVote> again =
        TaskReviewVotes.record(
            first, vote(alice, alice, TaskReviewVoteDecision.Rejected, "Changed my mind", 2L));

    assertSame(first, again);
    assertEquals(1, again.size());
    assertEquals("Looks right", again.get(0).getComment());
  }

  @Test
  void aVoterIsRecordedOnceInEachWorkflowStage() {
    List<TaskReviewVote> votes =
        TaskReviewVotes.record(
            List.of(),
            vote(alice, alice, TaskReviewVoteDecision.Approved, "Fine for marketing", 1L)
                .withStage("managerApproval"));
    votes =
        TaskReviewVotes.record(
            votes,
            vote(alice, alice, TaskReviewVoteDecision.Rejected, "Not for finance", 2L)
                .withStage("ownerApproval"));
    List<TaskReviewVote> retried =
        TaskReviewVotes.record(
            votes,
            vote(alice, alice, TaskReviewVoteDecision.Rejected, "Retry", 3L)
                .withStage("ownerApproval"));

    assertEquals(2, votes.size());
    assertEquals("Fine for marketing", votes.getFirst().getComment());
    assertEquals(TaskReviewVoteDecision.Rejected, votes.getLast().getDecision());
    assertEquals("Not for finance", votes.getLast().getComment());
    assertEquals("ownerApproval", votes.getLast().getStage());
    assertSame(votes, retried);
  }

  @Test
  void voteCoversTheVotersOwnEntryBeforeATeamEntry() {
    List<EntityReference> entries = List.of(team, alice);

    assertSame(alice, TaskReviewVotes.entryFor(entries, user("alice"), List.of(team)));
    assertSame(team, TaskReviewVotes.entryFor(entries, bob, List.of(team("other"), team)));
    assertNull(TaskReviewVotes.entryFor(entries, bob, List.of(team("other"))));
    assertNull(TaskReviewVotes.entryFor(List.of(), alice, List.of(team)));
  }

  @Test
  void entriesComeFromTheReviewersUntilThereAreNone() {
    Task pruned = new Task().withReviewers(List.of(alice, bob)).withAssignees(List.of(bob));
    Task legacy = new Task().withAssignees(List.of(bob));

    assertEquals(List.of(alice, bob), TaskReviewVotes.entries(pruned));
    assertEquals(List.of(bob), TaskReviewVotes.entries(legacy));
    assertEquals(List.of(), TaskReviewVotes.entries(new Task()));
  }

  @Test
  void onlyRejectionsDecideAgainst() {
    assertEquals(
        TaskReviewVoteDecision.Rejected, TaskReviewVotes.decision(TaskResolutionType.Rejected));
    assertEquals(
        TaskReviewVoteDecision.Rejected, TaskReviewVotes.decision(TaskResolutionType.AutoRejected));
    assertEquals(
        TaskReviewVoteDecision.Approved, TaskReviewVotes.decision(TaskResolutionType.Approved));
  }

  @Test
  void sameEntityMatchesByIdOrNameWithinOneType() {
    EntityReference aliceById = new EntityReference().withId(alice.getId()).withType("user");
    EntityReference aliceTheTeam = new EntityReference().withType("team").withName("alice");

    assertTrue(TaskReviewVotes.sameEntity(alice, aliceById));
    assertTrue(TaskReviewVotes.sameEntity(alice, user("alice")));
    assertFalse(TaskReviewVotes.sameEntity(alice, aliceTheTeam));
    assertFalse(TaskReviewVotes.sameEntity(alice, null));
  }

  @Test
  void onlyApprovalAndRejectionResolutionsRecordVotes() {
    for (TaskResolutionType resolution : TaskResolutionType.values()) {
      assertEquals(
          List.of(
                  TaskResolutionType.Approved,
                  TaskResolutionType.AutoApproved,
                  TaskResolutionType.Rejected,
                  TaskResolutionType.AutoRejected)
              .contains(resolution),
          TaskReviewVotes.isDecision(resolution));
    }
    assertFalse(TaskReviewVotes.isDecision(null));
  }

  private static TaskReviewVote vote(
      EntityReference voter,
      EntityReference entry,
      TaskReviewVoteDecision decision,
      String comment,
      long timestamp) {
    return new TaskReviewVote()
        .withVoter(voter)
        .withAssignee(entry)
        .withDecision(decision)
        .withComment(comment)
        .withTimestamp(timestamp);
  }

  private static EntityReference user(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType("user").withName(name);
  }

  private static EntityReference team(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType("team").withName(name);
  }
}

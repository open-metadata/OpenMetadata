package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.OntologyReleaseReview;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyApprovalRule;
import org.openmetadata.schema.type.OntologyReviewAssignee;
import org.openmetadata.schema.type.OntologyReviewAssigneeStatus;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyReleaseReviewReader.View;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class OntologyReleaseReviewReaderTest {
  private static final String LOOKS_RIGHT = "Looks right";
  private static final String RENAME_FUNDS_TRANSFER = "Rename Funds Transfer";

  private final EntityReference alice = user("alice");
  private final EntityReference bob = user("bob");
  private final EntityReference carol = user("carol");
  private final EntityReference requester = user("requester");
  private final EntityReference team = team("reviewers");

  @Test
  void firstApprovalUnderAllReviewersLeavesTheOtherEntryPendingAndDeciding() {
    Task task =
        openTask(OntologyApprovalRule.AllReviewers, List.of(alice, bob))
            .withReviewVotes(List.of(vote(alice, alice, TaskReviewVoteDecision.Approved)));
    OntologyRelease release = inReview(task);

    OntologyReleaseReview review = reader(release, task, bob, List.of()).review();

    assertEquals(OntologyApprovalRule.AllReviewers, review.getApprovalRule());
    assertEquals("TASK-00041", review.getTaskId());
    assertEquals(requester, review.getRequester());
    assertEquals(EntityStatus.IN_REVIEW, review.getStatus());
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(review, alice));
    assertEquals(LOOKS_RIGHT, entry(review, alice).getVote().getComment());
    assertEquals(OntologyReviewAssigneeStatus.Pending, status(review, bob));
    assertNull(entry(review, bob).getVote());
    assertNull(review.getLatestDecision());
    assertTrue(review.getCallerCanVote());
    assertTrue(review.getCallerCompletesRule());
  }

  @Test
  void aVoterNeitherVotesAgainNorPends() {
    Task task =
        openTask(OntologyApprovalRule.AllReviewers, List.of(alice, bob))
            .withReviewVotes(List.of(vote(alice, alice, TaskReviewVoteDecision.Approved)));
    OntologyRelease release = inReview(task);

    OntologyReleaseReviewReader reader = reader(release, task, alice, List.of());

    assertFalse(reader.review().getCallerCanVote());
    assertFalse(reader.review().getCallerCompletesRule());
    assertTrue(reader.matches(View.ASSIGNED));
    assertFalse(reader.matches(View.PENDING));
    assertFalse(reader.matches(View.CREATED));
  }

  @Test
  void aThirdPendingEntryKeepsAllReviewersOpenWhileAnyReviewerDecides() {
    List<TaskReviewVote> votes = List.of(vote(alice, alice, TaskReviewVoteDecision.Approved));
    Task all =
        openTask(OntologyApprovalRule.AllReviewers, List.of(alice, bob, carol))
            .withReviewVotes(votes);
    Task any =
        openTask(OntologyApprovalRule.AnyReviewer, List.of(alice, bob, carol))
            .withReviewVotes(votes);

    OntologyReleaseReview underAll = reader(inReview(all), all, bob, List.of()).review();
    OntologyReleaseReview underAny = reader(inReview(any), any, bob, List.of()).review();

    assertTrue(underAll.getCallerCanVote());
    assertFalse(underAll.getCallerCompletesRule());
    assertTrue(underAny.getCallerCanVote());
    assertTrue(underAny.getCallerCompletesRule());
  }

  @Test
  void aTeamEntryIsCoveredByTheMemberWhoVoted() {
    EntityReference dave = user("dave");
    Task fresh = openTask(OntologyApprovalRule.AllReviewers, List.of(team));
    Task voted =
        openTask(OntologyApprovalRule.AllReviewers, List.of(team))
            .withReviewVotes(List.of(vote(dave, team, TaskReviewVoteDecision.Approved)));
    EntityReference erin = user("erin");

    OntologyReleaseReviewReader member = reader(inReview(fresh), fresh, erin, List.of(team));
    OntologyReleaseReviewReader afterDave = reader(inReview(voted), voted, erin, List.of(team));
    OntologyReleaseReviewReader outsider =
        reader(inReview(fresh), fresh, erin, List.of(team("other")));

    assertTrue(member.matches(View.PENDING));
    assertTrue(member.review().getCallerCompletesRule());
    assertFalse(afterDave.matches(View.PENDING));
    assertTrue(afterDave.matches(View.ASSIGNED));
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(afterDave.review(), team));
    assertEquals("dave", entry(afterDave.review(), team).getVote().getVoter().getName());
    assertFalse(outsider.matches(View.ASSIGNED));
    assertFalse(outsider.review().getCallerCanVote());
  }

  @Test
  void theRequesterAndTheAuthorSeeTheReviewButCannotVote() {
    Task task = openTask(OntologyApprovalRule.AllReviewers, List.of(alice, requester));
    OntologyRelease release = inReview(task).withReviewAuthor("alice");

    OntologyReleaseReviewReader asRequester = reader(release, task, requester, List.of());
    OntologyReleaseReviewReader asAuthor = reader(release, task, alice, List.of());

    assertTrue(asRequester.matches(View.CREATED));
    assertTrue(asRequester.matches(View.ASSIGNED));
    assertFalse(asRequester.matches(View.PENDING));
    assertFalse(asRequester.review().getCallerCanVote());
    assertTrue(asAuthor.matches(View.ASSIGNED));
    assertFalse(asAuthor.matches(View.CREATED));
    assertFalse(asAuthor.review().getCallerCanVote());
  }

  @Test
  void aDecidedReviewKeepsEveryCommentAndTheVerbatimReason() {
    Task task =
        openTask(OntologyApprovalRule.AllReviewers, List.of(alice, bob))
            .withStatus(TaskEntityStatus.Rejected)
            .withResolution(
                new TaskResolution()
                    .withType(TaskResolutionType.Rejected)
                    .withResolvedBy(bob)
                    .withResolvedAt(5L)
                    .withComment(RENAME_FUNDS_TRANSFER))
            .withReviewVotes(
                List.of(
                    vote(alice, alice, TaskReviewVoteDecision.Approved),
                    vote(bob, bob, TaskReviewVoteDecision.Rejected)
                        .withComment(RENAME_FUNDS_TRANSFER)));
    OntologyRelease release = inReview(task).withEntityStatus(EntityStatus.REJECTED);

    OntologyReleaseReviewReader reader = reader(release, task, carol, List.of());
    OntologyReleaseReview review = reader.review();

    assertEquals(EntityStatus.REJECTED, review.getStatus());
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(review, alice));
    assertEquals(LOOKS_RIGHT, entry(review, alice).getVote().getComment());
    assertEquals(OntologyReviewAssigneeStatus.Rejected, status(review, bob));
    assertEquals(RENAME_FUNDS_TRANSFER, entry(review, bob).getVote().getComment());
    assertEquals(TaskReviewVoteDecision.Rejected, review.getLatestDecision().getDecision());
    assertEquals(RENAME_FUNDS_TRANSFER, review.getLatestDecision().getReason());
    assertEquals(bob, review.getLatestDecision().getUser());
    assertEquals(5L, review.getLatestDecision().getTimestamp());
    assertFalse(review.getCallerCanVote());
    assertFalse(reader.matches(View.PENDING));
  }

  @Test
  void anApprovedDecisionReadsAsApprovedAndANewVoteIsRefused() {
    Task task =
        openTask(OntologyApprovalRule.AnyReviewer, List.of(alice, bob))
            .withStatus(TaskEntityStatus.Approved)
            .withResolution(
                new TaskResolution()
                    .withType(TaskResolutionType.Approved)
                    .withResolvedBy(alice)
                    .withResolvedAt(7L)
                    .withComment(LOOKS_RIGHT))
            .withReviewVotes(List.of(vote(alice, alice, TaskReviewVoteDecision.Approved)));
    OntologyRelease release = inReview(task).withEntityStatus(EntityStatus.APPROVED);

    OntologyReleaseReview review = reader(release, task, bob, List.of()).review();

    assertEquals(TaskReviewVoteDecision.Approved, review.getLatestDecision().getDecision());
    assertEquals(OntologyReviewAssigneeStatus.Pending, status(review, bob));
    assertFalse(review.getCallerCanVote());
  }

  @Test
  void aVoteByAPrunedAssigneeStillListsItsEntry() {
    Task legacy =
        openTask(OntologyApprovalRule.AllReviewers, List.of(bob))
            .withReviewers(null)
            .withReviewVotes(List.of(vote(alice, alice, TaskReviewVoteDecision.Approved)));

    OntologyReleaseReview review = reader(inReview(legacy), legacy, bob, List.of()).review();

    assertEquals(
        List.of(bob, alice),
        review.getAssignees().stream().map(OntologyReviewAssignee::getAssignee).toList());
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(review, alice));
    assertTrue(review.getCallerCanVote());
    assertTrue(review.getCallerCompletesRule());
  }

  @Test
  void viewNamesIgnoreCaseAndUnknownOnesAreRefused() {
    assertEquals(View.PENDING, View.parse("Pending"));
    assertEquals(View.ASSIGNED, View.parse("assigned"));
    assertEquals(View.CREATED, View.parse("CREATED"));
    assertThrows(BadRequestException.class, () -> View.parse("everything"));
  }

  private static OntologyReleaseReviewReader reader(
      OntologyRelease release, Task task, EntityReference caller, List<EntityReference> teams) {
    User user = new User().withId(caller.getId()).withName(caller.getName()).withTeams(teams);
    try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class)) {
      subjects
          .when(() -> SubjectContext.getSubjectContext(caller.getName()))
          .thenReturn(new SubjectContext(user, null));
      return new OntologyReleaseReviewReader(release, task, caller.getName());
    }
  }

  private Task openTask(OntologyApprovalRule rule, List<EntityReference> entries) {
    return new Task()
        .withId(UUID.randomUUID())
        .withTaskId("TASK-00041")
        .withName("review")
        .withStatus(TaskEntityStatus.Open)
        .withCreatedBy(requester)
        .withAssignees(entries)
        .withReviewers(entries)
        .withOntologyReview(
            new OntologyReviewTarget().withEntityId(UUID.randomUUID()).withApprovalRule(rule));
  }

  private static OntologyRelease inReview(Task task) {
    return new OntologyRelease()
        .withId(task.getOntologyReview().getEntityId())
        .withName("0.1.0")
        .withEntityStatus(EntityStatus.IN_REVIEW)
        .withReviewTask(task.getId())
        .withOntology(
            new EntityReference().withId(UUID.randomUUID()).withType("ontology").withName("fin"));
  }

  private static TaskReviewVote vote(
      EntityReference voter, EntityReference entry, TaskReviewVoteDecision decision) {
    return new TaskReviewVote()
        .withVoter(voter)
        .withAssignee(entry)
        .withDecision(decision)
        .withComment(LOOKS_RIGHT)
        .withTimestamp(1L);
  }

  private static OntologyReviewAssignee entry(
      OntologyReleaseReview review, EntityReference assignee) {
    return review.getAssignees().stream()
        .filter(candidate -> assignee.getId().equals(candidate.getAssignee().getId()))
        .findFirst()
        .orElseThrow();
  }

  private static OntologyReviewAssigneeStatus status(
      OntologyReleaseReview review, EntityReference assignee) {
    return entry(review, assignee).getStatus();
  }

  private static EntityReference user(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType("user").withName(name);
  }

  private static EntityReference team(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType("team").withName(name);
  }
}

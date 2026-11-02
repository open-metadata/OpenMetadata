package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.OntologyReleaseReview;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyApprovalRule;
import org.openmetadata.schema.type.OntologyReviewAssignee;
import org.openmetadata.schema.type.OntologyReviewAssigneeStatus;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.TaskStateConflictException;
import org.openmetadata.service.governance.workflows.OntologyApprovalWorkflow;
import org.openmetadata.service.governance.workflows.OntologyWorkflowDecision;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * Release reviews decided by the ontology's approval rule. Every test uses the seeded approval
 * workflow as deployed, so the class runs in the parallel lane.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReviewRuleIT extends BaseOntologyApprovalIT {
  private static final String LOOKS_RIGHT = "Looks right";
  private static final String RENAME_FUNDS_TRANSFER = "Rename Funds Transfer";
  private static final String RELEASE = "ontologyRelease";
  private static final String REVIEW_SETUP_CHANGED =
      "The ontology's reviewers or approval rule changed while this review was being requested; submit the review again";

  @Test
  void anyReviewerDecidesOnTheFirstApproval(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AnyReviewer, user1(), user2());
    OntologyRelease release = capture(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    assertEquals(2, task.getAssignees().size());

    vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);

    assertEquals(EntityStatus.APPROVED, current(release).getEntityStatus());
    OntologyReleaseReview review = review(SdkClients.adminClient(), release);
    assertEquals(OntologyApprovalRule.AnyReviewer, review.getApprovalRule());
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(review, user1()));
    assertEquals(LOOKS_RIGHT, vote(review, user1()).getComment());
    assertEquals(OntologyReviewAssigneeStatus.Pending, status(review, user2()));
    assertEquals(TaskReviewVoteDecision.Approved, review.getLatestDecision().getDecision());
    assertEquals(LOOKS_RIGHT, review.getLatestDecision().getReason());
    assertEquals(1, taskVotes(task).size());
    assertFalse(review.getCallerCanVote());
  }

  @Test
  void allReviewersWaitsForEveryUserEntry(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AllReviewers, user1(), user2());
    OntologyRelease release = capture(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    assertEquals(1, listed(SdkClients.user1Client(), "pending", release));
    assertEquals(1, listed(SdkClients.user2Client(), "pending", release));
    assertEquals(1, listed(SdkClients.adminClient(), "created", release));
    assertEquals(0, listed(SdkClients.adminClient(), "assigned", release));
    assertEquals(0, listed(SdkClients.user1Client(), "created", release));

    Task afterFirst =
        vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);

    assertEquals(TaskEntityStatus.Open, afterFirst.getStatus());
    assertEquals(EntityStatus.IN_REVIEW, current(release).getEntityStatus());
    OntologyReleaseReview review = review(SdkClients.user2Client(), release);
    assertEquals(OntologyApprovalRule.AllReviewers, review.getApprovalRule());
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(review, user1()));
    assertEquals(LOOKS_RIGHT, vote(review, user1()).getComment());
    assertEquals(user1().getId(), vote(review, user1()).getAssignee().getId());
    assertEquals(OntologyReviewAssigneeStatus.Pending, status(review, user2()));
    assertNull(review.getLatestDecision());
    assertTrue(review.getCallerCanVote());
    assertTrue(review.getCallerCompletesRule());
    assertFalse(review(SdkClients.user1Client(), release).getCallerCanVote());
    assertFalse(review(SdkClients.adminClient(), release).getCallerCanVote());
    assertEquals(0, listed(SdkClients.user1Client(), "pending", release));
    assertEquals(1, listed(SdkClients.user1Client(), "assigned", release));
    assertEquals(1, listed(SdkClients.user2Client(), "pending", release));

    vote(SdkClients.user2Client(), task, TaskResolutionType.Approved, "Ship it");

    assertEquals(EntityStatus.APPROVED, current(release).getEntityStatus());
    review = review(SdkClients.adminClient(), release);
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(review, user2()));
    assertEquals("Ship it", vote(review, user2()).getComment());
    assertEquals(LOOKS_RIGHT, vote(review, user1()).getComment());
    assertEquals(TaskReviewVoteDecision.Approved, review.getLatestDecision().getDecision());
    assertEquals(2, taskVotes(task).size());
    assertEquals(0, listed(SdkClients.user2Client(), "pending", release));
    assertEquals(0, listed(SdkClients.adminClient(), "created", release));
  }

  @Test
  void allReviewersCountsATeamOnce(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AllReviewers, team21());
    OntologyRelease release = capture(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    assertEquals(1, task.getAssignees().size());
    assertEquals(1, listed(SdkClients.user2Client(), "pending", release));

    vote(SdkClients.user2Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);

    assertEquals(EntityStatus.APPROVED, current(release).getEntityStatus());
    OntologyReleaseReview review = review(SdkClients.adminClient(), release);
    assertEquals(1, review.getAssignees().size());
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(review, team21()));
    assertEquals(user2().getName(), vote(review, team21()).getVoter().getName());
    assertEquals(team21().getId(), vote(review, team21()).getAssignee().getId());
  }

  @Test
  void requesterIsLeftOutOfTheAssignees(TestNamespace ns) {
    EntityReference requester =
        SdkClients.adminClient().users().getByName("admin").getEntityReference();
    Ontology ontology =
        reviewedOntology(ns, OntologyApprovalRule.AllReviewers, requester, user1(), user2());
    OntologyRelease release = capture(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    Task withReviewers =
        SdkClients.adminClient().tasks().get(task.getId().toString(), "assignees,reviewers");

    assertEquals(Set.of(user1().getId(), user2().getId()), ids(withReviewers.getAssignees()));
    assertEquals(Set.of(user1().getId(), user2().getId()), ids(withReviewers.getReviewers()));
    assertEquals(0, listed(SdkClients.adminClient(), "pending", release));

    vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);
    assertEquals(EntityStatus.IN_REVIEW, current(release).getEntityStatus());
    vote(SdkClients.user2Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);
    assertEquals(EntityStatus.APPROVED, current(release).getEntityStatus());
    assertEquals(2, review(SdkClients.adminClient(), release).getAssignees().size());
  }

  @Test
  void teamMixedWithUsersIsRefused(TestNamespace ns) {
    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .ontologies()
                    .create(
                        request(ns)
                            .withName(ns.prefix("mixedReviewers"))
                            .withApprovalRule(OntologyApprovalRule.AllReviewers)
                            .withReviewers(List.of(team21(), user1()))));

    assertEquals(400, refused.getStatusCode());
    assertTrue(
        refused
            .getMessage()
            .contains("Only one team or multiple users can be assigned as reviewer"),
        refused.getMessage());
  }

  @Test
  void reviewersAndTheRuleAreLockedWhileAReleaseIsInReview(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AnyReviewer, user1());
    OntologyRelease release = captureMinor(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    String locked =
        "Reviewers and the approval rule are locked while release "
            + release.getSemanticVersion()
            + " is in review";

    OpenMetadataException reviewers =
        httpError(
            assertThrows(
                OpenMetadataException.class,
                () -> updateReviewers(ontology, List.of(user1(), user2()))));
    assertEquals(409, reviewers.getStatusCode());
    assertTrue(reviewers.getMessage().contains(locked), reviewers.getMessage());
    OpenMetadataException rule =
        httpError(
            assertThrows(
                OpenMetadataException.class,
                () -> updateRule(ontology, OntologyApprovalRule.AllReviewers)));
    assertEquals(409, rule.getStatusCode());
    assertTrue(rule.getMessage().contains(locked), rule.getMessage());
    assertEquals(Set.of(user1().getId()), ids(current(ontology).getReviewers()));
    assertEquals(OntologyApprovalRule.AnyReviewer, current(ontology).getApprovalRule());

    vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);

    assertEquals(EntityStatus.APPROVED, current(release).getEntityStatus());
    assertEquals(
        Set.of(user1().getId(), user2().getId()),
        ids(updateReviewers(ontology, List.of(user1(), user2())).getReviewers()));
    assertEquals(
        OntologyApprovalRule.AllReviewers,
        updateRule(ontology, OntologyApprovalRule.AllReviewers).getApprovalRule());
  }

  @Test
  void bothCommentsAndTheVerbatimReasonAreKept(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AllReviewers, user1(), user2());
    OntologyRelease release = capture(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());

    vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);
    vote(SdkClients.user2Client(), task, TaskResolutionType.Rejected, RENAME_FUNDS_TRANSFER);

    assertEquals(EntityStatus.REJECTED, current(release).getEntityStatus());
    OntologyReleaseReview review = review(SdkClients.adminClient(), release);
    assertEquals(OntologyReviewAssigneeStatus.Approved, status(review, user1()));
    assertEquals(LOOKS_RIGHT, vote(review, user1()).getComment());
    assertEquals(OntologyReviewAssigneeStatus.Rejected, status(review, user2()));
    assertEquals(RENAME_FUNDS_TRANSFER, vote(review, user2()).getComment());
    assertEquals(TaskReviewVoteDecision.Rejected, review.getLatestDecision().getDecision());
    assertEquals(RENAME_FUNDS_TRANSFER, review.getLatestDecision().getReason());
    assertEquals(user2().getName(), review.getLatestDecision().getUser().getName());
    assertEquals(2, taskVotes(task).size());
  }

  @Test
  void repeatVoteIsRefusedAndRecordedOnce(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AllReviewers, user1(), user2());
    OntologyRelease release = capture(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);

    OpenMetadataException again =
        assertThrows(
            OpenMetadataException.class,
            () -> vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, "Again"));

    assertEquals(403, again.getStatusCode());
    assertEquals(EntityStatus.IN_REVIEW, current(release).getEntityStatus());
    List<TaskReviewVote> votes = taskVotes(task);
    assertEquals(1, votes.size());
    assertEquals(LOOKS_RIGHT, votes.getFirst().getComment());
    assertEquals(user1().getName(), votes.getFirst().getVoter().getName());
  }

  @Test
  void aRuleChangedAfterTheRequestWasPreparedRefusesToStartTheReview(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AnyReviewer, user1(), user2());
    OntologyRelease release = capture(ontology);
    Task prepared = preparedReviewTask(ns, release);
    assertEquals(OntologyApprovalRule.AnyReviewer, prepared.getOntologyReview().getApprovalRule());
    updateRule(ontology, OntologyApprovalRule.AllReviewers);

    TaskStateConflictException refused =
        assertThrows(
            TaskStateConflictException.class, () -> OntologyApprovalWorkflow.start(prepared));

    assertEquals(REVIEW_SETUP_CHANGED, refused.getMessage());
    assertEquals(EntityStatus.DRAFT, current(release).getEntityStatus());
    assertNull(current(release).getReviewTask());
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    assertEquals(
        OntologyApprovalRule.AllReviewers,
        review(SdkClients.adminClient(), release).getApprovalRule());
    vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);
    assertEquals(EntityStatus.IN_REVIEW, current(release).getEntityStatus());
  }

  @Test
  void reviewersChangedAfterTheRequestWasPreparedRefuseToStartTheReview(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AllReviewers, user1());
    OntologyRelease release = capture(ontology);
    Task prepared = preparedReviewTask(ns, release);
    assertEquals(Set.of(user1().getId()), ids(prepared.getReviewers()));
    updateReviewers(ontology, List.of(user1(), user2()));

    TaskStateConflictException refused =
        assertThrows(
            TaskStateConflictException.class, () -> OntologyApprovalWorkflow.start(prepared));

    assertEquals(REVIEW_SETUP_CHANGED, refused.getMessage());
    assertEquals(EntityStatus.DRAFT, current(release).getEntityStatus());
    assertNull(current(release).getReviewTask());
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    assertEquals(Set.of(user1().getId(), user2().getId()), ids(task.getAssignees()));
  }

  @Test
  void finalVotePreservesACommittedVoteWhoseTaskWriteWasDelayed(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AllReviewers, user1(), user2());
    OntologyRelease release = capture(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task snapshot = tasks.get(null, task.getId(), tasks.getFields("*"));
    WorkflowHandler workflow = WorkflowHandler.getInstance();
    String firstVoter = user1().getName();
    long firstVoteTime = System.currentTimeMillis();
    Map<String, Object> variables =
        workflow.transformToNodeVariables(
            task.getId(), Map.of("result", "approve", "updatedBy", firstVoter));
    OntologyApprovalWorkflow.recordDecision(
        snapshot,
        new OntologyWorkflowDecision(
            task.getId(),
            snapshot.getOntologyReview(),
            TaskResolutionType.Approved,
            firstVoter,
            List.of(firstVoter),
            null,
            LOOKS_RIGHT),
        variables);
    variables.put(
        "taskReviewVotes_" + task.getId(),
        JsonUtils.pojoToJson(
            List.of(
                new TaskReviewVote()
                    .withVoter(user1())
                    .withAssignee(user1())
                    .withDecision(TaskReviewVoteDecision.Approved)
                    .withComment(LOOKS_RIGHT)
                    .withStage(snapshot.getWorkflowStageId())
                    .withTimestamp(firstVoteTime))));

    assertEquals(
        WorkflowHandler.TaskResolutionOutcome.WAITING_FOR_VOTES,
        workflow.resolveTaskOutcome(task.getId(), variables));
    assertTrue(taskVotes(task).isEmpty());
    vote(SdkClients.user2Client(), task, TaskResolutionType.Approved, "Final approval");

    OntologyReleaseReview reviewed = review(SdkClients.adminClient(), release);
    assertEquals(EntityStatus.APPROVED, current(release).getEntityStatus());
    assertEquals(2, taskVotes(task).size());
    assertEquals(LOOKS_RIGHT, vote(reviewed, user1()).getComment());
    assertEquals(firstVoteTime, vote(reviewed, user1()).getTimestamp());
    assertEquals("Final approval", vote(reviewed, user2()).getComment());
  }

  @Test
  void countedVotesCannotBeRemovedThroughTaskPatch(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AllReviewers, user1(), user2());
    OntologyRelease release = capture(ontology);
    Task task = submit(ns, RELEASE, release.getFullyQualifiedName());
    vote(SdkClients.user1Client(), task, TaskResolutionType.Approved, LOOKS_RIGHT);

    OpenMetadataException denied =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .tasks()
                    .patch(
                        task.getId().toString(),
                        JsonUtils.readTree(
                            "[{\"op\":\"replace\",\"path\":\"/reviewVotes\",\"value\":[]}]")));

    assertEquals(400, httpError(denied).getStatusCode());
    assertEquals(1, taskVotes(task).size());
    assertEquals(LOOKS_RIGHT, taskVotes(task).getFirst().getComment());
  }

  @Test
  void reviewReadNeedsAReviewTaskAndViewOnTheRelease(TestNamespace ns) {
    Ontology ontology = reviewedOntology(ns, OntologyApprovalRule.AnyReviewer, user1());
    OntologyRelease release = capture(ontology);
    assertEquals(
        404,
        assertThrows(OpenMetadataException.class, () -> review(SdkClients.adminClient(), release))
            .getStatusCode());
    submit(ns, RELEASE, release.getFullyQualifiedName());
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> reviews(SdkClients.adminClient(), "everything", null))
            .getStatusCode());

    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("rule" + ns.shortPrefix())) {
      var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_RELEASE);
      var denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(role.getId())))
                  .build());
      assertEquals(
          403,
          assertThrows(OpenMetadataException.class, () -> review(denied, release)).getStatusCode());
      assertEquals(0, listed(denied, "assigned", release));
      User deniedUser =
          denied
              .getHttpClient()
              .execute(HttpMethod.GET, "/v1/users/loggedInUser", null, User.class);
      Ontology deniedOntology =
          SdkClients.adminClient()
              .ontologies()
              .create(
                  request(ns)
                      .withName(ns.prefix("deniedOntology"))
                      .withOwners(List.of(deniedUser.getEntityReference())));
      ns.trackRoot("ontology", deniedOntology);
      OntologyRelease deniedRelease = capture(deniedOntology);
      Task deniedTask =
          denied.tasks().create(reviewRequest(ns, RELEASE, deniedRelease.getFullyQualifiedName()));
      ns.trackRoot("task", deniedTask);
      assertEquals(
          403,
          assertThrows(OpenMetadataException.class, () -> review(denied, deniedRelease))
              .getStatusCode());
      assertEquals(0, listed(denied, "created", deniedRelease));
      assertEquals(0, reviews(denied, "created", null).path("paging").path("total").asInt());
    }
  }

  /**
   * A review request as TaskRepository.prepare leaves it, before the create transaction stores it
   * and starts the review: the point where the ontology can still change under the request.
   */
  private static Task preparedReviewTask(TestNamespace ns, OntologyRelease release) {
    long now = System.currentTimeMillis();
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withName(ns.prefix("review"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.RequestApproval)
            .withStatus(TaskEntityStatus.Open)
            .withPriority(TaskPriority.Medium)
            .withAbout(release.getEntityReference())
            .withCreatedBy(SdkClients.adminClient().users().getByName("admin").getEntityReference())
            .withCreatedAt(now)
            .withUpdatedBy("admin")
            .withUpdatedAt(now);
    ((TaskRepository) Entity.getEntityRepository(Entity.TASK)).prepare(task, false);
    return task;
  }

  private static Ontology reviewedOntology(
      TestNamespace ns, OntologyApprovalRule rule, EntityReference... reviewers) {
    Ontology ontology =
        SdkClients.adminClient()
            .ontologies()
            .create(
                request(ns)
                    .withName(ns.prefix("ruledOntology"))
                    .withApprovalRule(rule)
                    .withReviewers(List.of(reviewers)));
    ns.trackRoot("ontology", ontology);
    return ontology;
  }

  private static OntologyRelease captureMinor(Ontology ontology) {
    OntologyState state = SdkClients.adminClient().ontologies().state(ontology.getId());
    return SdkClients.adminClient()
        .ontologies()
        .capture(
            ontology.getId(),
            new CaptureOntologyRelease()
                .withExpectedWorkingRevision(state.getWorkingRevision())
                .withExpectedLatestReleaseRevision(state.getLastReleaseRevision())
                .withVersionBump(CaptureOntologyRelease.VersionBump.fromValue("minor")));
  }

  /** The SDK wraps a refused update; the HTTP status and message sit on the cause. */
  private static OpenMetadataException httpError(OpenMetadataException wrapped) {
    return wrapped.getCause() instanceof OpenMetadataException cause ? cause : wrapped;
  }

  private static Ontology updateReviewers(Ontology ontology, List<EntityReference> reviewers) {
    return SdkClients.adminClient()
        .ontologies()
        .update(ontology.getId(), current(ontology).withReviewers(reviewers));
  }

  private static Ontology updateRule(Ontology ontology, OntologyApprovalRule rule) {
    return SdkClients.adminClient()
        .ontologies()
        .update(ontology.getId(), current(ontology).withApprovalRule(rule));
  }

  private static Task vote(
      OpenMetadataClient client, Task task, TaskResolutionType type, String comment) {
    return client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask().withResolutionType(type).withComment(comment));
  }

  private static OntologyReleaseReview review(OpenMetadataClient client, OntologyRelease release) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologyReleases/" + release.getId() + "/review",
            null,
            OntologyReleaseReview.class);
  }

  private static JsonNode reviews(OpenMetadataClient client, String view, String after) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/reviews?view="
                + view
                + "&limit=100"
                + (after == null ? "" : "&after=" + after),
            null,
            JsonNode.class);
  }

  /** How many rows of the caller's {@code view} name this release, across every page. */
  private static long listed(OpenMetadataClient client, String view, OntologyRelease release) {
    long rows = 0;
    String after = null;
    do {
      JsonNode page = reviews(client, view, after);
      for (JsonNode row : page.path("data")) {
        if (release.getId().toString().equals(row.path("release").path("id").asText())) {
          rows++;
        }
      }
      JsonNode next = page.path("paging").path("after");
      after = next.isMissingNode() || next.isNull() ? null : next.asText();
    } while (after != null);
    return rows;
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

  private static TaskReviewVote vote(OntologyReleaseReview review, EntityReference assignee) {
    return entry(review, assignee).getVote();
  }

  private static List<TaskReviewVote> taskVotes(Task task) {
    return SdkClients.adminClient().tasks().get(task.getId().toString()).getReviewVotes();
  }

  private static Set<UUID> ids(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }

  private static EntityReference user1() {
    return SharedEntities.get().USER1.getEntityReference();
  }

  private static EntityReference user2() {
    return SharedEntities.get().USER2.getEntityReference();
  }

  private static EntityReference team21() {
    return SharedEntities.get().TEAM21.getEntityReference();
  }
}

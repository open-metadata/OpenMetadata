package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyReleaseEvent.EventType;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * What the author of a review request sees after the reviewer decides, and how the author withdraws
 * an open request.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReviewNoticeIT extends BaseOntologyApprovalIT {
  @Test
  void anApprovalAppearsInTheAuthorsInboxWithTheReviewerAndVersion(TestNamespace ns) {
    final OntologyRelease release = capture(createOntology(ns, "approvedNotice"));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());

    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));

    final ActivityEvent notice = awaitNotice(release);
    assertEquals("Approved", notice.getNewValue());
    assertEquals("reviewDecision", notice.getFieldName());
    assertEquals(release.getId(), notice.getEntity().getId());
    assertEquals(SharedEntities.get().USER1.getId(), notice.getActor().getId());
    final User reviewer = SharedEntities.get().USER1;
    final String reviewerName =
        reviewer.getDisplayName() == null ? reviewer.getName() : reviewer.getDisplayName();
    assertEquals(
        reviewerName
            + " approved release #"
            + release.getReleaseRevision()
            + ": Ontology review decision",
        notice.getSummary());
  }

  @Test
  void aRejectionAppearsInTheAuthorsInboxWithTheReason(TestNamespace ns) {
    final OntologyRelease release = capture(createOntology(ns, "rejectedNotice"));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());

    SdkClients.user1Client()
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withResolutionType(TaskResolutionType.Rejected)
                .withComment("Scope is too broad"));

    final ActivityEvent notice = awaitNotice(release);
    assertEquals("Rejected", notice.getNewValue());
    assertTrue(notice.getSummary().contains("rejected"), notice.getSummary());
    assertTrue(notice.getSummary().endsWith(": Scope is too broad"), notice.getSummary());
  }

  @Test
  void aRejectionReasonPostedAsATaskCommentReachesTheNoticeAndTheReleaseEvent(TestNamespace ns) {
    final OntologyRelease release = capture(createOntology(ns, "commentedReject"));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    SdkClients.user1Client().tasks().addComment(task.getId().toString(), "Scope is too broad");

    SdkClients.user1Client()
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask().withResolutionType(TaskResolutionType.Rejected));

    final ActivityEvent notice = awaitNotice(release);
    assertTrue(notice.getSummary().endsWith(": Scope is too broad"), notice.getSummary());
    final OntologyReleaseEvent rejected = events(release).get(2);
    assertEquals(EventType.REJECTED, rejected.getEventType());
    assertEquals("Scope is too broad", rejected.getResolution().getComment());
  }

  @Test
  void aRejectionWithoutAReasonIsRefusedAndLeavesNoNotice(TestNamespace ns) {
    final OntologyRelease release = capture(createOntology(ns, "silentReject"));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());

    final OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.user1Client()
                    .tasks()
                    .resolve(
                        task.getId().toString(),
                        new ResolveTask().withResolutionType(TaskResolutionType.Rejected)));

    assertEquals(400, refused.getStatusCode());
    assertEquals(0, notices(release).size());
    assertEquals(EntityStatus.IN_REVIEW, current(release).getEntityStatus());
  }

  @Test
  void theRequesterWithdrawsAnOpenRequestAndTheReleaseReturnsToDraft(TestNamespace ns) {
    final OntologyRelease release = capture(createOntology(ns, "withdrawn"));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());

    final Task closed = SdkClients.adminClient().tasks().close(task.getId().toString());

    assertEquals(TaskEntityStatus.Cancelled, closed.getStatus());
    assertEquals(EntityStatus.DRAFT, current(release).getEntityStatus());
    assertNull(current(release).getReviewTask());
    assertEquals(
        List.of(EventType.CAPTURED, EventType.REVIEW_REQUESTED, EventType.REVIEW_WITHDRAWN),
        events(release).stream().map(OntologyReleaseEvent::getEventType).toList());
    assertEquals(0, notices(release).size());
  }

  @Test
  void aUserWhoDidNotRequestTheReviewCannotWithdrawIt(TestNamespace ns) {
    final OntologyRelease release = capture(createOntology(ns, "notYours"));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());

    final OpenMetadataException denied =
        assertThrows(
            OpenMetadataException.class,
            () -> SdkClients.user2Client().tasks().close(task.getId().toString()));

    assertEquals(403, denied.getStatusCode());
    assertEquals(EntityStatus.IN_REVIEW, current(release).getEntityStatus());
  }

  private static ActivityEvent awaitNotice(OntologyRelease release) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(() -> assertEquals(1, notices(release).size()));
    return notices(release).get(0);
  }

  private static List<ActivityEvent> notices(OntologyRelease release) {
    final JsonNode response =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/activity?entityType="
                    + Entity.ONTOLOGY_RELEASE
                    + "&entityId="
                    + release.getId()
                    + "&days=1&limit=50",
                null,
                JsonNode.class);
    return JsonUtils.readObjects(response.path("data").toString(), ActivityEvent.class).stream()
        .filter(event -> "reviewDecision".equals(event.getFieldName()))
        .toList();
  }

  private static List<OntologyReleaseEvent> events(OntologyRelease release) {
    final JsonNode response =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/events?limit=10",
                null,
                JsonNode.class);
    return JsonUtils.readObjects(response.path("data").toString(), OntologyReleaseEvent.class);
  }
}

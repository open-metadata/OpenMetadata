package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.OntologyReleaseReview;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyReviewAssigneeStatus;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * The open-review read narrowed to one ontology, and the reviewers a review gets when its request
 * names none.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReviewFilterIT extends BaseOntologyApprovalIT {
  private static final int PAGE_LIMIT = 100;
  private static final int OPEN_REVIEWS = PAGE_LIMIT + 1;

  @Test
  void anOntologyFilterFindsItsReviewBeyondTheFirstHundredOpenReviews(TestNamespace ns)
      throws Exception {
    // The server lists reviews newest-first by creation time, so the oldest and newest are only
    // known when each is requested alone, before and after the concurrent batch.
    final OntologyRelease oldest = requestReview(ns, "filteredOldest");
    final List<OntologyRelease> releases = new ArrayList<>();
    releases.add(oldest);
    final ExecutorService pool = Executors.newFixedThreadPool(8);
    try {
      final List<Callable<OntologyRelease>> work = new ArrayList<>();
      for (int index = 1; index < OPEN_REVIEWS - 1; index++) {
        final String name = "filtered" + index;
        work.add(() -> requestReview(ns, name));
      }
      for (final Future<OntologyRelease> done : pool.invokeAll(work)) {
        releases.add(done.get());
      }
    } finally {
      pool.shutdown();
    }
    final OntologyRelease newest = requestReview(ns, "filteredNewest");
    releases.add(newest);
    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .untilAsserted(
            () ->
                assertTrue(
                    releases.stream()
                        .allMatch(
                            release ->
                                current(release).getEntityStatus() == EntityStatus.IN_REVIEW),
                    "every release is in review"));

    assertFalse(
        listed(null, oldest).contains(oldest.getId().toString()),
        "newest-first pages push the oldest review past the first 100");
    assertEquals(List.of(oldest.getId().toString()), listed(oldest.getOntology().getId(), oldest));
    assertEquals(List.of(newest.getId().toString()), listed(newest.getOntology().getId(), newest));
    assertEquals(
        1, reviews("created", oldest.getOntology().getId()).path("paging").path("total").asInt());
  }

  @Test
  void aReviewRequestedWithNoAssigneesGetsTheOntologysReviewers(TestNamespace ns) {
    final OntologyRelease release = capture(createOntology(ns));

    final Task task =
        SdkClients.adminClient()
            .tasks()
            .create(
                reviewRequest(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName())
                    .withAssignees(List.of()));
    ns.trackRoot("task", task);

    final OntologyReleaseReview review =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/review",
                null,
                OntologyReleaseReview.class);
    assertEquals(1, review.getAssignees().size());
    assertEquals(
        SharedEntities.get().USER1.getId(), review.getAssignees().get(0).getAssignee().getId());
    assertEquals(OntologyReviewAssigneeStatus.Pending, review.getAssignees().get(0).getStatus());
  }

  @Test
  void aReviewRequestedWithNoAssigneesIsRefusedWhenTheOntologyHasNoReviewers(TestNamespace ns) {
    final Ontology ontology =
        SdkClients.adminClient()
            .ontologies()
            .create(request(ns).withName(ns.prefix("unreviewed")).withReviewers(List.of()));
    ns.trackRoot("ontology", ontology);
    final OntologyRelease release = capture(ontology);

    final OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .tasks()
                    .create(
                        reviewRequest(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName())
                            .withAssignees(List.of())));

    assertEquals(400, refused.getStatusCode());
    assertTrue(refused.getMessage().contains("Configure ontology reviewers"), refused.getMessage());
  }

  private static OntologyRelease requestReview(TestNamespace ns, String name) {
    final Ontology ontology =
        SdkClients.adminClient()
            .ontologies()
            .create(
                request(ns)
                    .withName(ns.prefix(name))
                    .withIri(URI.create("https://example.org/model/" + ns.shortPrefix() + name)));
    ns.trackRoot("ontology", ontology);
    final OntologyRelease release = capture(ontology);
    ns.trackRoot(
        "task",
        SdkClients.adminClient()
            .tasks()
            .create(reviewRequest(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName())));
    return release;
  }

  private static List<String> listed(UUID ontologyId, OntologyRelease release) {
    return java.util.stream.StreamSupport.stream(
            reviews("created", ontologyId).path("data").spliterator(), false)
        .map(row -> row.path("release").path("id").asText())
        .filter(release.getId().toString()::equals)
        .toList();
  }

  private static JsonNode reviews(String view, UUID ontologyId) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/reviews?view="
                + view
                + "&limit="
                + PAGE_LIMIT
                + (ontologyId == null ? "" : "&ontologyId=" + ontologyId),
            null,
            JsonNode.class);
  }
}

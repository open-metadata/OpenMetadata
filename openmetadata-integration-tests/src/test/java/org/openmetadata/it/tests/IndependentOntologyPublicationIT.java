package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease.VersionBump;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyPublicationIT extends BaseOntologyApprovalIT {
  @Test
  void publicationMetadataIsExactAndDoesNotChangeFrozenContent(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyRelease legacy = capture(ontology, request(ontology));
    assertNull(legacy.getSemanticVersion());
    assertNull(legacy.getReleaseNotes());
    final String notes = " \n" + "n".repeat(16_380) + "\n ";
    final OntologyRelease versioned =
        capture(
            ontology, request(ontology).withVersionBump(VersionBump.MAJOR).withReleaseNotes(notes));
    assertEquals("1.0.0", versioned.getSemanticVersion());
    assertEquals(
        notes,
        SdkClients.adminClient().ontologyReleases().get(versioned.getId()).getReleaseNotes());
    assertEquals("release-2", versioned.getName());
    assertEquals(2L, versioned.getReleaseRevision());
    assertEquals(legacy.getContentDigest(), versioned.getContentDigest());
    assertEquals(legacy.getVersion(), versioned.getVersion());
    assertEquals(
        "urn:openmetadata:ontology-release:" + versioned.getId(),
        versioned.getVersionIri().toString());
    assertEquals(
        "1.1.0",
        capture(ontology, request(ontology).withVersionBump(VersionBump.MINOR))
            .getSemanticVersion());
    assertEquals(
        "1.1.1",
        capture(ontology, request(ontology).withVersionBump(VersionBump.PATCH))
            .getSemanticVersion());
  }

  @Test
  void concurrentVersionedCapturesRequireAFreshLatestRevision(TestNamespace ns) throws Exception {
    final Ontology ontology = createOntology(ns);
    final CaptureOntologyRelease request = request(ontology).withVersionBump(VersionBump.MAJOR);
    final Callable<Integer> capture =
        () -> {
          try {
            capture(ontology, request);
            return 201;
          } catch (OpenMetadataException failure) {
            return failure.getStatusCode();
          }
        };
    try (var executor = Executors.newFixedThreadPool(2)) {
      final var first = executor.submit(capture);
      final var second = executor.submit(capture);
      final List<Integer> statuses =
          List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
      assertTrue(statuses.contains(201));
      assertTrue(statuses.contains(412));
    }
    assertEquals(1L, state(ontology).getLastReleaseRevision());
    assertEquals(
        "1.1.0",
        capture(ontology, request(ontology).withVersionBump(VersionBump.MINOR))
            .getSemanticVersion());
  }

  @Test
  void invalidPublicationMetadataDoesNotAllocateARelease(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final CaptureOntologyRelease missingFence =
        request(ontology)
            .withVersionBump(VersionBump.MAJOR)
            .withExpectedLatestReleaseRevision(null);
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> capture(ontology, missingFence))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> capture(ontology, request(ontology).withReleaseNotes("n".repeat(16_385))))
            .getStatusCode());
    assertEquals(0L, state(ontology).getLastReleaseRevision());
  }

  @Test
  void chronologicalPagingIsNumericOwnerScopedAndStableAcrossCaptures(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    for (int index = 0; index < 12; index++) {
      capture(ontology, request(ontology));
    }
    final JsonNode first = history(SdkClients.adminClient(), ontology, "?limit=5");
    assertEquals(12, first.path("paging").path("total").asInt());
    assertEquals(List.of(12L, 11L, 10L, 9L, 8L), revisions(first));
    capture(ontology, request(ontology));
    final JsonNode second =
        history(
            SdkClients.adminClient(),
            ontology,
            "?limit=5&after=" + first.path("paging").path("after").asText());
    assertEquals(12, second.path("paging").path("total").asInt());
    assertEquals(List.of(7L, 6L, 5L, 4L, 3L), revisions(second));
    final JsonNode third =
        history(
            SdkClients.adminClient(),
            ontology,
            "?limit=5&after=" + second.path("paging").path("after").asText());
    assertEquals(List.of(2L, 1L), revisions(third));
    assertTrue(
        third.path("paging").path("after").isMissingNode()
            || third.path("paging").path("after").isNull());
    final Ontology other = createOntology(ns, "otherOntology");
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    history(
                        SdkClients.adminClient(),
                        other,
                        "?after=" + first.path("paging").path("after").asText()))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> history(SdkClients.adminClient(), ontology, "?after=not-a-cursor"))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> history(SdkClients.adminClient(), ontology, "?limit=101"))
            .getStatusCode());
  }

  @Test
  void chronologicalHistoryRequiresReleaseVisibility(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    capture(
        ontology,
        request(ontology).withVersionBump(VersionBump.MAJOR).withReleaseNotes("Private notes"));
    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("publication" + ns.shortPrefix())) {
      final var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_RELEASE);
      final String token = fixtures.userToken("reader", List.of(role.getId()));
      final OpenMetadataClient denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(token)
                  .build());
      assertNotNull(denied.ontologies().get(ontology.getId()));
      assertEquals(
          403,
          assertThrows(OpenMetadataException.class, () -> history(denied, ontology, ""))
              .getStatusCode());
    }
  }

  private static CaptureOntologyRelease request(Ontology ontology) {
    final OntologyState state = state(ontology);
    return new CaptureOntologyRelease()
        .withExpectedWorkingRevision(state.getWorkingRevision())
        .withExpectedActivationRevision(state.getActivationRevision())
        .withExpectedLatestReleaseRevision(state.getLastReleaseRevision());
  }

  private static OntologyState state(Ontology ontology) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/state",
            null,
            OntologyState.class);
  }

  private static OntologyRelease capture(Ontology ontology, CaptureOntologyRelease request) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologies/" + ontology.getId() + "/releases",
            request,
            OntologyRelease.class);
  }

  private static JsonNode history(OpenMetadataClient client, Ontology ontology, String query) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/releases" + query,
            null,
            JsonNode.class);
  }

  private static List<Long> revisions(JsonNode page) {
    final List<Long> revisions = new ArrayList<>();
    page.path("data").forEach(release -> revisions.add(release.path("releaseRevision").asLong()));
    return revisions;
  }
}

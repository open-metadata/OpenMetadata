package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.core.setup.Bootstrap;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyPublicationStage;
import org.openmetadata.schema.type.OntologyPublicationStatus;
import org.openmetadata.schema.type.OntologyReleaseChangeSummary;
import org.openmetadata.schema.type.OntologyReviewLock;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;

class OntologyPublicationStatusResolverTest {
  @ParameterizedTest
  @MethodSource("configuredMappers")
  void configuredSerializersPreservePresentEmptyReviewLocks(ObjectMapper mapper) throws Exception {
    final OntologyPublicationStatus status =
        new OntologyPublicationStatus()
            .withUnpublishedChanges(0)
            .withReviewLock(new OntologyReviewLock());
    final JsonNode present = mapper.readTree(mapper.writeValueAsString(status));
    assertTrue(present.path("reviewLock").isObject(), present.toString());
    assertEquals(0, present.path("reviewLock").size());
    status.setReviewLock(null);
    assertFalse(mapper.readTree(mapper.writeValueAsString(status)).has("reviewLock"));
  }

  @ParameterizedTest
  @MethodSource("configuredMappers")
  void noOpenReviewSerializesAsACheckedEmptyLock(ObjectMapper mapper) throws Exception {
    final OntologyPublicationStatus status =
        OntologyPublicationStatusResolver.assemble(OntologyReleaseRoles.Roles.NONE, null, 0);
    final JsonNode json = mapper.readTree(mapper.writeValueAsString(status));
    assertTrue(json.path("reviewLock").isObject(), json.toString());
    assertEquals(0, json.path("reviewLock").size());
  }

  @ParameterizedTest
  @MethodSource("configuredMappers")
  void olderReviewLocksANewerDraftWithoutExposingReviewDetails(ObjectMapper mapper)
      throws Exception {
    final OntologyRelease review =
        release(2, EntityStatus.IN_REVIEW)
            .withSemanticVersion("1.4.0")
            .withReviewTask(UUID.randomUUID())
            .withReviewers(
                List.of(new EntityReference().withId(UUID.randomUUID()).withType("user")));
    final OntologyRelease latest = release(3, EntityStatus.DRAFT);
    final OntologyRelease active = release(1, EntityStatus.APPROVED);
    final OntologyPublicationStatus status =
        OntologyPublicationStatusResolver.assemble(
            new OntologyReleaseRoles.Roles(active, latest, active, review), 12L, 7);
    final JsonNode lock = mapper.readTree(mapper.writeValueAsString(status)).path("reviewLock");
    assertEquals(
        JsonUtils.readTree(
            """
            {"inReview":{"releaseId":"%s","releaseRevision":2,"semanticVersion":"1.4.0"}}
            """
                .formatted(review.getId())),
        lock);
    assertEquals(latest.getId(), status.getLatest().getReleaseId());
    assertEquals(OntologyPublicationStage.DRAFT, status.getLatest().getStage());
    assertEquals(active.getId(), status.getActive().getReleaseId());
    assertEquals(12L, status.getActive().getActivatedAt());
    assertEquals(7, status.getUnpublishedChanges());
  }

  @ParameterizedTest
  @MethodSource("configuredMappers")
  void unversionedReviewKeepsItsRevisionWithoutInventingAVersion(ObjectMapper mapper)
      throws Exception {
    final OntologyRelease review = release(1, EntityStatus.IN_REVIEW);
    final OntologyPublicationStatus status =
        OntologyPublicationStatusResolver.assemble(
            new OntologyReleaseRoles.Roles(null, review, null, review), null, 1);
    final JsonNode reference =
        mapper.readTree(mapper.writeValueAsString(status)).path("reviewLock").path("inReview");
    assertEquals(review.getId().toString(), reference.path("releaseId").asText());
    assertEquals(1L, reference.path("releaseRevision").asLong());
    assertFalse(reference.has("semanticVersion"));
    assertEquals(2, reference.size());
  }

  @ParameterizedTest
  @MethodSource("configuredMappers")
  void oldOrNullLockEnvelopesRemainUnavailable(ObjectMapper mapper) throws Exception {
    for (final String json :
        List.of("{\"unpublishedChanges\":0}", "{\"unpublishedChanges\":0,\"reviewLock\":null}")) {
      final OntologyPublicationStatus status =
          mapper.readValue(json, OntologyPublicationStatus.class);
      assertNull(status.getReviewLock());
      assertFalse(mapper.readTree(mapper.writeValueAsString(status)).has("reviewLock"));
    }
  }

  @ParameterizedTest
  @MethodSource("configuredMappers")
  void oldSummariesDoNotInventAZeroDeprecationCount(ObjectMapper mapper) throws Exception {
    final OntologyReleaseChangeSummary summary =
        mapper.readValue(
            "{\"added\":1,\"changed\":2,\"removed\":3}", OntologyReleaseChangeSummary.class);
    assertNull(summary.getDeprecated());
    assertFalse(mapper.readTree(mapper.writeValueAsString(summary)).has("deprecated"));
    final OntologyRelease release = mapper.readValue("{}", OntologyRelease.class);
    assertNull(release.getChangeSummary());
  }

  private static OntologyRelease release(long revision, EntityStatus status) {
    return new OntologyRelease()
        .withId(UUID.randomUUID())
        .withReleaseRevision(revision)
        .withEntityStatus(status);
  }

  private static Stream<ObjectMapper> configuredMappers() {
    final OpenMetadataApplication application = new OpenMetadataApplication();
    final Bootstrap<OpenMetadataApplicationConfig> bootstrap = new Bootstrap<>(application);
    application.initialize(bootstrap);
    return Stream.of(bootstrap.getObjectMapper(), JsonUtils.getObjectMapper());
  }
}

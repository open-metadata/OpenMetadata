package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import jakarta.json.Json;
import jakarta.ws.rs.ClientErrorException;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyReleaseEvent.EventType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseActivation;

class OntologyReleaseActivationTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void immutableContentChecksDoNotHoldTheOntologyWriteLock(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var release = fixture.capture(ignored -> {});
          fixture
              .releases
              .getDaoCollection()
              .ontologyReleaseDAO()
              .update(release.withEntityStatus(EntityStatus.APPROVED));
          final var activation =
              new OntologyReleaseActivation(
                  fixture.ontologies, fixture.releases, Clock.systemUTC(), ignored -> {});
          final var access =
              new OntologyReleaseActivation.Access(
                  "admin",
                  definitions -> {
                    if (definitions.stream().anyMatch(OntologyRelease.class::isInstance)) {
                      try (final var writer = Executors.newSingleThreadExecutor()) {
                        writer
                            .submit(
                                () ->
                                    fixture.ontologies.patch(
                                        null,
                                        fixture.ontology.getId(),
                                        "admin",
                                        Json.createPatchBuilder()
                                            .add(
                                                "/description",
                                                "Edited while validating the release")
                                            .build()))
                            .get(15, TimeUnit.SECONDS);
                      } catch (InterruptedException
                          | ExecutionException
                          | TimeoutException failure) {
                        throw new AssertionError(failure);
                      }
                    }
                  });
          final var active =
              activation.activate(
                  fixture.ontology.getId(),
                  new ActivateOntologyRelease()
                      .withReleaseId(release.getId())
                      .withExpectedActivationRevision(0L),
                  access);
          assertEquals(release.getId(), active.getActiveReleaseId());
          assertEquals(2L, active.getWorkingRevision());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void projectionEnqueueFailureRollsBackThePointerAndAuditEvent(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var release = fixture.capture(ignored -> {});
          final var dao = fixture.releases.getDaoCollection().ontologyReleaseDAO();
          dao.update(release.withEntityStatus(EntityStatus.APPROVED));
          final var request =
              new ActivateOntologyRelease()
                  .withReleaseId(release.getId())
                  .withExpectedActivationRevision(0L);
          final var access = new OntologyReleaseActivation.Access("admin", ignored -> {});
          final var unavailable =
              new OntologyReleaseActivation(
                  fixture.ontologies,
                  fixture.releases,
                  Clock.systemUTC(),
                  ignored -> {
                    throw new IllegalStateException("outbox unavailable");
                  });
          assertThrows(
              IllegalStateException.class,
              () -> unavailable.activate(fixture.ontology.getId(), request, access));
          final var unchanged = fixture.ontologies.getState(fixture.ontology.getId());
          assertNull(unchanged.getActiveReleaseId());
          assertEquals(0L, unchanged.getActivationRevision());
          assertEquals(1, dao.countEvents(release.getId()));
          final var ready =
              new OntologyReleaseActivation(
                  fixture.ontologies, fixture.releases, Clock.systemUTC(), ignored -> {});
          assertEquals(
              release.getId(),
              ready.activate(fixture.ontology.getId(), request, access).getActiveReleaseId());
          assertEquals(2, dao.countEvents(release.getId()));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void aDraftWithoutReviewersPublishesDirectlyAndRecordsWhy(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var release = fixture.capture(ignored -> {});
          assertEquals(EntityStatus.DRAFT, release.getEntityStatus());

          final var active =
              activation(fixture)
                  .activate(fixture.ontology.getId(), request(release, 0L), editor());

          assertEquals(release.getId(), active.getActiveReleaseId());
          assertEquals(1L, active.getActivationRevision());
          final var stored =
              fixture
                  .releases
                  .getDaoCollection()
                  .ontologyReleaseDAO()
                  .findEntityById(release.getId());
          assertEquals(EntityStatus.APPROVED, stored.getEntityStatus());
          assertEquals(
              OntologyRelease.ApprovalBasis.NO_REVIEWERS_CONFIGURED, stored.getApprovalBasis());
          final var events = events(fixture, release);
          assertEquals(
              List.of(EventType.CAPTURED, EventType.APPROVED, EventType.ACTIVATED),
              events.stream().map(OntologyReleaseEvent::getEventType).toList());
          assertEquals(List.of(), events.get(1).getVoters());
          assertEquals(
              OntologyRelease.ApprovalBasis.NO_REVIEWERS_CONFIGURED,
              events.get(1).getApprovalBasis());
          assertEquals("admin", events.get(1).getCreatedBy());
          assertEquals("admin", events.get(2).getCreatedBy());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void aDraftIsRefusedWithoutChangeWhenReviewersAreListed(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var release = fixture.capture(ignored -> {});
          fixture.ontologies.addRelationship(
              UUID.randomUUID(),
              fixture.ontology.getId(),
              Entity.USER,
              Entity.ONTOLOGY,
              Relationship.REVIEWS);

          final var refused =
              assertThrows(
                  ClientErrorException.class,
                  () ->
                      activation(fixture)
                          .activate(fixture.ontology.getId(), request(release, 0L), editor()));

          assertEquals(409, refused.getResponse().getStatus());
          assertEquals("Reviewers are configured. Request a review.", refused.getMessage());
          final var unchanged = fixture.ontologies.getState(fixture.ontology.getId());
          assertNull(unchanged.getActiveReleaseId());
          assertEquals(0L, unchanged.getActivationRevision());
          final var stored =
              fixture
                  .releases
                  .getDaoCollection()
                  .ontologyReleaseDAO()
                  .findEntityById(release.getId());
          assertEquals(EntityStatus.DRAFT, stored.getEntityStatus());
          assertNull(stored.getApprovalBasis());
          assertEquals(
              1,
              fixture
                  .releases
                  .getDaoCollection()
                  .ontologyReleaseDAO()
                  .countEvents(release.getId()));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void activatingTheActiveReleaseAddsNoEvent(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var release = fixture.capture(ignored -> {});
          final var activation = activation(fixture);
          final var first =
              activation.activate(fixture.ontology.getId(), request(release, 0L), editor());

          final var again =
              activation.activate(
                  fixture.ontology.getId(),
                  request(release, first.getActivationRevision()),
                  editor());

          assertEquals(release.getId(), again.getActiveReleaseId());
          assertEquals(1L, again.getActivationRevision());
          assertEquals(
              3,
              fixture
                  .releases
                  .getDaoCollection()
                  .ontologyReleaseDAO()
                  .countEvents(release.getId()));
        });
  }

  private static OntologyReleaseActivation activation(
      final OntologyCaptureFixture.Fixture fixture) {
    return new OntologyReleaseActivation(
        fixture.ontologies, fixture.releases, Clock.systemUTC(), ignored -> {});
  }

  private static ActivateOntologyRelease request(
      final OntologyRelease release, final long expected) {
    return new ActivateOntologyRelease()
        .withReleaseId(release.getId())
        .withExpectedActivationRevision(expected);
  }

  private static OntologyReleaseActivation.Access editor() {
    return new OntologyReleaseActivation.Access("admin", ignored -> {});
  }

  private static List<OntologyReleaseEvent> events(
      final OntologyCaptureFixture.Fixture fixture, final OntologyRelease release) {
    return fixture.releases.listEvents(release.getId(), 10, null).getData();
  }
}

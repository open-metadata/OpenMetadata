package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import jakarta.json.Json;
import java.time.Clock;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
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
              new OntologyReleaseActivation(fixture.ontologies, Clock.systemUTC(), ignored -> {});
          final var access =
              new OntologyReleaseActivation.Access(
                  "admin",
                  definition -> {
                    if (definition instanceof OntologyRelease) {
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
                            .get(3, TimeUnit.SECONDS);
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
              new OntologyReleaseActivation(fixture.ontologies, Clock.systemUTC(), ignored -> {});
          assertEquals(
              release.getId(),
              ready.activate(fixture.ontology.getId(), request, access).getActiveReleaseId());
          assertEquals(2, dao.countEvents(release.getId()));
        });
  }
}

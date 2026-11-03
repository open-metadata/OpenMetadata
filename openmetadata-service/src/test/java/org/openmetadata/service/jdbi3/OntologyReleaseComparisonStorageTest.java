package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import jakarta.ws.rs.ForbiddenException;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseActivation;
import org.openmetadata.service.ontology.OntologyReleaseComparison;

class OntologyReleaseComparisonStorageTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void groupedWorkingPagesKeepTheirRevisionAndCursorKind(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          fixture.addConcepts(2);
          final var comparison = new OntologyReleaseComparison(fixture.releases);
          final var first =
              fixture
                  .capture
                  .snapshot()
                  .read(
                      fixture.ontology.getId(),
                      ignored -> {},
                      snapshot ->
                          comparison.compareWorkingByConcept(snapshot, 1, null, ignored -> {}));
          assertEquals(3, first.getPaging().getTotal());
          assertEquals(1, first.getGroups().size());
          final String cursor = first.getPaging().getAfter();
          assertNotNull(cursor);
          fixture
              .capture
              .snapshot()
              .read(
                  fixture.ontology.getId(),
                  ignored -> {},
                  snapshot -> {
                    final var next =
                        comparison.compareWorkingByConcept(snapshot, 1, cursor, ignored -> {});
                    assertEquals(1, next.getGroups().size());
                    assertThrows(
                        BadRequestException.class,
                        () -> comparison.compareWorking(snapshot, 1, cursor, ignored -> {}));
                    return null;
                  });
          fixture.concepts.create(
              null,
              new OntologyConcept()
                  .withId(UUID.randomUUID())
                  .withName("Concept2")
                  .withOntology(fixture.ontology.getEntityReference())
                  .withConceptType(OntologyConceptType.OWL_CLASS)
                  .withVersion(0.1)
                  .withUpdatedAt(1L)
                  .withUpdatedBy("admin"));
          fixture
              .capture
              .snapshot()
              .read(
                  fixture.ontology.getId(),
                  ignored -> {},
                  snapshot -> {
                    assertThrows(
                        PreconditionFailedException.class,
                        () ->
                            comparison.compareWorkingByConcept(snapshot, 1, cursor, ignored -> {}));
                    return null;
                  });
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void workingChangesPreviewActiveReleaseWithoutAllocatingAnotherRelease(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var concept =
              fixture.concepts.create(
                  null,
                  new OntologyConcept()
                      .withId(UUID.randomUUID())
                      .withName("Customer")
                      .withOntology(fixture.ontology.getEntityReference())
                      .withConceptType(OntologyConceptType.OWL_CLASS)
                      .withVersion(0.1)
                      .withUpdatedAt(1L)
                      .withUpdatedBy("admin"));
          final var active = fixture.capture(ignored -> {}).withEntityStatus(EntityStatus.APPROVED);
          fixture.releases.getDao().update(active);
          new OntologyReleaseActivation(fixture.ontologies, Clock.systemUTC(), ignored -> {})
              .activate(
                  fixture.ontology.getId(),
                  new ActivateOntologyRelease()
                      .withReleaseId(active.getId())
                      .withExpectedActivationRevision(0L),
                  new OntologyReleaseActivation.Access("admin", ignored -> {}));
          fixture.concepts.update(
              null,
              concept,
              JsonUtils.deepCopy(concept, OntologyConcept.class).withDescription("Changed"),
              "admin");
          final var diff =
              fixture
                  .capture
                  .snapshot()
                  .read(
                      fixture.ontology.getId(),
                      ignored -> {},
                      snapshot ->
                          new OntologyReleaseComparison(fixture.releases)
                              .compareWorking(snapshot, 1, null, ignored -> {}));
          assertEquals(1, diff.getPaging().getTotal());
          assertEquals(
              OntologyReleaseChangeType.CHANGED, diff.getData().getFirst().getChangeType());
          assertEquals(active.getId(), diff.getData().getFirst().getBeforeReleaseId());
          assertEquals(null, diff.getData().getFirst().getAfterReleaseId());
          assertEquals(1, fixture.rowCount("ontology_release_entity"));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void changesRetainBothSnapshotsAndTheirPermissions(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var root = fixture.ontology;
          final var concept =
              fixture.concepts.create(
                  null,
                  new OntologyConcept()
                      .withId(UUID.randomUUID())
                      .withName("Customer")
                      .withDescription("Original meaning")
                      .withOntology(root.getEntityReference())
                      .withConceptType(OntologyConceptType.OWL_CLASS)
                      .withVersion(0.1)
                      .withUpdatedAt(1L)
                      .withUpdatedBy("admin"));
          final var previous = fixture.capture(ignored -> {});
          fixture.releases.getDao().update(previous.withEntityStatus(EntityStatus.APPROVED));
          new OntologyReleaseActivation(fixture.ontologies, Clock.systemUTC(), ignored -> {})
              .activate(
                  root.getId(),
                  new ActivateOntologyRelease()
                      .withReleaseId(previous.getId())
                      .withExpectedActivationRevision(0L),
                  new OntologyReleaseActivation.Access("admin", ignored -> {}));

          fixture.concepts.update(
              null,
              concept,
              JsonUtils.deepCopy(concept, OntologyConcept.class).withDescription("Revised meaning"),
              "admin");
          final var proposed = fixture.capture(ignored -> {});
          assertEquals(previous.getId(), proposed.getBaseReleaseId());
          fixture.releases.getDaoCollection().ontologyConceptDAO().delete(concept.getId());

          final var comparison = new OntologyReleaseComparison(fixture.releases);
          final var result = comparison.compare(proposed, previous, 1, null, ignored -> {});
          assertEquals(1, result.getPaging().getTotal());
          final var change = result.getData().getFirst();
          assertEquals(concept.getId(), change.getEntity().getId());
          assertEquals(root.getId(), change.getOntologyId());
          assertEquals(OntologyReleaseChangeType.CHANGED, change.getChangeType());
          assertEquals(previous.getId(), change.getBeforeReleaseId());
          assertEquals(proposed.getId(), change.getAfterReleaseId());

          for (final String restricted : List.of("Original meaning", "Revised meaning")) {
            assertThrows(
                ForbiddenException.class,
                () ->
                    comparison.compare(
                        proposed,
                        previous,
                        1,
                        null,
                        definitions -> {
                          if (definitions.stream()
                              .anyMatch(
                                  definition -> restricted.equals(definition.getDescription()))) {
                            throw new ForbiddenException("Restricted definition");
                          }
                        }));
          }
        });
  }
}

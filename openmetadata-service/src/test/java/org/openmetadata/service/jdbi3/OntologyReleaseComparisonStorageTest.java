package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import jakarta.ws.rs.ForbiddenException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseComparison;

class OntologyReleaseComparisonStorageTest {
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
          fixture
              .releases
              .getDao()
              .update(
                  previous.withEntityStatus(org.openmetadata.schema.type.EntityStatus.APPROVED));
          new org.openmetadata.service.ontology.OntologyReleaseActivation(
                  fixture.ontologies, java.time.Clock.systemUTC(), ignored -> {})
              .activate(
                  root.getId(),
                  new org.openmetadata.schema.api.data.ActivateOntologyRelease()
                      .withReleaseId(previous.getId())
                      .withExpectedActivationRevision(0L),
                  new org.openmetadata.service.ontology.OntologyReleaseActivation.Access(
                      "admin", ignored -> {}));

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
                        definition -> {
                          if (restricted.equals(definition.getDescription())) {
                            throw new ForbiddenException("Restricted definition");
                          }
                        }));
          }
        });
  }
}

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import java.net.URI;
import java.time.Clock;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyDefinitionStatus;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyPublicationStage;
import org.openmetadata.schema.type.OntologyPublicationStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.OntologyCaptureFixture.Fixture;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseActivation;
import org.openmetadata.service.ontology.OntologyReleaseComparison;
import org.openmetadata.service.util.RequestEntityCache;

class OntologyDerivedStatusStorageTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void definitionStatusFollowsTheReleaseThatHoldsTheDefinition(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final UUID a = concept(fixture, "A").getId();
          final UUID b = concept(fixture, "B").getId();
          final UUID c = concept(fixture, "C").getId();
          assertEquals(OntologyDefinitionStatus.DRAFT, status(fixture, a));

          final OntologyRelease first = fixture.capture(ignored -> {});
          assertEquals(OntologyDefinitionStatus.DRAFT, status(fixture, a));

          setStatus(fixture, first, EntityStatus.IN_REVIEW);
          assertEquals(OntologyDefinitionStatus.IN_REVIEW, status(fixture, a));
          assertEquals(OntologyDefinitionStatus.IN_REVIEW, status(fixture, c));

          setStatus(fixture, first, EntityStatus.APPROVED);
          assertEquals(OntologyDefinitionStatus.APPROVED, status(fixture, a));

          edit(fixture, a, "changed after approval");
          edit(fixture, b, "temporary");
          edit(fixture, b, null);
          assertAll(
              () -> assertEquals(OntologyDefinitionStatus.DRAFT, status(fixture, a)),
              () -> assertEquals(OntologyDefinitionStatus.APPROVED, status(fixture, b)),
              () -> assertEquals(OntologyDefinitionStatus.APPROVED, status(fixture, c)));

          final UUID d = concept(fixture, "D").getId();
          fixture.concepts.delete("admin", c, false, false);
          final OntologyRelease second = fixture.capture(ignored -> {});
          setStatus(fixture, second, EntityStatus.IN_REVIEW);
          assertAll(
              () -> assertEquals(OntologyDefinitionStatus.IN_REVIEW, status(fixture, a)),
              () -> assertEquals(OntologyDefinitionStatus.IN_REVIEW, status(fixture, d)),
              () -> assertEquals(OntologyDefinitionStatus.APPROVED, status(fixture, b)));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void publicationStatusCountsExactlyTheRowsOfTheWorkingDiff(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final UUID a = concept(fixture, "A").getId();
          final UUID b = concept(fixture, "B").getId();
          final UUID c = concept(fixture, "C").getId();
          OntologyPublicationStatus status = publication(fixture);
          assertAll(
              () -> assertNull(status.getActive()),
              () -> assertNull(status.getLatest()),
              () -> assertEquals(4, status.getUnpublishedChanges()),
              () -> assertEquals(workingDiffRows(fixture), 4));

          final OntologyRelease first = fixture.capture(ignored -> {});
          assertEquals(OntologyPublicationStage.DRAFT, publication(fixture).getLatest().getStage());
          setStatus(fixture, first, EntityStatus.REJECTED);
          assertEquals(
              OntologyPublicationStage.CHANGES_REQUESTED,
              publication(fixture).getLatest().getStage());
          setStatus(fixture, first, EntityStatus.IN_REVIEW);
          assertEquals(
              OntologyPublicationStage.IN_REVIEW, publication(fixture).getLatest().getStage());
          setStatus(fixture, first, EntityStatus.APPROVED);
          assertEquals(
              OntologyPublicationStage.APPROVED, publication(fixture).getLatest().getStage());

          activate(fixture, first);
          final OntologyPublicationStatus published = publication(fixture);
          assertAll(
              () -> assertEquals(first.getId(), published.getActive().getReleaseId()),
              () -> assertEquals(1L, published.getActive().getReleaseRevision()),
              () -> assertNotNull(published.getActive().getActivatedAt()),
              () ->
                  assertEquals(
                      OntologyPublicationStage.PUBLISHED, published.getLatest().getStage()),
              () -> assertEquals(0, published.getUnpublishedChanges()));

          edit(fixture, a, "changed");
          edit(fixture, b, "temporary");
          edit(fixture, b, null);
          concept(fixture, "D");
          fixture.concepts.delete("admin", c, false, false);
          assertAll(
              () -> assertEquals(3, publication(fixture).getUnpublishedChanges()),
              () -> assertEquals(3, workingDiffRows(fixture)));

          final OntologyRelease second = fixture.capture(ignored -> {});
          final OntologyRelease stored = fixture.releases.getDao().findEntityById(second.getId());
          assertAll(
              () -> assertEquals(1, stored.getChangeSummary().getAdded()),
              () -> assertEquals(1, stored.getChangeSummary().getChanged()),
              () -> assertEquals(1, stored.getChangeSummary().getRemoved()),
              () ->
                  assertEquals(
                      3,
                      new OntologyReleaseComparison(fixture.releases)
                          .compare(stored, first, 1000, null, ignored -> {})
                          .getPaging()
                          .getTotal()),
              () ->
                  assertEquals(
                      OntologyPublicationStage.DRAFT, publication(fixture).getLatest().getStage()),
              () -> assertEquals(first.getId(), publication(fixture).getActive().getReleaseId()));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void publicationStatusCountsPropertyAndOntologyEditsAfterActivation(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final OntologyPropertyRepository properties = new OntologyPropertyRepository();
          final OntologyProperty property =
              properties.create(
                  null,
                  new OntologyProperty()
                      .withId(UUID.randomUUID())
                      .withName("hasOwner")
                      .withOntology(fixture.ontology.getEntityReference())
                      .withKind(OntologyPropertyKind.OBJECT)
                      .withVersion(0.1)
                      .withUpdatedAt(1L)
                      .withUpdatedBy("admin"));
          final OntologyRelease first = fixture.capture(ignored -> {});
          setStatus(fixture, first, EntityStatus.APPROVED);
          activate(fixture, first);
          assertEquals(0, publication(fixture).getUnpublishedChanges());

          final OntologyProperty original =
              properties.get(null, property.getId(), properties.getFields(""));
          properties.update(
              null,
              original,
              JsonUtils.deepCopy(original, OntologyProperty.class).withDescription("owner"),
              "admin");
          final Ontology ontology =
              fixture.ontologies.get(
                  null, fixture.ontology.getId(), fixture.ontologies.getFields(""));
          fixture.ontologies.update(
              null,
              ontology,
              JsonUtils.deepCopy(ontology, Ontology.class).withDescription("edited"),
              "admin");
          properties.delete("admin", property.getId(), false, false);
          assertAll(
              () -> assertEquals(2, publication(fixture).getUnpublishedChanges()),
              () -> assertEquals(2, workingDiffRows(fixture)));
        });
  }

  private static OntologyConcept concept(Fixture fixture, String name) {
    return fixture.concepts.create(
        null,
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName(name)
            .withOntology(fixture.ontology.getEntityReference())
            .withIri(URI.create("urn:class:" + name))
            .withConceptType(OntologyConceptType.OWL_CLASS)
            .withVersion(0.1)
            .withUpdatedAt(1L)
            .withUpdatedBy("admin"));
  }

  private static void edit(Fixture fixture, UUID id, String description) {
    final OntologyConcept original = fixture.concepts.get(null, id, fixture.concepts.getFields(""));
    fixture.concepts.update(
        null,
        original,
        JsonUtils.deepCopy(original, OntologyConcept.class).withDescription(description),
        "admin");
  }

  private static OntologyDefinitionStatus status(Fixture fixture, UUID id) {
    RequestEntityCache.clear();
    return fixture
        .concepts
        .get(null, id, fixture.concepts.getFields("lifecycleStatus"))
        .getLifecycleStatus();
  }

  private static OntologyPublicationStatus publication(Fixture fixture) {
    RequestEntityCache.clear();
    return fixture
        .ontologies
        .get(null, fixture.ontology.getId(), fixture.ontologies.getFields("publicationStatus"))
        .getPublicationStatus();
  }

  private static void setStatus(Fixture fixture, OntologyRelease release, EntityStatus status) {
    fixture.releases.getDao().update(release.withEntityStatus(status));
  }

  private static void activate(Fixture fixture, OntologyRelease release) {
    new OntologyReleaseActivation(fixture.ontologies, Clock.systemUTC(), ignored -> {})
        .activate(
            fixture.ontology.getId(),
            new ActivateOntologyRelease()
                .withReleaseId(release.getId())
                .withExpectedActivationRevision(0L),
            new OntologyReleaseActivation.Access("admin", ignored -> {}));
  }

  private static int workingDiffRows(Fixture fixture) {
    final Consumer<java.util.List<? extends OntologyDefinition>> allowAll = ignored -> {};
    return fixture
        .capture
        .snapshot()
        .read(
            fixture.ontology.getId(),
            allowAll,
            working ->
                new OntologyReleaseComparison(fixture.releases)
                    .compareWorking(working, 1000, null, allowAll)
                    .getPaging()
                    .getTotal());
  }
}

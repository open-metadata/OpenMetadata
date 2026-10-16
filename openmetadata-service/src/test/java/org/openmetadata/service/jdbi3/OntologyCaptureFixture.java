package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrate;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.net.URI;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseCapture;

final class OntologyCaptureFixture {
  private OntologyCaptureFixture() {}

  static void withCapture(ConnectionType dialect, Consumer<Fixture> assertion) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          CollectionDAO previous = Entity.getCollectionDAO();
          SystemRepository previousSettings = Entity.getSystemRepository();
          EntityRelationshipRepository previousRelationships =
              Entity.getEntityRelationshipRepository();
          Entity.setCollectionDAO(handle.getJdbi().onDemand(CollectionDAO.class));
          Entity.setEntityRelationshipRepository(
              new EntityRelationshipRepository(Entity.getCollectionDAO()));
          try {
            new SystemRepository();
            assertion.accept(new Fixture(handle));
          } finally {
            Entity.setCollectionDAO(previous);
            Entity.setSystemRepository(previousSettings);
            Entity.setEntityRelationshipRepository(previousRelationships);
          }
        });
  }

  static final class Fixture {
    final Handle handle;
    final OntologyRepository ontologies = new OntologyRepository();
    final OntologyConceptRepository concepts = new OntologyConceptRepository();
    final OntologyReleaseRepository releases = new OntologyReleaseRepository();
    final OntologyReleaseCapture capture =
        new OntologyReleaseCapture(
            releases,
            ontologies,
            Map.of(
                MemberKind.CONCEPT, concepts,
                MemberKind.PROPERTY, new OntologyPropertyRepository(),
                MemberKind.AXIOM, new OntologyAxiomRepository()),
            Clock.systemUTC());
    final Ontology ontology;
    private UUID lastCaptureId;

    private Fixture(Handle handle) {
      this.handle = handle;
      ontology =
          ontologies.create(
              null,
              new Ontology()
                  .withId(UUID.randomUUID())
                  .withName("Capture" + UUID.randomUUID())
                  .withIri(URI.create("urn:ontology:capture"))
                  .withNamespace(URI.create("https://example.org/capture/"))
                  .withVersion(0.1)
                  .withUpdatedAt(1L)
                  .withUpdatedBy("admin"));
    }

    OntologyRelease capture(Consumer<EntityReference> authorize) {
      OntologyRelease release =
          capture.capture(
              ontology.getId(),
              new CaptureOntologyRelease()
                  .withExpectedWorkingRevision(
                      ontologies.getState(ontology.getId()).getWorkingRevision()),
              new OntologyReleaseCapture.Access(
                  "admin", definition -> authorize.accept(definition.getEntityReference())));
      lastCaptureId = release.getId();
      return release;
    }

    void addConcepts(int count) {
      List<OntologyConcept> members =
          IntStream.range(0, count)
              .mapToObj(
                  index ->
                      new OntologyConcept()
                          .withId(UUID.randomUUID())
                          .withName("Concept" + index)
                          .withOntology(ontology.getEntityReference())
                          .withConceptType(OntologyConceptType.OWL_CLASS)
                          .withVersion(0.1)
                          .withUpdatedAt(1L)
                          .withUpdatedBy("admin"))
              .toList();
      members.forEach(member -> concepts.create(null, member));
    }

    int rowCount(String table) {
      boolean member = table.equals("ontology_release_member");
      UUID id = member ? lastCaptureId : ontology.getId();
      return handle
          .createQuery(
              "SELECT COUNT(*) FROM "
                  + table
                  + " WHERE "
                  + (member ? "releaseId" : "ontologyId")
                  + " = :id")
          .bind("id", id.toString())
          .mapTo(Integer.class)
          .one();
    }
  }
}

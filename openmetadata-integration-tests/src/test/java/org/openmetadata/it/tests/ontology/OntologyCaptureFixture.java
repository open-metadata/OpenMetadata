package org.openmetadata.it.tests.ontology;

import static org.openmetadata.it.tests.ontology.OntologyTestDatabase.migrate;
import static org.openmetadata.it.tests.ontology.OntologyTestDatabase.withDatabase;

import java.net.URI;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.jdbi3.OntologyAxiomRepository;
import org.openmetadata.service.jdbi3.OntologyConceptRepository;
import org.openmetadata.service.jdbi3.OntologyPropertyRepository;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseActivation;
import org.openmetadata.service.ontology.OntologyReleaseCapture;

public final class OntologyCaptureFixture {
  private OntologyCaptureFixture() {}

  public static void withCapture(ConnectionType dialect, Consumer<Fixture> assertion) {
    withDatabase(
        handle -> {
          migrate(handle, dialect);
          final var registry = EntityRegistrySnapshot.capture();
          Entity.setCollectionDAO(handle.getJdbi().onDemand(CollectionDAO.class));
          Entity.setEntityRelationshipRepository(
              new EntityRelationshipRepository(Entity.getCollectionDAO()));
          try {
            new SystemRepository();
            new TaskRepository();
            assertion.accept(new Fixture(handle));
          } finally {
            registry.restore();
          }
        });
  }

  public static final class Fixture {
    public final Handle handle;
    public final OntologyRepository ontologies = new OntologyRepository();
    public final OntologyConceptRepository concepts = new OntologyConceptRepository();
    public final OntologyReleaseRepository releases = new OntologyReleaseRepository();
    public final OntologyReleaseCapture capture =
        new OntologyReleaseCapture(
            releases,
            ontologies,
            Map.of(
                MemberKind.CONCEPT, concepts,
                MemberKind.PROPERTY, new OntologyPropertyRepository(),
                MemberKind.AXIOM, new OntologyAxiomRepository()),
            Clock.systemUTC());
    public final Ontology ontology;
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

    public OntologyRelease capture(Consumer<EntityReference> authorize) {
      OntologyRelease release =
          capture.capture(
              ontology.getId(),
              new CaptureOntologyRelease()
                  .withExpectedWorkingRevision(
                      ontologies.getState(ontology.getId()).getWorkingRevision()),
              new OntologyReleaseCapture.Access(
                  "admin",
                  definitions ->
                      definitions.forEach(
                          definition -> authorize.accept(definition.getEntityReference()))));
      lastCaptureId = release.getId();
      return release;
    }

    public void addConcept(String name) {
      concepts.create(
          null,
          new OntologyConcept()
              .withId(UUID.randomUUID())
              .withName(name)
              .withOntology(ontology.getEntityReference())
              .withConceptType(OntologyConceptType.OWL_CLASS)
              .withVersion(0.1)
              .withUpdatedAt(1L)
              .withUpdatedBy("admin"));
    }

    public void addConcepts(int count) {
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

    public void activate(OntologyRelease release, long expectedActivationRevision) {
      releases.getDao().update(release.withEntityStatus(EntityStatus.APPROVED));
      new OntologyReleaseActivation(ontologies, releases, Clock.systemUTC(), ignored -> {})
          .activate(
              ontology.getId(),
              new ActivateOntologyRelease()
                  .withReleaseId(release.getId())
                  .withExpectedActivationRevision(expectedActivationRevision),
              new OntologyReleaseActivation.Access("admin", ignored -> {}));
    }

    public int rowCount(String table) {
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

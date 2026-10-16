package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import jakarta.json.Json;
import java.time.Clock;
import java.util.UUID;
import org.apache.jena.atlas.iterator.Iter;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.jdbi3.OntologyCaptureFixture.Fixture;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseActivation;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class OntologyActiveGraphStorageTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void projectionFollowsOnlyTheActiveReleaseAndRebuildRemovesArchivedGraphs(
      ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final Dataset dataset = DatasetFactory.createTxnMem();
          try {
            final var storage = storage(dataset);
            final var projection = new OntologyActiveGraph(fixture.releases.getDaoCollection());
            final var id = fixture.ontology.getId();
            projection.refresh(id, storage);
            assertTrue(dataset.getNamedModel(OntologyActiveGraph.graph(id)).isEmpty());
            final var first = fixture.capture(ignored -> {});
            activate(fixture, first, 0);
            projection.refresh(id, storage);
            final Model original = dataset.getNamedModel(OntologyActiveGraph.graph(id));
            assertTrue(original.contains(null, RDFS.label, fixture.ontology.getName()));
            fixture.ontologies.patch(
                null,
                id,
                "admin",
                Json.createPatchBuilder().add("/displayName", "Working label").build());
            projection.refresh(id, storage);
            assertFalse(
                dataset
                    .getNamedModel(OntologyActiveGraph.graph(id))
                    .contains(null, RDFS.label, "Working label"));
            final var second = fixture.capture(ignored -> {});
            activate(fixture, second, 1);
            projection.refresh(id, storage);
            assertTrue(
                dataset
                    .getNamedModel(OntologyActiveGraph.graph(id))
                    .contains(null, RDFS.label, "Working label"));
            activate(fixture, first, 2);
            projection.rebuild(storage);
            assertFalse(
                dataset
                    .getNamedModel(OntologyActiveGraph.graph(id))
                    .contains(null, RDFS.label, "Working label"));
            fixture.ontologies.delete("admin", id, false, false);
            projection.rebuild(storage);
            assertTrue(dataset.getNamedModel(OntologyActiveGraph.graph(id)).isEmpty());
            fixture.ontologies.restoreEntity("admin", id);
            projection.rebuild(storage);
            assertTrue(
                dataset
                    .getNamedModel(OntologyActiveGraph.graph(id))
                    .contains(null, RDFS.label, fixture.ontology.getName()));
            final var orphan = OntologyActiveGraph.graph(UUID.randomUUID());
            storage.executeSparqlUpdate(
                "INSERT DATA { GRAPH <" + orphan + "> { <urn:s> <urn:p> <urn:o> } }");
            projection.rebuild(storage);
            assertTrue(dataset.getNamedModel(orphan).isEmpty());
          } finally {
            dataset.close();
          }
        });
  }

  private static void activate(Fixture fixture, OntologyRelease release, long expected) {
    fixture
        .releases
        .getDaoCollection()
        .ontologyReleaseDAO()
        .update(release.withEntityStatus(EntityStatus.APPROVED));
    new OntologyReleaseActivation(fixture.ontologies, Clock.systemUTC(), ignored -> {})
        .activate(
            fixture.ontology.getId(),
            new ActivateOntologyRelease()
                .withReleaseId(release.getId())
                .withExpectedActivationRevision(expected),
            new OntologyReleaseActivation.Access("admin", ignored -> {}));
  }

  private static RdfStorageInterface storage(Dataset dataset) {
    final var storage = mock(RdfStorageInterface.class, CALLS_REAL_METHODS);
    doAnswer(
            call -> {
              UpdateAction.parseExecute(call.getArgument(0), dataset);
              return null;
            })
        .when(storage)
        .executeSparqlUpdate(anyString());
    when(storage.getAllGraphs()).thenAnswer(ignored -> Iter.toList(dataset.listNames()));
    return storage;
  }
}

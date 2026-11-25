package org.openmetadata.it.tests.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.it.tests.ontology.OntologyCaptureFixture.withCapture;
import static org.openmetadata.it.tests.ontology.OntologyTestDatabase.repositoryRoot;

import jakarta.json.Json;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import org.apache.jena.atlas.iterator.Iter;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.tests.ontology.OntologyCaptureFixture.Fixture;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.ontology.OntologyReleaseActivation;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

@Isolated("swaps the static Entity collection DAO and repository registry to a scratch database")
class OntologyActiveGraphStorageIT {
  @Test
  void rebuildCannotOverwriteAnActivationDeliveredWhileItsModelWasBeingBuilt() {
    ConnectionType dialect = ScratchDatabase.dialect();
    withCapture(
        dialect,
        fixture -> {
          migrateQueue(fixture, dialect);
          final var first = fixture.capture(ignored -> {});
          activate(fixture, first, 0);
          fixture.ontologies.patch(
              null,
              fixture.ontology.getId(),
              "admin",
              Json.createPatchBuilder().add("/displayName", "New active release").build());
          final var second = fixture.capture(ignored -> {});
          final var queue = new RdfLiveWriteStore(fixture.handle.getJdbi(), Clock.systemUTC());
          final var projection = new OntologyActiveGraph(fixture.releases.getDaoCollection());
          final var modelBuilt = new CountDownLatch(1);
          final var resumeRebuild = new CountDownLatch(1);
          final var pause = new AtomicBoolean(true);
          final Dataset dataset = DatasetFactory.createTxnMem();
          try (var workers = Executors.newSingleThreadExecutor()) {
            final var storage = storage(dataset);
            doAnswer(
                    call -> {
                      if (pause.compareAndSet(true, false)) {
                        modelBuilt.countDown();
                        assertTrue(resumeRebuild.await(10, TimeUnit.SECONDS));
                      }
                      return call.callRealMethod();
                    })
                .when(storage)
                .replaceGraph(anyString(), any(), any(Model.class));
            final var rebuilding = workers.submit(() -> projection.rebuild(storage));
            try {
              assertTrue(modelBuilt.await(10, TimeUnit.SECONDS));
              activate(fixture, second, 1);
              queue.enqueue("refresh");
              queue.processNext(ignored -> projection.refresh(fixture.ontology.getId(), storage));
            } finally {
              resumeRebuild.countDown();
            }
            rebuilding.get(10, TimeUnit.SECONDS);
            queue.processNext(ignored -> projection.refresh(fixture.ontology.getId(), storage));
            assertEquals(0, queue.pendingWrites());
            assertTrue(
                dataset
                    .getNamedModel(OntologyActiveGraph.graph(fixture.ontology.getId()))
                    .contains(null, RDFS.label, "New active release"));
          } catch (InterruptedException | ExecutionException | TimeoutException failure) {
            throw new AssertionError(failure);
          } finally {
            dataset.close();
          }
        });
  }

  @Test
  void projectionFollowsOnlyTheActiveReleaseAndRebuildRemovesArchivedGraphs() {
    ConnectionType dialect = ScratchDatabase.dialect();
    withCapture(
        dialect,
        fixture -> {
          migrateQueue(fixture, dialect);
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
            assertFalse(original.contains(null, RDF.type, OWL2.Axiom));
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

  @Test
  void aWriteBeingDeliveredQueuesTheBoundAssetsItRefreshesAfterItself() {
    ConnectionType dialect = ScratchDatabase.dialect();
    withCapture(
        dialect,
        fixture -> {
          migrateQueue(fixture, dialect);
          final var queue = new RdfLiveWriteStore(fixture.handle.getJdbi(), Clock.systemUTC());
          final List<String> delivered = new ArrayList<>();
          queue.enqueue("release");
          assertTrue(
              queue.processNext(
                  payload -> {
                    delivered.add(payload);
                    queue.enqueueAll(List.of("asset-1", "asset-2"));
                  }));
          while (queue.processNext(delivered::add)) {
            assertTrue(delivered.size() <= 3, () -> "delivered " + delivered);
          }
          assertEquals(List.of("release", "asset-1", "asset-2"), delivered);
          assertEquals(0, queue.pendingWrites());
        });
  }

  private static void migrateQueue(Fixture fixture, ConnectionType dialect) {
    for (final String version : List.of("2.0.2", "2.1.0")) {
      final var migration =
          repositoryRoot()
              .resolve("bootstrap/sql/migrations/native")
              .resolve(version)
              .resolve(dialect == ConnectionType.MYSQL ? "mysql" : "postgres")
              .resolve("schemaChanges.sql");
      MigrationFile.parseSQLFile(migration.toFile(), dialect).stream()
          .filter(
              statement ->
                  statement.contains("rdf_live_write")
                      || statement.contains("rdf_projection_health"))
          .forEach(fixture.handle::execute);
    }
  }

  private static void activate(Fixture fixture, OntologyRelease release, long expected) {
    fixture
        .releases
        .getDaoCollection()
        .ontologyReleaseDAO()
        .update(release.withEntityStatus(EntityStatus.APPROVED));
    new OntologyReleaseActivation(
            fixture.ontologies, fixture.releases, Clock.systemUTC(), ignored -> {})
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

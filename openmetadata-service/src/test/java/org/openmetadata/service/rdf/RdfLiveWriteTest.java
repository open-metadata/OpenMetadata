/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

class RdfLiveWriteTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String BROADER = "http://www.w3.org/2004/02/skos/core#broader";
  private final Dataset dataset = DatasetFactory.create();
  private final AtomicBoolean unavailable = new AtomicBoolean();
  private Table currentEntity;
  private final RdfRepository repository = repository();

  @AfterEach
  void close() {
    dataset.close();
    RdfProjectionHealth.markReady();
  }

  @Test
  void replayReadsCurrentMetadataAndDoesNotRestoreAnObsoleteSnapshot() {
    final UUID id = UUID.randomUUID();
    final Table table =
        new Table()
            .withId(id)
            .withName("original")
            .withFullyQualifiedName("service.db.schema.original");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    currentEntity = table;
    final RdfLiveWrite update = RdfLiveWrite.EntityUpdate.capture(table);
    table.setName("changed");
    replay(update);
    final Model graph = dataset.getNamedModel(GRAPH);
    assertTrue(graph.contains(graph.createResource(BASE + "entity/table/" + id), null));
    assertFalse(graph.contains(null, null, "original"));
    assertTrue(graph.contains(null, null, "changed"));
    replay(new RdfLiveWrite.EntityDelete(Entity.TABLE, id));
    assertFalse(graph.contains(graph.createResource(BASE + "entity/table/" + id), null));
  }

  @Test
  void replayedGenericRelationshipAdditionAndRemovalChangeTheGraph() {
    final EntityRelationship relationship =
        new EntityRelationship()
            .withFromId(UUID.randomUUID())
            .withToId(UUID.randomUUID())
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    replay(RdfLiveWrite.RelationshipChange.capture(relationship, false));
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());
    replay(RdfLiveWrite.RelationshipChange.capture(relationship, true));
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void replayedGlossaryRelationsPreserveTypedPredicatesAndBothDirectionRemoval() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", false));
    replay(new RdfLiveWrite.GlossaryRelationChange(to, from, "broader", false));
    final Model graph = dataset.getNamedModel(GRAPH);
    assertEquals(2, graph.listObjectsOfProperty(graph.createProperty(BROADER)).toList().size());
    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", true));
    assertTrue(graph.isEmpty());
  }

  @ParameterizedTest
  @MethodSource("commands")
  void everyStorageFailureRemainsRetryable(final RdfLiveWrite command) {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    currentEntity = new Table().withId(UUID.randomUUID()).withName("table");
    unavailable.set(true);
    final RuntimeException failure = assertThrows(RuntimeException.class, () -> replay(command));
    assertEquals("storage unavailable", failure.getCause().getMessage());
    assertTrue(RdfProjectionHealth.isDegraded());
  }

  @Test
  void durableFailureDoesNotLeaveAStickyMarkerAfterSuccessfulRecovery() {
    unavailable.set(true);
    final RdfLiveWrite command = new RdfLiveWrite.EntityDelete(Entity.TABLE, UUID.randomUUID());
    assertThrows(
        RuntimeException.class,
        () -> RdfProjectionHealth.withDurableRecovery(() -> replay(command)));
    assertFalse(RdfProjectionHealth.isDegraded());
    RdfProjectionHealth.markDegraded();
    assertTrue(RdfProjectionHealth.isDegraded());
  }

  @Test
  void replayAfterHardDeleteRemovesTheOldEntity() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    currentEntity = new Table().withId(UUID.randomUUID()).withName("table");
    final RdfLiveWrite update = RdfLiveWrite.EntityUpdate.capture(currentEntity);
    replay(update);
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());
    currentEntity = null;
    replay(update);
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  private void replay(final RdfLiveWrite command) {
    final RdfLiveWrite restored =
        JsonUtils.readValue(JsonUtils.pojoToJson(command), RdfLiveWrite.class);
    assertEquals(command, restored);
    restored.apply(repository);
  }

  private RdfRepository repository() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doAnswer(
            call -> {
              requireAvailable();
              UpdateAction.parseExecute(call.getArgument(0), dataset);
              return null;
            })
        .when(storage)
        .executeSparqlUpdate(anyString());
    doAnswer(
            call -> {
              requireAvailable();
              dataset.getNamedModel(GRAPH).add((Model) call.getArgument(2));
              return null;
            })
        .when(storage)
        .storeEntity(anyString(), any(UUID.class), any(Model.class));
    final CollectionDAO.RelationshipTypeDAO types = mock(CollectionDAO.RelationshipTypeDAO.class);
    when(types.findEntityByName("broader", Include.NON_DELETED))
        .thenReturn(
            new RelationshipType().withName("broader").withRdfPredicate(URI.create(BROADER)));
    when(types.listActive())
        .thenReturn(
            List.of(
                JsonUtils.pojoToJson(
                    new RelationshipType()
                        .withName("broader")
                        .withRdfPredicate(URI.create(BROADER)))));
    return new RdfRepository(
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
        storage,
        new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE),
        () -> new RelationshipTypeResolver(types),
        (type, id) -> {
          if (currentEntity == null) {
            throw new EntityNotFoundException("Entity was hard deleted");
          }
          return currentEntity;
        });
  }

  private void requireAvailable() {
    if (unavailable.get()) {
      throw new IllegalStateException("storage unavailable");
    }
  }

  private static Stream<Arguments> commands() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    final EntityRelationship relationship =
        new EntityRelationship()
            .withFromId(from)
            .withToId(to)
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    return Stream.of(
        Arguments.of(new RdfLiveWrite.EntityUpdate(Entity.TABLE, from)),
        Arguments.of(new RdfLiveWrite.EntityDelete(Entity.TABLE, from)),
        Arguments.of(RdfLiveWrite.RelationshipChange.capture(relationship, false)),
        Arguments.of(RdfLiveWrite.RelationshipChange.capture(relationship, true)),
        Arguments.of(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", false)),
        Arguments.of(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", true)));
  }
}

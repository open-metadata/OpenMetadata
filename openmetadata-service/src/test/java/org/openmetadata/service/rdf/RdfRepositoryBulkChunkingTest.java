/*
 *  Copyright 2026 Collate
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

@DisplayName("RdfRepository bulk chunking")
class RdfRepositoryBulkChunkingTest {

  private static final String BASE_URI = "https://open-metadata.org/";

  @Test
  @DisplayName("bulk entity requests are split by configured chunk size")
  void bulkEntityRequestsAreChunked() {
    RdfStorageInterface storage = storageMock();
    RdfRepository repository =
        new RdfRepository(config().withBulkEntityBatchSize(2), storage, null);
    List<RdfStorageInterface.EntityWriteRequest> requests =
        List.of(
            entityRequest(), entityRequest(), entityRequest(), entityRequest(), entityRequest());

    repository.bulkStoreEntityRequests(requests);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<RdfStorageInterface.EntityWriteRequest>> captor =
        ArgumentCaptor.forClass(List.class);
    verify(storage, times(3)).bulkStoreEntities(captor.capture());
    assertEquals(2, captor.getAllValues().get(0).size());
    assertEquals(2, captor.getAllValues().get(1).size());
    assertEquals(1, captor.getAllValues().get(2).size());
  }

  @Test
  @DisplayName("zero-edge relationship cleanup still reconciles every source chunk")
  void zeroEdgeRelationshipCleanupIsChunkedBySource() {
    RdfStorageInterface storage = storageMock();
    RdfRepository repository =
        new RdfRepository(config().withBulkRelationshipSourceBatchSize(2), storage, null);
    Set<String> sources =
        new LinkedHashSet<>(
            List.of(
                entityUri("table", UUID.randomUUID()),
                entityUri("table", UUID.randomUUID()),
                entityUri("table", UUID.randomUUID())));

    repository.bulkStoreRelationshipData(List.of(), sources);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<RdfStorageInterface.RelationshipData>> relationshipsCaptor =
        ArgumentCaptor.forClass(List.class);
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Set<String>> sourcesCaptor = ArgumentCaptor.forClass(Set.class);
    verify(storage, times(2))
        .bulkStoreRelationships(relationshipsCaptor.capture(), sourcesCaptor.capture());
    assertEquals(0, relationshipsCaptor.getAllValues().get(0).size());
    assertEquals(0, relationshipsCaptor.getAllValues().get(1).size());
    assertEquals(2, sourcesCaptor.getAllValues().get(0).size());
    assertEquals(1, sourcesCaptor.getAllValues().get(1).size());
  }

  @Test
  @DisplayName("outside-batch incoming relationships are inserted once without reconciliation")
  void outsideBatchIncomingRelationshipsAreInsertedOnce() {
    RdfStorageInterface storage = storageMock();
    RdfRepository repository =
        new RdfRepository(config().withBulkRelationshipSourceBatchSize(2), storage, null);
    UUID sourceA = UUID.randomUUID();
    UUID sourceB = UUID.randomUUID();
    UUID sourceC = UUID.randomUUID();
    UUID outsideSource = UUID.randomUUID();
    Set<String> reconcileSources =
        new LinkedHashSet<>(
            List.of(
                entityUri("table", sourceA),
                entityUri("table", sourceB),
                entityUri("table", sourceC)));
    RdfStorageInterface.RelationshipData ownedA = relationship(sourceA, UUID.randomUUID());
    RdfStorageInterface.RelationshipData ownedC = relationship(sourceC, UUID.randomUUID());
    RdfStorageInterface.RelationshipData outside = relationship(outsideSource, UUID.randomUUID());

    repository.bulkStoreRelationshipData(List.of(ownedA, ownedC, outside), reconcileSources);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<RdfStorageInterface.RelationshipData>> relationshipsCaptor =
        ArgumentCaptor.forClass(List.class);
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Set<String>> sourcesCaptor = ArgumentCaptor.forClass(Set.class);
    verify(storage, times(3))
        .bulkStoreRelationships(relationshipsCaptor.capture(), sourcesCaptor.capture());

    assertEquals(List.of(ownedA), relationshipsCaptor.getAllValues().get(0));
    assertEquals(List.of(ownedC), relationshipsCaptor.getAllValues().get(1));
    assertEquals(List.of(outside), relationshipsCaptor.getAllValues().get(2));
    assertEquals(2, sourcesCaptor.getAllValues().get(0).size());
    assertEquals(1, sourcesCaptor.getAllValues().get(1).size());
    assertEquals(Set.of(), sourcesCaptor.getAllValues().get(2));
  }

  @Test
  @DisplayName("unset chunking config uses defaults")
  void unsetChunkingConfigUsesDefaults() {
    RdfConfiguration config = config();

    assertEquals(
        RdfRepository.DEFAULT_BULK_ENTITY_BATCH_SIZE,
        RdfRepository.resolveBulkEntityBatchSize(config));
    assertEquals(
        RdfRepository.DEFAULT_BULK_RELATIONSHIP_SOURCE_BATCH_SIZE,
        RdfRepository.resolveBulkRelationshipSourceBatchSize(config));
  }

  private static RdfConfiguration config() {
    return new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE_URI));
  }

  private static RdfStorageInterface storageMock() {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doAnswer(
            invocation ->
                entityUri(
                    invocation.getArgument(0, String.class),
                    invocation.getArgument(1, String.class)))
        .when(storage)
        .buildEntityUri(anyString(), anyString());
    return storage;
  }

  private static RdfStorageInterface.EntityWriteRequest entityRequest() {
    return new RdfStorageInterface.EntityWriteRequest(
        "table", UUID.randomUUID(), ModelFactory.createDefaultModel());
  }

  private static RdfStorageInterface.RelationshipData relationship(UUID fromId, UUID toId) {
    return new RdfStorageInterface.RelationshipData(
        "table", fromId, "database", toId, "CONTAINS", BASE_URI + "ontology/contains");
  }

  private static String entityUri(String entityType, UUID entityId) {
    return entityUri(entityType, entityId.toString());
  }

  private static String entityUri(String entityType, String entityId) {
    return BASE_URI + "entity/" + entityType + "/" + entityId;
  }
}

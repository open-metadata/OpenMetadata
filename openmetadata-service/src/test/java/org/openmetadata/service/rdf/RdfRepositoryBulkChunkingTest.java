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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

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
    verify(storage, times(3)).bulkStoreEntities(captor.capture(), eq(RdfWriteMode.RECONCILE));
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
    assertEquals(
        RdfRepository.DEFAULT_BULK_LINEAGE_EDGE_BATCH_SIZE,
        RdfRepository.resolveBulkLineageEdgeBatchSize(config));
    assertEquals(
        RdfStorageInterface.DEFAULT_MAX_UPDATE_PAYLOAD_BYTES,
        RdfStorageInterface.resolveMaxUpdatePayloadBytes(config));
    assertEquals(
        RdfStorageInterface.DEFAULT_MAX_APPEND_PAYLOAD_BYTES,
        RdfStorageInterface.resolveMaxAppendPayloadBytes(config));
    assertEquals(
        RdfStorageInterface.DEFAULT_BULK_APPEND_ENTITY_BATCH_SIZE,
        RdfStorageInterface.resolveBulkAppendEntityBatchSize(config));
    assertTrue(
        RdfStorageInterface.DEFAULT_MAX_APPEND_PAYLOAD_BYTES
            > RdfStorageInterface.DEFAULT_MAX_UPDATE_PAYLOAD_BYTES,
        "appends must be allowed larger bodies than reconciling updates");
  }

  @Test
  @DisplayName("wide entity models split by estimated payload budget before the count cap")
  void wideModelsSplitByPayloadBudget() {
    RdfStorageInterface storage = storageMock();
    // 100 triples × 220 bytes ≈ 22,000 estimated bytes per request; a 50,000-byte
    // budget fits two requests per chunk while the count cap (default 100) never binds.
    RdfRepository repository =
        new RdfRepository(config().withMaxUpdatePayloadBytes(50_000), storage, null);
    List<RdfStorageInterface.EntityWriteRequest> requests =
        List.of(
            entityRequest(100),
            entityRequest(100),
            entityRequest(100),
            entityRequest(100),
            entityRequest(100));

    repository.bulkStoreEntityRequests(requests);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<RdfStorageInterface.EntityWriteRequest>> captor =
        ArgumentCaptor.forClass(List.class);
    verify(storage, times(3)).bulkStoreEntities(captor.capture(), eq(RdfWriteMode.RECONCILE));
    assertEquals(2, captor.getAllValues().get(0).size());
    assertEquals(2, captor.getAllValues().get(1).size());
    assertEquals(1, captor.getAllValues().get(2).size());
  }

  @Test
  @DisplayName("insert-only appends use the larger append budget and count cap")
  void appendModeUsesAppendBudget() {
    RdfStorageInterface storage = storageMock();
    // Same models as wideModelsSplitByPayloadBudget (≈22,000 estimated bytes each)
    // but under append limits that comfortably fit all five in one request.
    RdfRepository repository =
        new RdfRepository(
            config()
                .withMaxUpdatePayloadBytes(50_000)
                .withMaxAppendPayloadBytes(1_000_000)
                .withBulkAppendEntityBatchSize(1_000),
            storage,
            null);
    List<RdfStorageInterface.EntityWriteRequest> requests =
        List.of(
            entityRequest(100),
            entityRequest(100),
            entityRequest(100),
            entityRequest(100),
            entityRequest(100));

    repository.bulkStoreEntityRequests(requests, RdfWriteMode.INSERT_ONLY);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<RdfStorageInterface.EntityWriteRequest>> captor =
        ArgumentCaptor.forClass(List.class);
    verify(storage, times(1)).bulkStoreEntities(captor.capture(), eq(RdfWriteMode.INSERT_ONLY));
    assertEquals(5, captor.getValue().size(), "append mode should not split under its own budget");
  }

  @Test
  @DisplayName("append mode still splits when its own byte budget is exceeded")
  void appendModeStillSplitsOverItsBudget() {
    RdfStorageInterface storage = storageMock();
    RdfRepository repository =
        new RdfRepository(
            config().withMaxAppendPayloadBytes(50_000).withBulkAppendEntityBatchSize(1_000),
            storage,
            null);
    List<RdfStorageInterface.EntityWriteRequest> requests =
        List.of(entityRequest(100), entityRequest(100), entityRequest(100));

    repository.bulkStoreEntityRequests(requests, RdfWriteMode.INSERT_ONLY);

    verify(storage, times(2)).bulkStoreEntities(anyList(), eq(RdfWriteMode.INSERT_ONLY));
  }

  @Test
  @DisplayName("append count cap bounds a chunk of very small entities")
  void appendCountCapBoundsTinyEntities() {
    RdfStorageInterface storage = storageMock();
    RdfRepository repository =
        new RdfRepository(
            config().withMaxAppendPayloadBytes(10_000_000).withBulkAppendEntityBatchSize(2),
            storage,
            null);
    List<RdfStorageInterface.EntityWriteRequest> requests =
        List.of(entityRequest(1), entityRequest(1), entityRequest(1), entityRequest(1));

    repository.bulkStoreEntityRequests(requests, RdfWriteMode.INSERT_ONLY);

    verify(storage, times(2)).bulkStoreEntities(anyList(), eq(RdfWriteMode.INSERT_ONLY));
  }

  @Test
  @DisplayName("a single request above the payload budget is still sent, alone")
  void singleOversizedRequestIsSentAlone() {
    RdfStorageInterface storage = storageMock();
    RdfRepository repository =
        new RdfRepository(config().withMaxUpdatePayloadBytes(50_000), storage, null);
    List<RdfStorageInterface.EntityWriteRequest> requests =
        List.of(entityRequest(300), entityRequest(10));

    repository.bulkStoreEntityRequests(requests);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<RdfStorageInterface.EntityWriteRequest>> captor =
        ArgumentCaptor.forClass(List.class);
    verify(storage, times(2)).bulkStoreEntities(captor.capture(), eq(RdfWriteMode.RECONCILE));
    assertEquals(1, captor.getAllValues().get(0).size());
    assertEquals(1, captor.getAllValues().get(1).size());
  }

  @Test
  @DisplayName("lineage edges are split by configured chunk size")
  void bulkLineageEdgesAreChunked() {
    RdfStorageInterface storage = storageMock();
    RdfRepository repository =
        new RdfRepository(config().withBulkLineageEdgeBatchSize(2), storage, null);
    List<RdfRepository.LineageEdgeData> edges =
        List.of(lineageEdge(), lineageEdge(), lineageEdge(), lineageEdge(), lineageEdge());

    repository.bulkAddLineage(edges, RdfWriteMode.INSERT_ONLY);

    ArgumentCaptor<String> updateCaptor = ArgumentCaptor.forClass(String.class);
    verify(storage, times(3)).executeSparqlUpdate(updateCaptor.capture());
    for (String update : updateCaptor.getAllValues()) {
      assertTrue(update.contains("INSERT DATA"));
      assertFalse(update.contains("DELETE"));
    }
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

  private static RdfStorageInterface.EntityWriteRequest entityRequest(int tripleCount) {
    UUID entityId = UUID.randomUUID();
    Model model = ModelFactory.createDefaultModel();
    Resource subject = model.createResource(entityUri("table", entityId));
    for (int i = 0; i < tripleCount; i++) {
      subject.addProperty(model.createProperty(BASE_URI + "ontology/property" + i), "value" + i);
    }
    return new RdfStorageInterface.EntityWriteRequest("table", entityId, model);
  }

  private static RdfStorageInterface.RelationshipData relationship(UUID fromId, UUID toId) {
    return new RdfStorageInterface.RelationshipData(
        "table", fromId, "database", toId, "CONTAINS", BASE_URI + "ontology/contains");
  }

  private static RdfRepository.LineageEdgeData lineageEdge() {
    return new RdfRepository.LineageEdgeData(
        "table", UUID.randomUUID(), "table", UUID.randomUUID(), null);
  }

  private static String entityUri(String entityType, UUID entityId) {
    return entityUri(entityType, entityId.toString());
  }

  private static String entityUri(String entityType, String entityId) {
    return BASE_URI + "entity/" + entityType + "/" + entityId;
  }

  @Test
  @DisplayName("one entity that cannot be translated does not take its batch down")
  void untranslatableEntityIsIsolatedFromItsBatch() {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    JsonLdTranslator translator = mock(JsonLdTranslator.class);
    RdfRepository repository = new RdfRepository(config(), storage, translator);

    EntityInterface good = entityWithId(UUID.randomUUID());
    EntityInterface bad = entityWithId(UUID.randomUUID());
    when(translator.toRdf(good)).thenReturn(ModelFactory.createDefaultModel());
    when(translator.toRdf(bad)).thenThrow(new IllegalStateException("tagLabel missing tagFQN"));

    List<RdfStorageInterface.EntityWriteRequest> requests =
        repository.translateEntities(List.of(good, bad));

    // The batch still carries the healthy entity; the bad one is dropped for the caller
    // to record as a single failure rather than failing all of its neighbours.
    assertEquals(1, requests.size());
    assertEquals(good.getId(), requests.getFirst().entityId());
  }

  private static EntityInterface entityWithId(UUID id) {
    EntityInterface entity = mock(EntityInterface.class);
    lenient().when(entity.getId()).thenReturn(id);
    lenient()
        .when(entity.getEntityReference())
        .thenReturn(new org.openmetadata.schema.type.EntityReference().withType("table"));
    return entity;
  }
}

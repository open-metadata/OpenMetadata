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
package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * Tests the embedding-reuse logic shared by both bulk sinks. Mocks the {@link VectorIndexService}
 * abstraction, so a single suite covers the Elasticsearch and OpenSearch paths.
 */
class VectorEmbeddingBulkHelperTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void enrichReusesCachedEmbeddingWithoutRegenerating() throws Exception {
    UUID entityId = UUID.randomUUID();
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(entityId);

    VectorIndexService vectorService = mock(VectorIndexService.class);
    JsonNode cached =
        MAPPER.readTree(
            "{\"fingerprint\":\"fp\",\"embedding\":[0.1,0.2,0.3],\"textToEmbed\":\"cached\"}");

    VectorEmbeddingBulkHelper.EnrichmentResult result =
        VectorEmbeddingBulkHelper.enrichWithEmbedding(
            vectorService,
            entity,
            "{\"name\":\"my-table\"}",
            Map.of(entityId.toString(), cached),
            MAPPER);

    assertEquals(VectorEmbeddingBulkHelper.EmbeddingOutcome.ENRICHED, result.outcome());
    verify(vectorService, never()).generateEmbeddingFields(any());
    JsonNode doc = MAPPER.readTree(result.json());
    assertEquals("my-table", doc.get("name").asText());
    assertEquals("fp", doc.get("fingerprint").asText());
    assertTrue(doc.get("embedding").isArray());
    assertEquals("cached", doc.get("textToEmbed").asText());
  }

  @Test
  void enrichRegeneratesWhenNoCachedEntry() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());

    VectorIndexService vectorService = mock(VectorIndexService.class);
    when(vectorService.generateEmbeddingFields(entity))
        .thenReturn(Map.of("fingerprint", "fp-new", "embedding", List.of(0.9, 0.8)));

    VectorEmbeddingBulkHelper.EnrichmentResult result =
        VectorEmbeddingBulkHelper.enrichWithEmbedding(
            vectorService, entity, "{\"name\":\"t\"}", Map.of(), MAPPER);

    assertEquals(VectorEmbeddingBulkHelper.EmbeddingOutcome.ENRICHED, result.outcome());
    verify(vectorService).generateEmbeddingFields(entity);
    assertEquals("fp-new", MAPPER.readTree(result.json()).get("fingerprint").asText());
  }

  @Test
  void enrichRegeneratesWhenCachedDimensionMismatchesClient() throws Exception {
    UUID entityId = UUID.randomUUID();
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(entityId);

    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.getDimension()).thenReturn(384);
    VectorIndexService vectorService = mock(VectorIndexService.class);
    when(vectorService.getEmbeddingClient()).thenReturn(embeddingClient);
    when(vectorService.generateEmbeddingFields(entity))
        .thenReturn(Map.of("fingerprint", "fp-new", "embedding", List.of(0.1, 0.2, 0.3)));

    JsonNode cached = MAPPER.readTree("{\"fingerprint\":\"fp\",\"embedding\":[0.1,0.2,0.3]}");

    VectorEmbeddingBulkHelper.EnrichmentResult result =
        VectorEmbeddingBulkHelper.enrichWithEmbedding(
            vectorService, entity, "{\"name\":\"z\"}", Map.of(entityId.toString(), cached), MAPPER);

    assertEquals(VectorEmbeddingBulkHelper.EmbeddingOutcome.ENRICHED, result.outcome());
    verify(vectorService).generateEmbeddingFields(entity);
  }

  @Test
  void enrichSkipsWhenServiceIsNull() {
    EntityInterface entity = mock(EntityInterface.class);
    VectorEmbeddingBulkHelper.EnrichmentResult result =
        VectorEmbeddingBulkHelper.enrichWithEmbedding(null, entity, "{\"a\":1}", Map.of(), MAPPER);
    assertEquals(VectorEmbeddingBulkHelper.EmbeddingOutcome.SKIPPED, result.outcome());
    assertEquals("{\"a\":1}", result.json());
  }

  @Test
  void enrichSkipsWhenDocIsNotAnObject() {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());
    VectorIndexService vectorService = mock(VectorIndexService.class);

    VectorEmbeddingBulkHelper.EnrichmentResult result =
        VectorEmbeddingBulkHelper.enrichWithEmbedding(
            vectorService, entity, "[1,2,3]", Map.of(), MAPPER);

    assertEquals(VectorEmbeddingBulkHelper.EmbeddingOutcome.SKIPPED, result.outcome());
    verify(vectorService, never()).generateEmbeddingFields(any());
  }

  @Test
  void fetchExistingEmbeddingsRoutesToOriginalIndexDuringRecreate() {
    VectorIndexService vectorService = mock(VectorIndexService.class);
    when(vectorService.getExistingEmbeddingsBatch(any(), any())).thenReturn(Map.of());

    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getEntityReference()).thenReturn(new EntityReference().withType("table"));
    List<EntityInterface> entities = List.of(entity);
    Map<String, VectorIndexService.EntityFingerprintInput> currentById = Map.of();

    ReindexContext reindexContext = mock(ReindexContext.class);
    when(reindexContext.getOriginalIndex("table")).thenReturn(Optional.of("table_index_live"));

    VectorEmbeddingBulkHelper.fetchExistingEmbeddings(
        vectorService, entities, currentById, "table_index", reindexContext);
    verify(vectorService).getExistingEmbeddingsBatch(eq("table_index_live"), any());

    VectorEmbeddingBulkHelper.fetchExistingEmbeddings(
        vectorService, entities, currentById, "table_index", null);
    verify(vectorService).getExistingEmbeddingsBatch(eq("table_index"), any());
  }

  @Test
  void fetchExistingEmbeddingsReturnsEmptyForNoServiceOrNoEntities() {
    VectorIndexService vectorService = mock(VectorIndexService.class);
    assertTrue(
        VectorEmbeddingBulkHelper.fetchExistingEmbeddings(null, List.of(), Map.of(), "idx", null)
            .isEmpty());
    assertTrue(
        VectorEmbeddingBulkHelper.fetchExistingEmbeddings(
                vectorService, List.of(), Map.of(), "idx", null)
            .isEmpty());
    verify(vectorService, never()).getExistingEmbeddingsBatch(any(), any());
  }

  @Test
  void buildCurrentByIdKeysEntitiesById() {
    UUID id = UUID.randomUUID();
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(id);
    when(entity.getUpdatedAt()).thenReturn(123L);

    Map<String, VectorIndexService.EntityFingerprintInput> currentById =
        VectorEmbeddingBulkHelper.buildCurrentById(List.of(entity));

    assertEquals(1, currentById.size());
    assertEquals(123L, currentById.get(id.toString()).updatedAt());
  }
}

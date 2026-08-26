package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.indices.ExistsAliasRequest;
import os.org.opensearch.client.opensearch.indices.OpenSearchIndicesClient;
import os.org.opensearch.client.util.ObjectBuilder;

class OpenSearchVectorServiceChunkStagingTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String BASE = "data_asset_embeddings_chunks";

  @Test
  void chunkGenerationNumber_parsesGenerationStamps() {
    assertEquals(1L, OpenSearchVectorService.chunkGenerationNumber(BASE + "_g1", BASE));
    assertEquals(
        1784030121722L,
        OpenSearchVectorService.chunkGenerationNumber(BASE + "_g1784030121722", BASE));
  }

  @Test
  void chunkGenerationNumber_zeroForLegacyAndForeignNames() {
    assertEquals(0L, OpenSearchVectorService.chunkGenerationNumber(BASE, BASE));
    assertEquals(0L, OpenSearchVectorService.chunkGenerationNumber(null, BASE));
    assertEquals(0L, OpenSearchVectorService.chunkGenerationNumber(BASE + "_gX", BASE));
    assertEquals(0L, OpenSearchVectorService.chunkGenerationNumber("other_index", BASE));
  }

  @Test
  void nextChunkGenerationName_isRunUniqueAndParseable() {
    // Run-unique names: a superseded run's pending promote must miss (loudly) instead of aliasing
    // another run's half-built index.
    String name = OpenSearchVectorService.nextChunkGenerationName(BASE);
    assertTrue(name.startsWith(BASE + "_g"));
    assertTrue(OpenSearchVectorService.chunkGenerationNumber(name, BASE) > 0);
  }

  @Test
  void buildChunkPromoteActions_swapsAliasesAndRemovesOldTargetAtomically() throws Exception {
    String body =
        OpenSearchVectorService.buildChunkPromoteActions(
            BASE + "_g2", BASE, "dataAssetEmbeddings", BASE + "_g1");
    JsonNode actions = MAPPER.readTree(body).path("actions");
    assertEquals(3, actions.size());
    assertEquals(BASE + "_g2", actions.get(0).path("add").path("index").asText());
    assertEquals(BASE, actions.get(0).path("add").path("alias").asText());
    assertEquals("dataAssetEmbeddings", actions.get(1).path("add").path("alias").asText());
    assertEquals(BASE + "_g1", actions.get(2).path("remove_index").path("index").asText());
  }

  @Test
  void buildChunkPromoteActions_firstPromotionRemovesTheLegacyPhysicalIndex() throws Exception {
    // Migration path: the previous target IS the read-alias name (the legacy physical index).
    // remove_index + add in one atomic call is what makes the name hand-over gapless.
    String body =
        OpenSearchVectorService.buildChunkPromoteActions(
            BASE + "_g1", BASE, "dataAssetEmbeddings", BASE);
    JsonNode actions = MAPPER.readTree(body).path("actions");
    assertEquals(3, actions.size());
    assertEquals(BASE, actions.get(2).path("remove_index").path("index").asText());
  }

  @Test
  void buildChunkPromoteActions_freshInstallEmitsNoRemoval() throws Exception {
    String body =
        OpenSearchVectorService.buildChunkPromoteActions(
            BASE + "_g1", BASE, "dataAssetEmbeddings", null);
    JsonNode actions = MAPPER.readTree(body).path("actions");
    assertEquals(2, actions.size());
    for (JsonNode action : actions) {
      assertTrue(action.has("add"));
      assertFalse(action.has("remove_index"));
    }
  }

  @Test
  void beginStagedChunkRecreate_abortsWhenTheLiveTargetProbeIsIndeterminate() throws IOException {
    // A probe failure (timeout, cluster error) must abort the recreate: a null live target would
    // make the orphan sweep treat the live aliased generation as an orphan and delete it.
    OpenSearchClient client = mock(OpenSearchClient.class);
    OpenSearchIndicesClient indices = mock(OpenSearchIndicesClient.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.embedQuery(any(String.class))).thenReturn(new float[] {0.1f});
    when(client.indices()).thenReturn(indices);
    when(indices.existsAlias(
            ArgumentMatchers
                .<Function<ExistsAliasRequest.Builder, ObjectBuilder<ExistsAliasRequest>>>any()))
        .thenThrow(new IOException("cluster unreachable"));

    OpenSearchVectorService service = new OpenSearchVectorService(client, embeddingClient);

    RuntimeException failure =
        assertThrows(RuntimeException.class, service::beginStagedChunkRecreate);
    assertTrue(
        failure.getMessage().contains("live chunk target"),
        "abort must name the unresolved live target. Got: " + failure.getMessage());
    verify(client, never()).generic();
  }

  @Test
  void beginStagedChunkRecreate_skipsStagingWhenTheEmbeddingProviderIsUnavailable()
      throws IOException {
    // An unreachable embedding provider must not fail the reindex. Semantic search ships enabled
    // with the provider defaulting to bedrock, and the client constructs without ever calling it,
    // so any deployment that never set Bedrock up reaches this pre-flight — and the entity reindex
    // it would abort does not need embeddings at all. Skip staging, leave the old chunks live, and
    // touch nothing in the cluster.
    OpenSearchClient client = mock(OpenSearchClient.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.embedQuery(any(String.class)))
        .thenThrow(new RuntimeException("Bedrock embedding generation failed (AWS service error)"));

    OpenSearchVectorService service = new OpenSearchVectorService(client, embeddingClient);

    assertNull(
        service.beginStagedChunkRecreate(),
        "an unavailable embedding provider must read as 'not staged', not as a failure");
    verify(client, never()).indices();
    verify(client, never()).generic();
  }
}

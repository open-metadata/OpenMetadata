package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class OpenSearchVectorServiceChunkStagingTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String BASE = "data_asset_embeddings_chunks";

  @Test
  void chunkGenerationNumber_parsesGenerationNames() {
    assertEquals(1, OpenSearchVectorService.chunkGenerationNumber(BASE + "_g1", BASE));
    assertEquals(12, OpenSearchVectorService.chunkGenerationNumber(BASE + "_g12", BASE));
  }

  @Test
  void chunkGenerationNumber_zeroForLegacyAndForeignNames() {
    assertEquals(0, OpenSearchVectorService.chunkGenerationNumber(BASE, BASE));
    assertEquals(0, OpenSearchVectorService.chunkGenerationNumber(null, BASE));
    assertEquals(0, OpenSearchVectorService.chunkGenerationNumber(BASE + "_gX", BASE));
    assertEquals(0, OpenSearchVectorService.chunkGenerationNumber("other_index", BASE));
  }

  @Test
  void nextChunkGenerationName_startsAtG1OnLegacyOrFreshLayout() {
    assertEquals(BASE + "_g1", OpenSearchVectorService.nextChunkGenerationName(BASE, BASE));
    assertEquals(BASE + "_g1", OpenSearchVectorService.nextChunkGenerationName(BASE, null));
  }

  @Test
  void nextChunkGenerationName_incrementsPastTheLiveGeneration() {
    assertEquals(BASE + "_g3", OpenSearchVectorService.nextChunkGenerationName(BASE, BASE + "_g2"));
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
}

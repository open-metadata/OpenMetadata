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
    // Run-unique names: a blocked run's poison marker must never match a later run's generation,
    // and a superseded run's pending promote must miss (loudly) instead of aliasing another run's
    // half-built index.
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
}

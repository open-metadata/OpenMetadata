package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.ErrorResponse;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Request;
import os.org.opensearch.client.opensearch.generic.Response;
import os.org.opensearch.client.opensearch.indices.GetAliasRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasResponse;
import os.org.opensearch.client.opensearch.indices.OpenSearchIndicesClient;
import os.org.opensearch.client.opensearch.indices.get_alias.IndexAliases;
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
  void beginStagedChunkRecreate_skipsStagingWhenTheLiveTargetProbeIsIndeterminate()
      throws IOException {
    // An unanswerable probe must not fail the reindex. It used to throw, which killed the whole
    // run before its first record. Skipping the stage touches nothing: the orphan sweep below the
    // probe never runs, so the live generation it might have mistaken for an orphan is safe.
    OpenSearchClient client = mock(OpenSearchClient.class);
    OpenSearchIndicesClient indices = mock(OpenSearchIndicesClient.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.embedQuery(any(String.class))).thenReturn(new float[] {0.1f});
    when(client.indices()).thenReturn(indices);
    when(indices.getAlias(
            ArgumentMatchers
                .<Function<GetAliasRequest.Builder, ObjectBuilder<GetAliasRequest>>>any()))
        .thenThrow(new IOException("cluster unreachable"));

    OpenSearchVectorService service = new OpenSearchVectorService(client, embeddingClient);

    assertNull(
        service.beginStagedChunkRecreate(),
        "an indeterminate live-target probe must read as 'not staged', not as a failure");
    // No sweep, no generation create — nothing in the cluster is touched.
    verify(client, never()).generic();
  }

  @Test
  void resolveLiveChunkTarget_asksForTheChunkIndexByName_notForAClusterWideAliasLookup()
      throws IOException {
    // The probe must name the index in the path (GET /{base}/_alias). The alias-scoped forms
    // (HEAD|GET /_alias/{base}) name no index, so the cluster resolves them against _all and a
    // search role confined to this deployment's <clusterAlias>* prefix is denied with a 403 —
    // which opensearch-java raises before any boolean-endpoint mapping, so it can never read as
    // "no alias". That 403 took down search indexing on every shared-tenancy cluster.
    OpenSearchClient client = mock(OpenSearchClient.class);
    OpenSearchIndicesClient indices = mock(OpenSearchIndicesClient.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.embedQuery(any(String.class))).thenReturn(new float[] {0.1f});
    when(client.indices()).thenReturn(indices);

    GetAliasResponse response = mock(GetAliasResponse.class);
    when(response.result()).thenReturn(Map.of(BASE + "_g7", mock(IndexAliases.class)));
    ArgumentCaptor<Function<GetAliasRequest.Builder, ObjectBuilder<GetAliasRequest>>> captor =
        ArgumentCaptor.captor();
    when(indices.getAlias(captor.capture())).thenReturn(response);
    OpenSearchGenericClient generic = okGenericClient();
    when(client.generic()).thenReturn(generic);

    OpenSearchVectorService service = new OpenSearchVectorService(client, embeddingClient);
    service.beginStagedChunkRecreate();

    GetAliasRequest request = captor.getValue().apply(new GetAliasRequest.Builder()).build();
    assertEquals(
        List.of(BASE),
        request.index(),
        "the chunk index must be named in the request path, not left to resolve against _all");
    assertTrue(
        request.name().isEmpty(),
        "naming the alias instead of the index is the cluster-wide form that 403s");
  }

  @Test
  void resolveLiveChunkTarget_treatsA404AsFreshInstallRatherThanAnIndeterminateProbe()
      throws IOException {
    // Neither alias nor physical index exists yet. That is a determinate "nothing is live", so the
    // stage proceeds and creates the first generation — it must not be confused with a probe that
    // could not be answered.
    OpenSearchClient client = mock(OpenSearchClient.class);
    OpenSearchIndicesClient indices = mock(OpenSearchIndicesClient.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.embedQuery(any(String.class))).thenReturn(new float[] {0.1f});
    when(client.indices()).thenReturn(indices);
    when(indices.getAlias(
            ArgumentMatchers
                .<Function<GetAliasRequest.Builder, ObjectBuilder<GetAliasRequest>>>any()))
        .thenThrow(notFound());

    OpenSearchGenericClient generic = okGenericClient();
    when(client.generic()).thenReturn(generic);
    OpenSearchVectorService service = new OpenSearchVectorService(client, embeddingClient);

    String generation = service.beginStagedChunkRecreate();

    assertTrue(
        generation != null && generation.startsWith(BASE + "_g"),
        "a 404 probe means fresh install: stage the first generation. Got: " + generation);
  }

  /** Generic client that answers every request 200/no-body, so staging can run to completion. */
  private static OpenSearchGenericClient okGenericClient() throws IOException {
    OpenSearchGenericClient generic = mock(OpenSearchGenericClient.class);
    Response response = mock(Response.class);
    when(response.getStatus()).thenReturn(200);
    when(response.getBody()).thenReturn(Optional.empty());
    when(generic.execute(any(Request.class))).thenReturn(response);
    return generic;
  }

  private static OpenSearchException notFound() {
    return new OpenSearchException(
        ErrorResponse.of(
            e ->
                e.status(404)
                    .error(c -> c.type("index_not_found_exception").reason("no such index"))));
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

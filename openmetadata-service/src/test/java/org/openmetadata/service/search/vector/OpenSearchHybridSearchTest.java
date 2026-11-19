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
package org.openmetadata.service.search.vector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Request;
import os.org.opensearch.client.opensearch.generic.Response;

/** The hybrid search: what its two legs ask the cluster, and how their hits come back. */
class OpenSearchHybridSearchTest {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String LEXICAL = "{\"match\":{\"name\":\"customer lifetime value\"}}";
  private static final HybridRanking RANKING = new HybridRanking(0.6, 0.4, 30);

  private OpenSearchGenericClient genericClient;
  private OpenSearchVectorService service;
  private final List<Request> requests = new ArrayList<>();

  @BeforeEach
  void setUp() {
    final OpenSearchClient client = mock(OpenSearchClient.class);
    genericClient = mock(OpenSearchGenericClient.class);
    when(client.generic()).thenReturn(genericClient);
    final EmbeddingClient embeddings = mock(EmbeddingClient.class);
    when(embeddings.embedQuery(any())).thenReturn(new float[] {0.25f, 0.5f});
    service = new OpenSearchVectorService(client, embeddings);
  }

  private void clusterAnswers(final int status, final String body) throws IOException {
    final Response response = mock(Response.class);
    final Body content = mock(Body.class);
    when(response.getStatus()).thenReturn(status);
    when(response.getBody()).thenReturn(Optional.of(content));
    when(content.bodyAsString()).thenReturn(body);
    when(content.bodyAsBytes()).thenReturn(body.getBytes(StandardCharsets.UTF_8));
    when(genericClient.execute(any()))
        .thenAnswer(
            invocation -> {
              requests.add(invocation.getArgument(0, Request.class));
              return response;
            });
  }

  private static final String DOMAIN_FILTER =
      "{\"bool\":{\"should\":[{\"term\":{\"domains.id\":\"d-7\"}}]}}";

  private static HybridSearchRequest request() {
    return request(null);
  }

  private static HybridSearchRequest request(final String accessFilter) {
    return request(List.of("table", "tableColumn", "glossaryTerm"), accessFilter);
  }

  private static HybridSearchRequest request(
      final List<String> entityTypes, final String accessFilter) {
    return request(entityTypes, List.of(), accessFilter);
  }

  private static HybridSearchRequest request(
      final List<String> entityTypes, final List<String> byMeaningOnly, final String accessFilter) {
    return new HybridSearchRequest(
        "customer lifetime value",
        LEXICAL,
        "all",
        "dataAssetEmbeddings",
        entityTypes,
        byMeaningOnly,
        accessFilter,
        5,
        null);
  }

  private JsonNode sentBody(final int index) throws IOException {
    return JSON.readTree(requests.get(index).getBody().orElseThrow().bodyAsString());
  }

  @Test
  void theKnnLegOfAHybridQuerySkipsShardsWithoutEmbeddingsInsteadOfFailingThem() {
    final String knn =
        VectorSearchQueryBuilder.buildHybridQuery(
            new float[] {0.1f},
            new VectorSearchParameters(null, Map.of(), 0, 0, 10, 0.0, null, null, null));
    final String plain = VectorSearchQueryBuilder.buildQuery(new float[] {0.1f}, 10, Map.of(), 0.0);

    assertThat(knn).contains("\"ignore_unmapped\":true");
    assertThat(plain).doesNotContain("ignore_unmapped");
  }

  /**
   * OpenSearch ranks each leg of a {@code hybrid} query within each shard before RRF fuses them, so
   * over an alias of many single-shard indexes every index's best hit took first place and they
   * tied. Each leg is asked on its own instead, ranked over its whole scope, and fused here.
   */
  @Test
  void theWordsAndTheMeaningAreAskedSeparatelyOverTheScopeAndNoClusterPipelineRanksThem()
      throws IOException {
    clusterAnswers(200, "{\"hits\":{\"hits\":[]}}");

    service.hybridSearch(request(), RANKING);

    assertThat(requests)
        .extracting(Request::getEndpoint)
        .containsExactly("/all/_search", "/dataAssetEmbeddings/_search");
    final JsonNode words = sentBody(0);
    final JsonNode meaning = sentBody(1);
    assertThat(words.path("query").path("bool").path("must").toString())
        .contains("customer lifetime value");
    assertThat(words.path("query").path("bool").path("filter").toString())
        .contains("{\"term\":{\"deleted\":false}}")
        .contains("{\"terms\":{\"entityType\":[\"table\",\"tableColumn\",\"glossaryTerm\"]}}");
    final JsonNode knn = meaning.path("query").path("knn").path("embedding");
    assertThat(knn.path("ignore_unmapped").asBoolean()).isTrue();
    assertThat(knn.path("filter").toString())
        .contains("\"entityType\":[\"table\",\"glossaryTerm\"]")
        .doesNotContain("tableColumn");
    for (final JsonNode body : List.of(words, meaning)) {
      assertThat(body.has("search_pipeline")).isFalse();
      assertThat(body.path("query").has("hybrid")).isFalse();
      assertThat(body.path("size").asInt()).isGreaterThanOrEqualTo(5);
    }
  }

  @Test
  void typesSearchedByMeaningAloneAreLeftOutOfTheWordLeg() throws IOException {
    clusterAnswers(200, "{\"hits\":{\"hits\":[]}}");

    service.hybridSearch(request(List.of("table"), List.of("testCase"), null), RANKING);

    assertThat(sentBody(0).path("query").path("bool").path("filter").toString())
        .contains("\"entityType\":[\"table\"]")
        .doesNotContain("testCase");
    assertThat(sentBody(1).path("query").path("knn").path("embedding").path("filter").toString())
        .contains("\"entityType\":[\"table\",\"testCase\"]");
  }

  @Test
  void aScopeWithNoTypeThatCarriesEmbeddingsIsAskedOnlyByWords() throws IOException {
    clusterAnswers(200, "{\"hits\":{\"hits\":[]}}");

    service.hybridSearch(request(List.of("tableColumn", "tag"), null), RANKING);

    assertThat(requests).extracting(Request::getEndpoint).containsExactly("/all/_search");
  }

  @Test
  void theWordQueryMatchesTheWholeQuestionOrAnyOfItsWords() throws IOException {
    final JsonNode anyOf =
        JSON.readTree(
            HybridSearchQuery.anyOf(List.of(LEXICAL, "{\"match\":{\"name\":\"spend\"}}")));

    assertThat(anyOf.path("bool").path("should")).hasSize(2);
    assertThat(anyOf.path("bool").path("minimum_should_match").asInt()).isEqualTo(1);
  }

  @Test
  void bothLegsCarryTheCallersSearchAccessFilterAndNoFilterWhenTheCallerHasNone()
      throws IOException {
    clusterAnswers(200, "{\"hits\":{\"hits\":[]}}");

    service.hybridSearch(request(DOMAIN_FILTER), RANKING);
    service.hybridSearch(request(null), RANKING);

    assertThat(sentBody(0).path("query").path("bool").path("filter").toString()).contains("d-7");
    assertThat(sentBody(1).path("query").path("knn").path("embedding").path("filter").toString())
        .contains("d-7");
    assertThat(sentBody(2).toString()).doesNotContain("d-7");
    assertThat(sentBody(3).toString()).doesNotContain("d-7");
  }

  @Test
  void hitsComeBackOncePerEntityInRankOrderWithChunksFoldedIntoTheirEntity() throws IOException {
    clusterAnswers(
        200,
        """
        {"hits":{"hits":[
          {"_score":0.9,"_source":{"parentId":"t1","entityType":"table","fullyQualifiedName":"s.customers"}},
          {"_score":0.8,"_source":{"id":"c1","entityType":"tableColumn","fullyQualifiedName":"s.orders.lifetime_spend"}},
          {"_score":0.7,"_source":{"parentId":"t1","entityType":"table","fullyQualifiedName":"s.customers"}},
          {"_score":0.6,"_source":{"id":"g1","entityType":"glossaryTerm","fullyQualifiedName":"g.Lifetime Spend"}}
        ]}}
        """);

    final List<Map<String, Object>> hits = service.hybridSearch(request(), RANKING);

    assertThat(hits)
        .extracting(hit -> hit.get("parentId"), hit -> hit.get("entityType"))
        .containsExactly(
            tuple("t1", "table"), tuple("c1", "tableColumn"), tuple("g1", "glossaryTerm"));
  }

  @Test
  void aClusterThatCannotRunTheQueryIsAHybridSearchFailure() throws IOException {
    clusterAnswers(400, "{\"error\":{\"type\":\"illegal_argument_exception\"}}");

    assertThatThrownBy(() -> service.hybridSearch(request(), RANKING))
        .isInstanceOf(HybridSearchException.class);
  }
}

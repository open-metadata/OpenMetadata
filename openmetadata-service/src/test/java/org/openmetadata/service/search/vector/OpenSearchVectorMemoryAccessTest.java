package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Request;
import os.org.opensearch.client.opensearch.generic.Response;

class OpenSearchVectorMemoryAccessTest {
  @Test
  void readableAnchorsAreResolvedOnceAndReachEveryOverfetchPage() throws Exception {
    String anchorId = UUID.randomUUID().toString();
    AtomicInteger resolutions = new AtomicInteger();
    List<String> requests = new ArrayList<>();
    OpenSearchClient client = respondingClient(requests);
    EmbeddingClient embeddings = mock(EmbeddingClient.class);
    when(embeddings.embedQuery(any(String.class))).thenReturn(new float[] {0.1f});
    OpenSearchVectorService service =
        new OpenSearchVectorService(
            client,
            embeddings,
            parameters -> {
              resolutions.incrementAndGet();
              return Set.of(anchorId);
            });
    SubjectContext subject =
        new SubjectContext(new User().withId(UUID.randomUUID()).withName("reader"), null);
    VectorSearchParameters parameters =
        new VectorSearchParameters(
            "orders",
            Map.of("primaryEntityId", List.of(anchorId)),
            1,
            0,
            10,
            0,
            null,
            subject,
            null);

    VectorSearchResponse response = service.search(parameters);

    assertEquals(1, resolutions.get());
    assertEquals(2, requests.size());
    assertEquals("first", response.hits.getFirst().get("parentId"));
    assertTrue(response.hasMore);
    for (int i = 0; i < requests.size(); i++) {
      assertPage(requests.get(i), anchorId, i);
    }
  }

  private static void assertPage(String request, String anchorId, int offset) {
    JsonNode body = JsonUtils.readTree(request);
    String visibility =
        body.path("query")
            .path("knn")
            .path("embedding")
            .path("filter")
            .path("bool")
            .path("filter")
            .toString();
    assertTrue(visibility.contains("\"anchorId\":[\"" + anchorId + "\"]"), visibility);
    assertEquals(offset, body.path("from").asInt());
  }

  private static OpenSearchClient respondingClient(List<String> requests) throws Exception {
    OpenSearchClient client = mock(OpenSearchClient.class);
    OpenSearchGenericClient generic = mock(OpenSearchGenericClient.class);
    when(client.generic()).thenReturn(generic);
    when(generic.execute(any(Request.class)))
        .thenAnswer(
            invocation -> {
              Request request = invocation.getArgument(0);
              requests.add(
                  new String(
                      request.getBody().orElseThrow().bodyAsBytes(), StandardCharsets.UTF_8));
              Response response = mock(Response.class);
              when(response.getBody())
                  .thenReturn(
                      Optional.of(
                          Body.from(
                              page(requests.size() == 1 ? "first" : "second")
                                  .getBytes(StandardCharsets.UTF_8),
                              "application/json")));
              return response;
            });
    return client;
  }

  private static String page(String parent) {
    return "{\"hits\":{\"total\":{\"value\":2},\"hits\":[{\"_id\":\""
        + parent
        + "\",\"_score\":0.9,\"_source\":{\"parentId\":\""
        + parent
        + "\",\"chunkIndex\":0}}]}}";
  }
}

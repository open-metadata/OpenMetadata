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
package org.openmetadata.service.apps.bundles.insights.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.hc.core5.http.HttpEntity;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;

/**
 * Rest5Client (pinned 9.2.9) only throws an IOException for status >= 500; every 4xx — including
 * the 400 mapping conflict that drives the rollover recovery in {@code
 * DataInsightsSearchInterface.updateDataAssetsDataStream} — is returned as a normal {@link
 * Response}. These tests pin the Elasticsearch Data Insights client to checking the returned status
 * and surfacing >= 300 as an {@link IOException}, mirroring {@code OpenSearchDataInsightsClient}.
 */
class ElasticSearchDataInsightsClientTest {

  /**
   * The original bug: a 400 mapping conflict was silently swallowed, so the rollover recovery never
   * fired on Elasticsearch. The fix must raise an IOException whose message carries the status so
   * {@code isMappingConflict} (which looks for "400") matches.
   */
  @Test
  void putWriteIndexMappingThrowsOn400MappingConflict() throws IOException {
    ElasticSearchDataInsightsClient insights = newWith(response(400, ""));

    IOException failure =
        assertThrows(
            IOException.class, () -> insights.putWriteIndexMapping("di-data-assets-table", "{}"));

    assertTrue(failure.getMessage().contains("400"), failure.getMessage());
    assertTrue(failure.getMessage().contains("/_mapping"), failure.getMessage());
  }

  @Test
  void putWriteIndexMappingSucceedsOn2xx() throws IOException {
    ElasticSearchDataInsightsClient insights = newWith(response(200, "{}"));

    assertDoesNotThrow(() -> insights.putWriteIndexMapping("di-data-assets-table", "{}"));
  }

  /** The rollover trigger requires {@code write_index_only=true} on the PUT /<stream>/_mapping. */
  @Test
  void putWriteIndexMappingSendsWithIndexOnlyParameterAndBody() throws IOException {
    Rest5Client client = mock(Rest5Client.class);
    Response ok = response(200, "{}");
    when(client.performRequest(any(Request.class))).thenReturn(ok);
    ElasticSearchDataInsightsClient insights = new ElasticSearchDataInsightsClient(client, null);

    insights.putWriteIndexMapping("di-data-assets-table", "{\"properties\":{}}");

    ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
    verify(client).performRequest(captor.capture());
    Request sent = captor.getValue();
    assertEquals("PUT", sent.getMethod());
    assertEquals("/di-data-assets-table/_mapping", sent.getEndpoint());
    assertEquals("true", sent.getParameters().get("write_index_only"));
    assertEquals("{\"properties\":{}}", bodyOf(sent));
  }

  @Test
  void rolloverDataStreamThrowsOn4xxInsteadOfSilentlySucceeding() throws IOException {
    ElasticSearchDataInsightsClient insights = newWith(response(409, ""));

    IOException failure =
        assertThrows(IOException.class, () -> insights.rolloverDataStream("di-data-assets-table"));

    assertTrue(failure.getMessage().contains("409"), failure.getMessage());
    assertTrue(failure.getMessage().contains("_rollover"), failure.getMessage());
  }

  @Test
  void dataAssetDataStreamExistsReturnsTrueOn200() throws IOException {
    ElasticSearchDataInsightsClient insights = newWith(response(200, ""));

    assertTrue(insights.dataAssetDataStreamExists("di-data-assets-table"));
  }

  /** A HEAD 404 ("stream not found") must not throw — it means the stream does not exist. */
  @Test
  void dataAssetDataStreamExistsReturnsFalseOn404() throws IOException {
    ElasticSearchDataInsightsClient insights = newWith(response(404, ""));

    assertFalse(insights.dataAssetDataStreamExists("di-data-assets-table"));
  }

  /** Other >= 300 responses to HEAD (e.g. 401 auth failure) must surface, not read as "absent". */
  @Test
  void dataAssetDataStreamExistsThrowsOn401() throws IOException {
    ElasticSearchDataInsightsClient insights = newWith(response(401, ""));

    assertThrows(
        IOException.class, () -> insights.dataAssetDataStreamExists("di-data-assets-table"));
  }

  /**
   * The end-to-end recovery contract: when the engine rejects the in-place mapping update with a
   * 400, {@code updateDataAssetsDataStream} must roll the stream over and re-apply the mapping to
   * the fresh write index. Before the fix this path was dead code on Elasticsearch because the 400
   * never surfaced as an IOException.
   */
  @Test
  void mappingConflict400TriggersRolloverAndReappliesMapping() throws IOException {
    Rest5Client client = mock(Rest5Client.class);
    AtomicInteger mappingAttempts = new AtomicInteger();
    // Drive the full updateDataAssetsDataStream loop on the real client:
    //  - component template PUT  -> 200
    //  - index template PUT      -> 200
    //  - first /_mapping PUT     -> 400 (the mapping conflict)
    //  - /_rollover POST          -> 200
    //  - second /_mapping PUT     -> 200 (re-applied to the fresh write index)
    when(client.performRequest(any(Request.class)))
        .thenAnswer(
            inv -> {
              Request req = inv.getArgument(0);
              String endpoint = req.getEndpoint();
              if (endpoint.contains("/_component_template/")) {
                return response(200, "{}");
              }
              if (endpoint.contains("/_index_template/")) {
                return response(200, "{}");
              }
              if (endpoint.endsWith("/_mapping")) {
                if (mappingAttempts.getAndIncrement() == 0) {
                  return response(400, "");
                }
                return response(200, "{}");
              }
              return response(200, "{}");
            });
    ElasticSearchDataInsightsClient insights = new ElasticSearchDataInsightsClient(client, null);
    IndexMapping tableMapping = tableIndexMapping();

    assertDoesNotThrow(
        () ->
            insights.updateDataAssetsDataStream(
                "di-data-assets-table", "table", tableMapping, "en"));

    assertEquals(
        2, mappingAttempts.get(), "putWriteIndexMapping must be retried after the rollover");

    ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
    verify(client, atLeastOnce()).performRequest(captor.capture());
    List<Request> sent = captor.getAllValues();
    long rollovers =
        sent.stream()
            .filter(r -> "POST".equals(r.getMethod()) && r.getEndpoint().endsWith("/_rollover"))
            .count();
    assertEquals(
        1, rollovers, "rolloverDataStream must run exactly once on a 400 mapping conflict");
    long mappingPuts =
        sent.stream()
            .filter(r -> "PUT".equals(r.getMethod()) && r.getEndpoint().endsWith("/_mapping"))
            .count();
    assertEquals(2, mappingPuts, "putWriteIndexMapping must be called twice (conflict then retry)");
  }

  /**
   * A non-mapping-conflict failure (e.g. 500) must propagate out of {@code
   * updateDataAssetsDataStream} rather than trigger a rollover.
   */
  @Test
  void nonMappingConflict500PropagatesWithoutRollover() throws IOException {
    Rest5Client client = mock(Rest5Client.class);
    when(client.performRequest(any(Request.class)))
        .thenAnswer(
            inv -> {
              Request req = inv.getArgument(0);
              if (req.getEndpoint().endsWith("/_mapping")) {
                return response(500, "");
              }
              return response(200, "{}");
            });
    ElasticSearchDataInsightsClient insights = new ElasticSearchDataInsightsClient(client, null);
    IndexMapping tableMapping = tableIndexMapping();

    IOException failure =
        assertThrows(
            IOException.class,
            () ->
                insights.updateDataAssetsDataStream(
                    "di-data-assets-table", "table", tableMapping, "en"));
    assertTrue(failure.getMessage().contains("500"), failure.getMessage());

    ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
    verify(client, atLeastOnce()).performRequest(captor.capture());
    long rollovers =
        captor.getAllValues().stream()
            .filter(r -> "POST".equals(r.getMethod()) && r.getEndpoint().endsWith("/_rollover"))
            .count();
    assertEquals(
        0, rollovers, "rolloverDataStream must not run for a non-mapping-conflict failure");
  }

  /** Happy path for every {@code performRequest}-backed method: a 2xx must not throw. */
  @Test
  void allMutatingMethodsSucceedOn2xx() throws IOException {
    ElasticSearchDataInsightsClient insights = newWith(response(200, "{}"));

    assertDoesNotThrow(
        () -> insights.createComponentTemplate("di-data-assets-table-mapping", "{}"));
    assertDoesNotThrow(() -> insights.createIndexTemplate("di-data-assets-table", "{}"));
    assertDoesNotThrow(() -> insights.createDataStream("di-data-assets-table"));
    assertDoesNotThrow(() -> insights.rolloverDataStream("di-data-assets-table"));
    assertDoesNotThrow(() -> insights.deleteDataAssetDataStream("di-data-assets-table"));
  }

  /**
   * {@code createDataAssetsDataStream} must prepare the component + index templates and then create
   * the data stream. With every engine call returning 2xx it must complete without throwing.
   */
  @Test
  void createDataAssetsDataStreamPreparesTemplatesAndCreatesStream() throws IOException {
    ElasticSearchDataInsightsClient insights = newWith(response(200, "{}"));
    IndexMapping tableMapping = tableIndexMapping();

    assertDoesNotThrow(
        () ->
            insights.createDataAssetsDataStream(
                "di-data-assets-table", "table", tableMapping, "en", 7));
  }

  private static ElasticSearchDataInsightsClient newWith(Response response) throws IOException {
    Rest5Client client = mock(Rest5Client.class);
    when(client.performRequest(any(Request.class))).thenReturn(response);
    return new ElasticSearchDataInsightsClient(client, null);
  }

  private static IndexMapping tableIndexMapping() {
    try (InputStream in =
        ElasticSearchDataInsightsClientTest.class
            .getClassLoader()
            .getResourceAsStream("elasticsearch/indexMapping.json")) {
      assert in != null : "elasticsearch/indexMapping.json not on classpath";
      var root = JsonUtils.readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8));
      return JsonUtils.convertValue(root.get("table"), IndexMapping.class);
    } catch (IOException e) {
      throw new AssertionError("Failed to load table index mapping", e);
    }
  }

  private static Response response(int status, String body) throws IOException {
    Response response = mock(Response.class);
    when(response.getStatusCode()).thenReturn(status);
    HttpEntity entity = mock(HttpEntity.class);
    when(response.getEntity()).thenReturn(entity);
    when(entity.getContent())
        .thenAnswer(inv -> new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    return response;
  }

  private static String bodyOf(Request request) throws IOException {
    try (InputStream content = request.getEntity().getContent()) {
      return new String(content.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}

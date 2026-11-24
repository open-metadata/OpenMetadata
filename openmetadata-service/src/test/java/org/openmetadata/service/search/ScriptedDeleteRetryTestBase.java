package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

public abstract class ScriptedDeleteRetryTestBase {
  protected static final String SCRIPT =
      "!doc['testCaseFQN.keyword'].empty && params.fqns.contains(doc['testCaseFQN.keyword'].value)";
  protected static final Map<String, Object> PARAMS = Map.of("fqns", List.of("my_test"));
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  protected final List<Long> conflicts = new ArrayList<>();
  protected boolean keepConflicting;
  protected boolean reportTimeout;
  protected boolean reportShardFailure;
  protected String index;

  protected abstract String engineUrl();

  protected abstract void connect(ElasticSearchConfiguration config) throws Exception;

  protected abstract void closeClient() throws Exception;

  protected abstract void deleteByScript() throws Exception;

  protected abstract void deleteOnce() throws Exception;

  @BeforeEach
  void setUp() throws Exception {
    index = "script-delete-" + UUID.randomUUID();
    URI uri = URI.create(engineUrl());
    connect(
        new ElasticSearchConfiguration()
            .withHost(uri.getHost())
            .withPort(uri.getPort())
            .withScheme("http")
            .withConnectionTimeoutSecs(10)
            .withSocketTimeoutSecs(30)
            .withBatchSize(10)
            .withClusterAlias(""));
    request(
        "PUT",
        index,
        "{\"settings\":{\"number_of_shards\":1,\"number_of_replicas\":0,\"refresh_interval\":\"-1\"}}");
    seed();
  }

  @AfterEach
  void tearDown() throws Exception {
    try {
      if (index != null) request("DELETE", index, "");
    } finally {
      closeClient();
      http.close();
    }
  }

  @Test
  void noConflictsNeedsOnlyOneAttemptAndKeepsOtherTestCases() throws Exception {
    deleteByScript();
    assertEquals(List.of(0L), conflicts);
    assertOnlyOtherTestCaseRemains();
  }

  @Test
  void retriesAnUpdatedDocumentAgainstItsRefreshedVersion() throws Exception {
    rewriteWithoutRefresh();
    deleteByScript();
    assertOnlyOtherTestCaseRemains();
    assertEquals(List.of(1L, 0L), conflicts);
  }

  @Test
  void retriesWhenEveryMatchingDocumentConflicted() throws Exception {
    deleteOnce();
    seed(1);
    rewriteWithoutRefresh();
    deleteByScript();
    assertOnlyOtherTestCaseRemains();
    assertEquals(List.of(1L, 0L), conflicts);
  }

  @Test
  void aConcurrentlyDeletedDocumentDoesNotPreventCleanup() throws Exception {
    request("DELETE", index + "/_doc/held", "");
    deleteByScript();
    assertTrue(conflicts.size() <= 2);
    assertEquals(0L, conflicts.getLast());
    assertOnlyOtherTestCaseRemains();
  }

  @Test
  void persistentWritersStopAfterThreeAttempts() throws Exception {
    keepConflicting = true;
    deleteByScript();
    assertEquals(List.of(1L, 1L, 1L), conflicts);
    request("POST", index + "/_refresh", "");
    assertEquals(2L, request("GET", index + "/_count", "").path("count").asLong());
    assertEquals(
        "my_test",
        request("GET", index + "/_doc/held", "").path("_source").path("testCaseFQN").asText());
  }

  @Test
  void aTimedOutDeleteIsNotRetried() throws Exception {
    keepConflicting = true;
    reportTimeout = true;
    deleteByScript();
    assertEquals(List.of(1L), conflicts);
    assertEquals(
        "my_test",
        request("GET", index + "/_doc/held", "").path("_source").path("testCaseFQN").asText());
  }

  @Test
  void aShardFailureIsNotRetried() throws Exception {
    keepConflicting = true;
    reportShardFailure = true;
    deleteByScript();
    assertEquals(List.of(1L), conflicts);
    assertEquals(
        "my_test",
        request("GET", index + "/_doc/held", "").path("_source").path("testCaseFQN").asText());
  }

  @Test
  void oneAttemptLeavesTheUnrefreshedUpdateBehind() throws Exception {
    rewriteWithoutRefresh();
    deleteOnce();
    assertEquals(List.of(1L), conflicts);
    assertEquals(2L, request("GET", index + "/_count", "").path("count").asLong());
  }

  @Test
  @EnabledIfSystemProperty(named = "scriptDelete.benchmark", matches = "true")
  void measuresCleanAndConflictedCleanup() throws Exception {
    List<Double> baseline = new ArrayList<>();
    List<Double> clean = new ArrayList<>();
    List<Double> retried = new ArrayList<>();
    for (int sample = 0; sample < 15; sample++) {
      seed(1000);
      long started = System.nanoTime();
      deleteOnce();
      double originalMillis = (System.nanoTime() - started) / 1_000_000.0;
      seed(1000);
      started = System.nanoTime();
      deleteByScript();
      double cleanMillis = (System.nanoTime() - started) / 1_000_000.0;
      seed(1000);
      rewriteWithoutRefresh();
      started = System.nanoTime();
      deleteByScript();
      double conflictMillis = (System.nanoTime() - started) / 1_000_000.0;
      assertOnlyOtherTestCaseRemains();
      if (sample >= 3) {
        baseline.add(originalMillis);
        clean.add(cleanMillis);
        retried.add(conflictMillis);
      }
    }
    System.out.printf(
        "SCRIPT_DELETE_TIMING %s baseline_ms=%s clean_ms=%s conflict_ms=%s%n",
        getClass().getSimpleName(), baseline, clean, retried);
  }

  protected void rewriteWithoutRefresh() throws Exception {
    request("PUT", index + "/_doc/held?refresh=false", "{\"testCaseFQN\":\"my_test\",\"value\":2}");
  }

  private void seed() throws Exception {
    seed(2);
  }

  private void seed(int matchingDocuments) throws Exception {
    StringBuilder body = new StringBuilder();
    for (int doc = 0; doc < matchingDocuments; doc++) {
      String id = doc == 0 ? "held" : "match-" + doc;
      body.append("{\"index\":{\"_id\":\"")
          .append(id)
          .append("\"}}\n")
          .append("{\"testCaseFQN\":\"my_test\",\"value\":1}\n");
    }
    body.append("{\"index\":{\"_id\":\"keep\"}}\n{\"testCaseFQN\":\"another_test\"}\n");
    assertEquals(
        false,
        request("POST", index + "/_bulk?refresh=true", body.toString()).path("errors").asBoolean());
    conflicts.clear();
  }

  private void assertOnlyOtherTestCaseRemains() throws Exception {
    assertEquals(1L, request("GET", index + "/_count", "").path("count").asLong());
    assertEquals(
        "another_test",
        request("GET", index + "/_doc/keep", "").path("_source").path("testCaseFQN").asText());
  }

  private JsonNode request(String method, String path, String body) throws Exception {
    HttpRequest req =
        HttpRequest.newBuilder(URI.create(engineUrl() + "/" + path))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "application/json")
            .method(
                method,
                body.isEmpty()
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = http.send(req, HttpResponse.BodyHandlers.ofString());
    assertTrue(response.statusCode() >= 200 && response.statusCode() < 300, response.body());
    return MAPPER.readTree(response.body());
  }
}

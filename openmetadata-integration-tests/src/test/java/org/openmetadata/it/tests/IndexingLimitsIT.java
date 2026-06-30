package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.ResponseException;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.search.SearchFieldLimits;
import org.openmetadata.service.search.SearchIndexSettings;
import org.openmetadata.service.search.opensearch.OsUtils;

/**
 * Proves the engine-native hardening in {@link SearchIndexSettings} prevents documents from being
 * rejected by the real search engine. For each risk class, a document is rejected by an index built
 * from the raw mapping and accepted by an index built from the hardened mapping. Runs against
 * whichever engine the active Maven profile selected, so the two CI profiles cover both engines.
 */
@Execution(ExecutionMode.CONCURRENT)
public class IndexingLimitsIT {

  private static final List<String> CREATED_INDICES = new CopyOnWriteArrayList<>();

  @AfterAll
  static void cleanup() {
    Rest5Client client = TestSuiteBootstrap.createSearchClient();
    for (String index : CREATED_INDICES) {
      try {
        client.performRequest(new Request("DELETE", "/" + index));
      } catch (Exception ignored) {
        // best-effort cleanup
      }
    }
  }

  @Test
  void keywordOverByteLimitRejectedRawAcceptedWhenHardened() throws Exception {
    String rawMapping = "{\"mappings\":{\"properties\":{\"fqn\":{\"type\":\"keyword\"}}}}";
    String doc = "{\"fqn\":\"" + "a".repeat(40000) + "\"}";

    assertTrue(
        rejects("kw_raw", rawMapping, doc), "raw keyword index must reject the immense term");
    assertTrue(
        accepts("kw_hardened", harden(rawMapping), doc),
        "hardened index (ignore_above) must accept the value");
  }

  static Stream<Arguments> malformedValuesByType() {
    return Stream.of(
        Arguments.of("integer", "\"not-a-number\""),
        Arguments.of("long", "\"not-a-long\""),
        Arguments.of("double", "\"not-a-double\""),
        Arguments.of("float", "\"NaN\""),
        Arguments.of("date", "\"not-a-date\""),
        Arguments.of("boolean", "\"not-a-bool\""));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("malformedValuesByType")
  void malformedValueRejectedRawAcceptedWhenHardened(String type, String jsonValue)
      throws Exception {
    String rawMapping = "{\"mappings\":{\"properties\":{\"v\":{\"type\":\"" + type + "\"}}}}";
    String doc = "{\"v\":" + jsonValue + "}";

    assertTrue(
        rejects(type + "_raw", rawMapping, doc),
        "raw " + type + " index must reject the bad value");
    assertTrue(
        accepts(type + "_hardened", harden(rawMapping), doc),
        "hardened " + type + " index (ignore_malformed) must accept the document");
  }

  private String harden(String mapping) {
    String hardened = SearchIndexSettings.harden(mapping, SearchFieldLimits.defaults());
    // Mirror the production OpenSearch path: harden() then enrichIndexMappingForOpenSearch()
    // (e.g. strips ignore_malformed from boolean, which OpenSearch rejects).
    if ("opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch"))) {
      hardened = OsUtils.enrichIndexMappingForOpenSearch(hardened);
    }
    return hardened;
  }

  private boolean rejects(String index, String mapping, String doc) throws Exception {
    createIndex(index, mapping);
    return indexStatus(index, doc) >= 400;
  }

  private boolean accepts(String index, String mapping, String doc) throws Exception {
    createIndex(index, mapping);
    return indexStatus(index, doc) < 400;
  }

  /**
   * Status code of indexing {@code doc} into {@code index}. The rest5 low-level client surfaces a
   * rejected write as the {@link Response} carrying the 4xx (not always a thrown exception), so the
   * status code is authoritative — mirroring how {@code ElasticSearchClient} reads {@code
   * e.getResponse()}. A thrown {@link ResponseException} is unwrapped to its response so a rejection
   * is detected whichever way the client surfaces it.
   */
  private int indexStatus(String index, String doc) throws Exception {
    int statusCode;
    try {
      statusCode = index(index, doc).getStatusCode();
    } catch (ResponseException rejected) {
      statusCode = rejected.getResponse().getStatusCode();
    }
    return statusCode;
  }

  private void createIndex(String index, String mapping) throws Exception {
    Rest5Client client = TestSuiteBootstrap.createSearchClient();
    CREATED_INDICES.add(index);
    Request request = new Request("PUT", "/" + index);
    request.setJsonEntity(mapping);
    client.performRequest(request);
  }

  private Response index(String index, String doc) throws Exception {
    Rest5Client client = TestSuiteBootstrap.createSearchClient();
    Request request = new Request("PUT", "/" + index + "/_doc/1?refresh=true");
    request.setJsonEntity(doc);
    return client.performRequest(request);
  }
}

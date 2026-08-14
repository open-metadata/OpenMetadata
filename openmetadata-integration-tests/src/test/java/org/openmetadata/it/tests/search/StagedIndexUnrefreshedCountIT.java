package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;

/**
 * Regression guard for the staged-index rescue in {@code DefaultRecreateHandler}.
 *
 * <p>During a recreate reindex the staged index is built with {@code refresh_interval=-1} and the
 * bulk writes use {@code refresh=false} (see {@code OpenSearchBulkSink}). When a reindex finishes
 * with {@code reindexSuccess=false}, the handler decides whether the staged index is empty (delete)
 * or holds partial data (promote). It previously used {@code docs.count}, which counts only docs
 * that have been refreshed into searchable Lucene segments — so a fully-built-but-unrefreshed
 * staged index read as 0 docs and was deleted, emptying the served index. The staged index must NOT
 * be refreshed before promotion, so the decision now uses {@code indexing.index_total}, a write
 * counter that is independent of refresh.
 *
 * <p>This test pins that distinction against a real cluster (the unit-level handler test mocks the
 * counts, so it could not catch the original bug): after bulk-writing with {@code refresh=false} to
 * an index whose {@code refresh_interval} is disabled, {@code getDocumentCount} reads 0 while
 * {@code getIndexedDocumentCount} reflects the writes. Embedded-only: it writes to the cluster
 * directly, which external mode does not expose.
 */
@Execution(ExecutionMode.SAME_THREAD)
class StagedIndexUnrefreshedCountIT {

  private static final int DOC_COUNT = 7;
  private static final Duration TIMEOUT = Duration.ofSeconds(30);

  private static ServerHandle server;
  private static HttpClient http;
  private static URI clusterBase;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    assumeTrue(
        !server.isExternal(),
        "Writing raw docs to the cluster needs direct access; external mode does not expose it");
    http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    clusterBase =
        URI.create(server.searchScheme() + "://" + server.searchHost() + ":" + server.searchPort());
  }

  @Test
  void unrefreshedBulkWritesAreInvisibleToDocCountButCountedByIndexedOps() {
    final SearchClient searchClient = Entity.getSearchRepository().getSearchClient();
    final String index = stagedIndexName();
    try {
      createIndexWithRefreshDisabled(index);
      bulkIndexWithoutRefresh(index, DOC_COUNT);

      assertThat(searchClient.getDocumentCount(index))
          .as("docs.count must not see bulk writes that have not been refreshed into segments")
          .isZero();
      assertThat(searchClient.getIndexedDocumentCount(index))
          .as("index_total counts every write regardless of refresh, so the rescue sees the data")
          .isEqualTo(DOC_COUNT);

      refresh(index);

      assertThat(searchClient.getDocumentCount(index))
          .as("after an explicit refresh the two counts agree")
          .isEqualTo(DOC_COUNT);
    } finally {
      deleteIndexQuietly(index);
    }
  }

  private static String stagedIndexName() {
    final String alias = Entity.getSearchRepository().getClusterAlias();
    final String prefix = (alias == null || alias.isEmpty()) ? "" : alias + "_";
    return prefix + "it_staged_unrefreshed_count";
  }

  private void createIndexWithRefreshDisabled(final String index) {
    sendOrThrow(
        "PUT",
        "/" + index,
        "{\"settings\":{\"index\":{\"refresh_interval\":\"-1\","
            + "\"number_of_shards\":1,\"number_of_replicas\":0}}}");
  }

  private void bulkIndexWithoutRefresh(final String index, final int count) {
    final StringBuilder body = new StringBuilder();
    for (int i = 0; i < count; i++) {
      body.append("{\"index\":{\"_index\":\"")
          .append(index)
          .append("\",\"_id\":\"")
          .append(i)
          .append("\"}}\n")
          .append("{\"name\":\"doc-")
          .append(i)
          .append("\"}\n");
    }
    sendOrThrow("POST", "/_bulk?refresh=false", body.toString());
  }

  private void refresh(final String index) {
    sendOrThrow("POST", "/" + index + "/_refresh", "");
  }

  private void deleteIndexQuietly(final String index) {
    try {
      send("DELETE", "/" + index, null);
    } catch (Exception ignored) {
      // best-effort cleanup
    }
  }

  private void sendOrThrow(final String method, final String path, final String body) {
    final int status = send(method, path, body);
    if (status >= 300) {
      throw new IllegalStateException(
          "Cluster request " + method + " " + path + " failed with HTTP " + status);
    }
  }

  private int send(final String method, final String path, final String body) {
    try {
      final HttpRequest.BodyPublisher publisher =
          body == null
              ? HttpRequest.BodyPublishers.noBody()
              : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8);
      final HttpRequest request =
          HttpRequest.newBuilder()
              .uri(clusterBase.resolve(path))
              .timeout(TIMEOUT)
              .header("Content-Type", "application/json")
              .method(method, publisher)
              .build();
      return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    } catch (Exception e) {
      throw new IllegalStateException("Cluster request " + method + " " + path + " failed", e);
    }
  }
}

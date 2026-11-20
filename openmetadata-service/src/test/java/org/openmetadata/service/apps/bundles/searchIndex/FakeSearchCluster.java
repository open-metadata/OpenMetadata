package org.openmetadata.service.apps.bundles.searchIndex;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.GZIPInputStream;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

/**
 * A stand-in search node on a loopback port that answers {@code _bulk} after a fixed delay, so tests
 * can drive the real HC5 search clients — and their connection pools — against a slow cluster. It
 * counts the bulk requests it is serving at once and can reject the next N bulks with the 429 a
 * saturated node returns.
 */
final class FakeSearchCluster implements AutoCloseable {
  private static final String BULK_SUCCESS = "{\"took\":1,\"errors\":false,\"items\":[]}";
  private static final String BULK_REJECTED =
      """
      {"error":{"root_cause":[{"type":"es_rejected_execution_exception",\
      "reason":"rejected execution of coordinating operation"}],\
      "type":"es_rejected_execution_exception",\
      "reason":"rejected execution of coordinating operation"},"status":429}""";
  private static final String NODE_INFO = "{\"version\":{\"number\":\"8.15.0\"}}";
  private static final String INDEX_ACTION_PREFIX = "{\"index\"";
  private static final String GZIP = "gzip";
  private static final String CONTENT_ENCODING = "Content-Encoding";
  private static final String CONTENT_TYPE = "Content-Type";
  private static final String JSON = "application/json";
  private static final String ELASTIC_PRODUCT_HEADER = "X-Elastic-Product";
  private static final String ELASTIC_PRODUCT = "Elasticsearch";

  private final HttpServer server;
  private final ExecutorService requestThreads = Executors.newFixedThreadPool(16);
  private final ScheduledExecutorService responder = Executors.newScheduledThreadPool(4);
  private final long bulkLatencyMillis;
  private final AtomicInteger bulksInFlight = new AtomicInteger();
  private final AtomicInteger maxBulksInFlight = new AtomicInteger();
  private final AtomicInteger indexedDocuments = new AtomicInteger();
  private final AtomicInteger bulksToReject = new AtomicInteger();
  private final AtomicInteger rejectedBulks = new AtomicInteger();

  private FakeSearchCluster(long bulkLatencyMillis) throws IOException {
    this.bulkLatencyMillis = bulkLatencyMillis;
    this.server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 64);
    server.setExecutor(requestThreads);
    server.createContext("/_bulk", this::handleBulk);
    server.createContext("/", exchange -> respond(exchange, 200, NODE_INFO));
    server.start();
  }

  static FakeSearchCluster start(long bulkLatencyMillis) throws IOException {
    return new FakeSearchCluster(bulkLatencyMillis);
  }

  void rejectNextBulks(int count) {
    bulksToReject.set(count);
  }

  int maxConcurrentBulks() {
    return maxBulksInFlight.get();
  }

  int indexedDocuments() {
    return indexedDocuments.get();
  }

  int rejectedBulks() {
    return rejectedBulks.get();
  }

  /** Client settings for this node with a pool of {@code maxConnections} on its single route. */
  ElasticSearchConfiguration configuration(
      ElasticSearchConfiguration.SearchType searchType,
      int maxConnections,
      int connectionRequestTimeoutSecs) {
    return new ElasticSearchConfiguration()
        .withHost(server.getAddress().getHostString())
        .withPort(server.getAddress().getPort())
        .withScheme("http")
        .withSearchType(searchType)
        .withClusterAlias("")
        .withBatchSize(10)
        .withConnectionTimeoutSecs(5)
        .withSocketTimeoutSecs(30)
        .withConnectionRequestTimeoutSecs(connectionRequestTimeoutSecs)
        .withMaxConnTotal(maxConnections)
        .withMaxConnPerRoute(maxConnections);
  }

  @Override
  public void close() {
    server.stop(0);
    responder.shutdownNow();
    requestThreads.shutdownNow();
  }

  private void handleBulk(HttpExchange exchange) throws IOException {
    int documents = countIndexActions(exchange);
    maxBulksInFlight.accumulateAndGet(bulksInFlight.incrementAndGet(), Math::max);
    boolean rejected = bulksToReject.getAndUpdate(remaining -> Math.max(0, remaining - 1)) > 0;
    responder.schedule(
        () -> completeBulk(exchange, documents, rejected),
        bulkLatencyMillis,
        TimeUnit.MILLISECONDS);
  }

  private void completeBulk(HttpExchange exchange, int documents, boolean rejected) {
    bulksInFlight.decrementAndGet();
    if (rejected) {
      rejectedBulks.incrementAndGet();
    } else {
      indexedDocuments.addAndGet(documents);
    }
    try {
      respond(exchange, rejected ? 429 : 200, rejected ? BULK_REJECTED : BULK_SUCCESS);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private static int countIndexActions(HttpExchange exchange) throws IOException {
    String body = new String(readBody(exchange), StandardCharsets.UTF_8);
    return (int) body.lines().filter(line -> line.startsWith(INDEX_ACTION_PREFIX)).count();
  }

  private static byte[] readBody(HttpExchange exchange) throws IOException {
    boolean gzipped =
        GZIP.equalsIgnoreCase(exchange.getRequestHeaders().getFirst(CONTENT_ENCODING));
    try (InputStream body =
        gzipped ? new GZIPInputStream(exchange.getRequestBody()) : exchange.getRequestBody()) {
      return body.readAllBytes();
    }
  }

  private static void respond(HttpExchange exchange, int status, String json) throws IOException {
    byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add(CONTENT_TYPE, JSON);
    exchange.getResponseHeaders().add(ELASTIC_PRODUCT_HEADER, ELASTIC_PRODUCT);
    exchange.sendResponseHeaders(status, bytes.length);
    exchange.getResponseBody().write(bytes);
    exchange.close();
  }
}

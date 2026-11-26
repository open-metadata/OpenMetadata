package org.openmetadata.service.apps.bundles.searchIndex;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

/**
 * A stand-in search node on a loopback port that answers {@code _bulk} after a fixed delay, so tests
 * can drive the real HC5 search clients — and their connection pools — against a slow cluster. It
 * counts the bulk requests it is serving at once and can reject the next N bulks with the 429 a
 * saturated node returns — either for the whole request, or per item, the way a node that is out of
 * indexing-pressure budget answers.
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
  private static final Pattern ACTION_DOC_ID = Pattern.compile("\"_id\":\"([^\"]+)\"");
  private static final Pattern ACTION_INDEX = Pattern.compile("\"_index\":\"([^\"]+)\"");
  private static final String ITEM_REJECTED =
      """
      {"index":{"_index":"%s","_id":"%s","status":429,\
      "error":{"type":"es_rejected_execution_exception",\
      "reason":"rejected execution of primary operation [coordinating_and_primary_bytes=170375573,\
       replica_bytes=335672130, all_bytes=506047703, primary_operation_bytes=11466,\
       max_coordinating_and_primary_bytes=429496729]"}}}""";
  private static final String BULK_ITEMS_REJECTED = "{\"took\":1,\"errors\":true,\"items\":[%s]}";
  private static final String ITEM_WRITTEN =
      """
      {"index":{"_index":"%s","_id":"%s","_version":1,"result":"created","status":201}}""";
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
  private final AtomicInteger bulksToRejectPerItem = new AtomicInteger();
  private final AtomicInteger bulksToRejectFirstItem = new AtomicInteger();
  private final AtomicInteger rejectedBulks = new AtomicInteger();
  private final AtomicInteger rejectedItems = new AtomicInteger();

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

  /**
   * Answers the next {@code count} bulks the way a node out of indexing-pressure budget does: HTTP
   * 200, with every item carrying its own 429. The request succeeded; the documents did not.
   */
  void rejectItemsInNextBulks(int count) {
    bulksToRejectPerItem.set(count);
  }

  /**
   * Answers the next {@code count} bulks the way a node with just enough budget left does: HTTP
   * 200, the first item rejected with a 429 and the rest written. A bulk that settles both ways at
   * once is what tells a double count apart from a correct one.
   */
  void rejectFirstItemInNextBulks(int count) {
    bulksToRejectFirstItem.set(count);
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

  int rejectedItems() {
    return rejectedItems.get();
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
    List<IndexAction> actions = indexActions(exchange);
    maxBulksInFlight.accumulateAndGet(bulksInFlight.incrementAndGet(), Math::max);
    boolean rejected = bulksToReject.getAndUpdate(remaining -> Math.max(0, remaining - 1)) > 0;
    boolean itemsRejected =
        !rejected && bulksToRejectPerItem.getAndUpdate(remaining -> Math.max(0, remaining - 1)) > 0;
    boolean firstItemRejected =
        !rejected
            && !itemsRejected
            && bulksToRejectFirstItem.getAndUpdate(remaining -> Math.max(0, remaining - 1)) > 0;
    Outcome outcome = new Outcome(rejected, itemsRejected, firstItemRejected);
    responder.schedule(
        () -> completeBulk(exchange, actions, outcome), bulkLatencyMillis, TimeUnit.MILLISECONDS);
  }

  private void completeBulk(HttpExchange exchange, List<IndexAction> actions, Outcome outcome) {
    bulksInFlight.decrementAndGet();
    if (outcome.wholeBulkRejected()) {
      rejectedBulks.incrementAndGet();
    } else {
      int turnedAway = outcome.rejectedItemCount(actions.size());
      rejectedItems.addAndGet(turnedAway);
      indexedDocuments.addAndGet(actions.size() - turnedAway);
    }
    try {
      respond(
          exchange, responseStatus(outcome.wholeBulkRejected()), responseBody(actions, outcome));
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  /** How this node decided to answer one bulk. */
  private record Outcome(
      boolean wholeBulkRejected, boolean everyItemRejected, boolean firstItemRejected) {

    int rejectedItemCount(int actions) {
      int rejected = 0;
      if (everyItemRejected) {
        rejected = actions;
      } else if (firstItemRejected) {
        rejected = Math.min(1, actions);
      }
      return rejected;
    }
  }

  private static int responseStatus(boolean rejected) {
    return rejected ? 429 : 200;
  }

  private static String responseBody(List<IndexAction> actions, Outcome outcome) {
    String body;
    if (outcome.wholeBulkRejected()) {
      body = BULK_REJECTED;
    } else if (outcome.rejectedItemCount(actions.size()) == 0) {
      body = BULK_SUCCESS;
    } else {
      body = String.format(BULK_ITEMS_REJECTED, itemsFor(actions, outcome));
    }
    return body;
  }

  private static String itemsFor(List<IndexAction> actions, Outcome outcome) {
    int rejected = outcome.rejectedItemCount(actions.size());
    List<String> items = new ArrayList<>();
    for (int i = 0; i < actions.size(); i++) {
      IndexAction action = actions.get(i);
      String template = i < rejected ? ITEM_REJECTED : ITEM_WRITTEN;
      items.add(String.format(template, action.index(), action.docId()));
    }
    return String.join(",", items);
  }

  private static List<IndexAction> indexActions(HttpExchange exchange) throws IOException {
    String body = new String(readBody(exchange), StandardCharsets.UTF_8);
    return body.lines()
        .filter(line -> line.startsWith(INDEX_ACTION_PREFIX))
        .map(FakeSearchCluster::indexActionOf)
        .toList();
  }

  private static IndexAction indexActionOf(String actionLine) {
    return new IndexAction(
        captureOrEmpty(ACTION_INDEX, actionLine), captureOrEmpty(ACTION_DOC_ID, actionLine));
  }

  private static String captureOrEmpty(Pattern pattern, String line) {
    Matcher matcher = pattern.matcher(line);
    return matcher.find() ? matcher.group(1) : "";
  }

  /** One index action read back off the wire, so a rejected item can echo its index and id. */
  private record IndexAction(String index, String docId) {}

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

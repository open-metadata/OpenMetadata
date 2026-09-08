package org.openmetadata.service.rdf.storage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.google.common.base.Utf8;
import io.micrometer.core.instrument.Metrics;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.channels.ClosedChannelException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.OptionalLong;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.LongConsumer;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.atlas.web.HttpException;
import org.apache.jena.query.ParameterizedSparqlString;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.ResultSet;
import org.apache.jena.query.ResultSetFormatter;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.StmtIterator;
import org.apache.jena.rdfconnection.RDFConnection;
import org.apache.jena.rdfconnection.RDFConnectionFuseki;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.update.UpdateFactory;
import org.apache.jena.update.UpdateRequest;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfOwnedResources;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.translator.RdfPropertyMapper;

/**
 * Apache Jena Fuseki implementation of RDF storage.
 * Connects to a remote Fuseki server for stateless RDF operations.
 */
@Slf4j
public class JenaFusekiStorage implements RdfStorageInterface {

  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String METADATA_GRAPH = "https://open-metadata.org/graph/metadata";
  private static final String GRAPH_TRIPLE_COUNT_QUERY =
      "SELECT (COUNT(*) as ?count) WHERE { GRAPH ?graph { ?s ?p ?o } }";

  // Defaults keep TCP connect fail-fast while giving production Fuseki enough
  // time for larger SPARQL UPDATE transactions. The request timeout bounds the
  // per-request body via an interruptible Future around every blocking
  // RDFConnection call below — caller thread frees on timeout even when Fuseki
  // accepts the TCP connection and then stalls on the response.
  //
  // We use an executor Future rather than Jena's QueryExecution.setTimeout
  // (removed in Jena 5; broke integration tests previously) or Jena's
  // QueryExecutionHTTPBuilder / UpdateExecHTTPBuilder (API surface differs
  // between Jena 4 and Jena 5, and our two classpaths use different
  // versions). The wrapper is Jena-API-agnostic. On timeout the underlying
  // HTTP request continues to leak its (virtual) thread until OS-level TCP
  // give-up; that's bounded by the circuit breaker, which trips after
  // CIRCUIT_BREAKER_FAILURE_THRESHOLD connect/timeout failures and
  // short-circuits new traffic for CIRCUIT_BREAKER_COOLDOWN_MS.
  static final int DEFAULT_CONNECT_TIMEOUT_MS = 2_000;
  static final long DEFAULT_REQUEST_TIMEOUT_MS = RdfStorageInterface.DEFAULT_REQUEST_TIMEOUT_MS;
  static final int DEFAULT_WRITE_MAX_RETRIES = 2;
  static final long DEFAULT_WRITE_RETRY_INITIAL_BACKOFF_MS = 250L;
  static final long DEFAULT_WRITE_RETRY_MAX_BACKOFF_MS = 2_000L;

  private static final int CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
  private static final long CIRCUIT_BREAKER_COOLDOWN_MS = 30_000L;

  private static final long SLOW_REQUEST_WARN_THRESHOLD_MS = 10_000L;

  private static final int STREAM_PIPE_BUFFER_BYTES = 64 * 1024;
  private static final String CONTENT_TYPE_RDF_THRIFT = "application/rdf+thrift";
  private static final String HEADER_CONTENT_TYPE = "Content-Type";
  private static final String HEADER_CONTENT_ENCODING = "Content-Encoding";
  private static final String ENCODING_GZIP = "gzip";
  private static final String METRIC_FUSEKI_REQUEST = "rdf.fuseki.request";
  private static final String METRIC_FUSEKI_TIMEOUTS = "rdf.fuseki.timeouts";
  private static final String METRIC_FUSEKI_PAYLOAD_BYTES = "rdf.fuseki.payload.bytes";
  private static final String METRIC_FUSEKI_WRITER_WAIT = "rdf.fuseki.writer.wait";
  private static final String TAG_OPERATION = "operation";
  private static final String TAG_OUTCOME = "outcome";
  private static final String REQUEST_OUTCOME_SUCCESS = "success";
  private static final String REQUEST_OUTCOME_TIMEOUT = "timeout";
  private static final String REQUEST_OUTCOME_ERROR = "error";

  // Compaction polls /$/tasks/{taskId} until the task reports finished. Fuseki
  // does not stream progress, so we poll on a fixed cadence. Total budget is
  // bounded so a hung compaction can never block the indexer indefinitely;
  // exceeding the budget logs and returns — compaction may still be running on
  // the server, the dataset stays operational, only the wait is abandoned.
  private static final Duration COMPACT_HTTP_TIMEOUT = Duration.ofSeconds(30);
  private static final long COMPACT_POLL_INTERVAL_MS = 2_000L;
  private static final long COMPACT_MAX_WAIT_MS = 600_000L;

  // Dedicated virtual-thread executor for the timeout wrapper. We deliberately
  // do NOT share ForkJoinPool.commonPool: a timed-out Jena call continues to
  // block its worker thread until OS-level TCP give-up, and on commonPool that
  // would starve unrelated asynchronous work elsewhere
  // in the service. Virtual threads are cheap to leak (a few KB stack each)
  // and the circuit breaker bounds how many can pile up.
  private static final ExecutorService TIMEOUT_EXECUTOR =
      Executors.newThreadPerTaskExecutor(
          Thread.ofVirtual().name("rdf-storage-timeout-", 0).factory());

  private volatile RDFConnection connection;
  private final String baseUri;
  private volatile String endpoint;
  private final String username;
  private final String password;
  private final Duration connectTimeout;
  private final long requestTimeoutMs;
  private final int writeMaxRetries;
  private final long writeRetryInitialBackoffMs;
  private final long writeRetryMaxBackoffMs;
  private final int maxUpdatePayloadBytes;
  private final int maxAppendPayloadBytes;
  private final boolean streamingAppendEnabled;
  private final boolean gzipRequests;
  private final HttpClient streamingHttpClient;
  private final LongConsumer retryDelayMs;

  private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
  private final AtomicLong circuitOpenUntilMs = new AtomicLong(0L);
  private final Semaphore writePermit = new Semaphore(1, true);

  public JenaFusekiStorage(RdfConfiguration config) {
    this(config, (String) null);
  }

  public JenaFusekiStorage(RdfConfiguration config, String datasetNameOverride) {
    this(config, JenaFusekiStorage::sleepRetryDelay, datasetNameOverride);
  }

  JenaFusekiStorage(RdfConfiguration config, LongConsumer retryDelayMs) {
    this(config, retryDelayMs, null);
  }

  JenaFusekiStorage(RdfConfiguration config, LongConsumer retryDelayMs, String datasetOverride) {
    this.baseUri =
        config.getBaseUri() != null ? config.getBaseUri().toString() : "https://open-metadata.org/";

    String configuredEndpoint =
        config.getRemoteEndpoint() != null && !config.getRemoteEndpoint().toString().isEmpty()
            ? config.getRemoteEndpoint().toString()
            : "http://openmetadata-fuseki:3030/openmetadata";
    this.endpoint = redirectToDataset(configuredEndpoint, datasetOverride);
    final String userInfo = URI.create(configuredEndpoint).getUserInfo();
    final String[] credentials = userInfo == null ? new String[0] : userInfo.split(":", 2);
    this.username =
        config.getUsername() != null
            ? config.getUsername()
            : credentials.length == 2 ? credentials[0] : null;
    this.password =
        config.getPassword() != null
            ? config.getPassword()
            : credentials.length == 2 ? credentials[1] : null;
    this.connectTimeout = Duration.ofMillis(resolveConnectTimeoutMs(config));
    this.requestTimeoutMs = resolveRequestTimeoutMs(config);
    this.writeMaxRetries = resolveWriteMaxRetries(config);
    this.writeRetryInitialBackoffMs = resolveWriteRetryInitialBackoffMs(config);
    this.writeRetryMaxBackoffMs = resolveWriteRetryMaxBackoffMs(config);
    this.maxUpdatePayloadBytes = RdfStorageInterface.resolveMaxUpdatePayloadBytes(config);
    this.maxAppendPayloadBytes = RdfStorageInterface.resolveMaxAppendPayloadBytes(config);
    this.streamingAppendEnabled =
        config.getStreamingAppendEnabled() == null || config.getStreamingAppendEnabled();
    this.gzipRequests = Boolean.TRUE.equals(config.getGzipRequests());
    this.streamingHttpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
    this.retryDelayMs = retryDelayMs;

    this.connection = buildConnection(endpoint);
    LOG.info("Connected to Apache Jena Fuseki at {}", maskUserInfo(endpoint));
    loadOntology();
  }

  private RDFConnection buildConnection(String destination) {
    final DatasetEndpoint info = parseDatasetEndpoint(destination);
    if (info != null) {
      destination = info.serverBaseUrl() + "/" + encodePathSegment(info.datasetName());
    }
    HttpClient.Builder clientBuilder = HttpClient.newBuilder().connectTimeout(connectTimeout);
    if (username != null && password != null) {
      clientBuilder.authenticator(
          new java.net.Authenticator() {
            @Override
            protected java.net.PasswordAuthentication getPasswordAuthentication() {
              return new java.net.PasswordAuthentication(username, password.toCharArray());
            }
          });
    }
    return RDFConnectionFuseki.create()
        .destination(destination)
        .httpClient(clientBuilder.build())
        .triplesFormat(RDFFormat.RDF_THRIFT)
        .build();
  }

  static int resolveConnectTimeoutMs(RdfConfiguration config) {
    return positiveInt(config.getConnectTimeoutMs(), DEFAULT_CONNECT_TIMEOUT_MS);
  }

  static long resolveRequestTimeoutMs(RdfConfiguration config) {
    return RdfStorageInterface.resolveRequestTimeoutMs(config);
  }

  static int resolveWriteMaxRetries(RdfConfiguration config) {
    Integer value = config.getWriteMaxRetries();
    return value != null && value >= 0 ? value : DEFAULT_WRITE_MAX_RETRIES;
  }

  static long resolveWriteRetryInitialBackoffMs(RdfConfiguration config) {
    return nonNegativeLong(
        config.getWriteRetryInitialBackoffMs(), DEFAULT_WRITE_RETRY_INITIAL_BACKOFF_MS);
  }

  static long resolveWriteRetryMaxBackoffMs(RdfConfiguration config) {
    return nonNegativeLong(config.getWriteRetryMaxBackoffMs(), DEFAULT_WRITE_RETRY_MAX_BACKOFF_MS);
  }

  private static int positiveInt(Integer value, int defaultValue) {
    return value != null && value > 0 ? value : defaultValue;
  }

  private static long nonNegativeLong(Integer value, long defaultValue) {
    return value != null && value >= 0 ? value.longValue() : defaultValue;
  }

  @Override
  public void ensureStorageReady() {
    writeCapabilities = verifyDataset(endpoint);
    if (!testConnection()) {
      throw new IllegalStateException("RDF dataset is not accessible at " + maskUserInfo(endpoint));
    }
  }

  private volatile FusekiWriteCapabilities writeCapabilities;

  private FusekiWriteCapabilities writeCapabilities() {
    FusekiWriteCapabilities result = writeCapabilities;
    if (result == null) {
      result = verifyDataset(endpoint);
      writeCapabilities = result;
    }
    return result;
  }

  private FusekiWriteCapabilities verifyDataset(final String datasetEndpoint) {
    try {
      final DatasetEndpoint info = parseDatasetEndpoint(datasetEndpoint);
      if (info == null) {
        throw new IllegalArgumentException("Invalid RDF dataset endpoint");
      }
      final HttpRequest.Builder request =
          HttpRequest.newBuilder()
              .uri(
                  URI.create(
                      info.serverBaseUrl() + "/" + encodePathSegment(info.datasetName()) + "/data"))
              .timeout(Duration.ofMillis(requestTimeoutMs))
              .method("OPTIONS", HttpRequest.BodyPublishers.noBody());
      addBasicAuth(request, username, password, info.userInfo());
      final HttpResponse<Void> response =
          streamingHttpClient.send(request.build(), HttpResponse.BodyHandlers.discarding());
      if (response.statusCode() / 100 != 2) {
        throw new IllegalStateException(
            "Provision the RDF dataset from the OpenMetadata Fuseki assembler before indexing: "
                + maskUserInfo(datasetEndpoint)
                + " (HTTP "
                + response.statusCode()
                + ")");
      }
      return FusekiWriteCapabilities.require(response.headers());
    } catch (IOException exception) {
      throw new IllegalStateException("Could not verify Fuseki dataset configuration", exception);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(
          "Interrupted while verifying Fuseki dataset configuration", exception);
    }
  }

  /**
   * Parses a Fuseki endpoint URL into its server base URL and dataset name.
   * Expected endpoint shape: {@code http://host:port/datasetName} (with optional
   * trailing service path like {@code /sparql}). Returns null if the path
   * doesn't carry a dataset name or the URL is malformed — callers should
   * log and skip the admin operation rather than blow up.
   *
   * <p>Hoists any embedded {@code user:pass@} userInfo OUT of the URL into a
   * separate field on {@link DatasetEndpoint}. The {@code serverBaseUrl}
   * returned to callers is credential-free so it can be safely concatenated
   * into request URIs without risking leakage to JDK HttpClient debug logs
   * or downstream proxies. Operators who configured auth via URL get the
   * same effective auth — callers pass the {@code userInfo} field into
   * {@link #addBasicAuth(HttpRequest.Builder, String, String, String)},
   * which encodes it into the {@code Authorization} header.
   */
  // Package-private (vs private) so the test class in the same package can
  // exercise URL-parsing edge cases directly. Same rationale applies to the
  // other static helpers below.
  /**
   * Point an endpoint at a different dataset on the same server, preserving scheme, host, port and
   * any embedded credentials. Returns the endpoint unchanged when no override is requested or when
   * the endpoint cannot be parsed — callers get today's behaviour rather than a silently wrong
   * target.
   */
  static String redirectToDataset(String endpoint, String datasetName) {
    String result = endpoint;
    if (datasetName != null && !datasetName.isBlank()) {
      DatasetEndpoint parsed = parseDatasetEndpoint(endpoint);
      if (parsed == null) {
        LOG.warn(
            "Could not parse RDF endpoint {}; ignoring dataset override {}",
            maskUserInfo(endpoint),
            datasetName);
      } else {
        StringBuilder redirected = new StringBuilder();
        int schemeEnd = parsed.serverBaseUrl().indexOf("://");
        redirected.append(parsed.serverBaseUrl(), 0, schemeEnd + 3);
        if (parsed.userInfo() != null) {
          redirected.append(parsed.userInfo()).append('@');
        }
        redirected.append(parsed.serverBaseUrl().substring(schemeEnd + 3));
        redirected.append('/').append(encodePathSegment(datasetName));
        result = redirected.toString();
      }
    }
    return result;
  }

  static DatasetEndpoint parseDatasetEndpoint(String endpoint) {
    if (endpoint == null) {
      return null;
    }
    URI uri;
    try {
      uri = URI.create(endpoint);
    } catch (IllegalArgumentException e) {
      return null;
    }
    // A relative URI ("openmetadata", "not-a-url") parses successfully but has no scheme or host,
    // which would otherwise yield a "null://null" server base and silently produce admin URLs and
    // dataset redirects pointing nowhere.
    if (uri.getScheme() == null || uri.getHost() == null) {
      return null;
    }
    String path = uri.getPath();
    if (path == null || path.isBlank() || path.equals("/")) {
      return null;
    }
    path = path.replaceAll("/+$", "");
    final String last = path.substring(path.lastIndexOf('/') + 1);
    if (Set.of("sparql", "query", "update", "data", "get").contains(last)) {
      path = path.substring(0, path.lastIndexOf('/'));
    }
    final int separator = path.lastIndexOf('/');
    final String datasetName = path.substring(separator + 1);
    if (datasetName.isBlank()) {
      return null;
    }
    final String prefix = separator > 0 ? path.substring(0, separator) : "";
    StringBuilder serverBaseUrl = new StringBuilder();
    serverBaseUrl.append(uri.getScheme()).append("://").append(uri.getHost());
    if (uri.getPort() > 0) {
      serverBaseUrl.append(':').append(uri.getPort());
    }
    serverBaseUrl.append(prefix);
    String userInfo = uri.getRawUserInfo();
    return new DatasetEndpoint(
        serverBaseUrl.toString(),
        datasetName,
        userInfo != null && !userInfo.isEmpty() ? userInfo : null);
  }

  /** URL-encode a path segment for safe interpolation into request URIs. */
  static String encodePathSegment(String segment) {
    return java.net.URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20");
  }

  record DatasetEndpoint(String serverBaseUrl, String datasetName, String userInfo) {}

  /**
   * Replace any {@code user:pass@} userInfo in a URL with {@code ***@} for
   * safe logging. parseDatasetEndpoint preserves embedded credentials so the
   * admin HTTP calls reach the server with the right auth, but logs must not
   * carry those credentials to disk / log aggregators.
   */
  static String maskUserInfo(String urlOrEndpoint) {
    if (urlOrEndpoint == null) {
      return null;
    }
    try {
      URI u = URI.create(urlOrEndpoint);
      if (u.getRawUserInfo() == null || u.getRawUserInfo().isEmpty()) {
        return urlOrEndpoint;
      }
      StringBuilder sb = new StringBuilder();
      sb.append(u.getScheme()).append("://").append("***@").append(u.getHost());
      if (u.getPort() > 0) {
        sb.append(':').append(u.getPort());
      }
      if (u.getRawPath() != null) {
        sb.append(u.getRawPath());
      }
      return sb.toString();
    } catch (RuntimeException e) {
      // Don't let a logging helper take down the caller; fall back to a
      // crude regex replacement.
      return urlOrEndpoint.replaceAll("://[^@/]+@", "://***@");
    }
  }

  private static void addBasicAuth(
      HttpRequest.Builder requestBuilder, String username, String password) {
    if (username == null || password == null) {
      return;
    }
    String auth = username + ":" + password;
    // RFC 7617 mandates UTF-8 for the credential string before Base64 encoding.
    // Using auth.getBytes() relies on the JVM default charset, which is not
    // guaranteed to be UTF-8 in containerised environments with non-standard
    // locales.
    String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
    requestBuilder.header("Authorization", "Basic " + encodedAuth);
  }

  /**
   * Three-argument overload that prefers explicit {@code username/password} when
   * present and falls back to URL-embedded {@code userInfo}. Used by the admin
   * HTTP paths so credentials from either source are encoded into the
   * {@code Authorization} header instead of being left in the request URI.
   */
  private static void addBasicAuth(
      HttpRequest.Builder requestBuilder, String username, String password, String userInfo) {
    if (username != null && password != null) {
      addBasicAuth(requestBuilder, username, password);
      return;
    }
    if (userInfo == null || userInfo.isEmpty()) {
      return;
    }
    // userInfo is URL-encoded (RFC 3986 percent-encoded); decode before
    // re-encoding into a Basic auth header. The base64 layer is independent of
    // the URL encoding.
    String decoded = java.net.URLDecoder.decode(userInfo, StandardCharsets.UTF_8);
    String encodedAuth =
        Base64.getEncoder().encodeToString(decoded.getBytes(StandardCharsets.UTF_8));
    requestBuilder.header("Authorization", "Basic " + encodedAuth);
  }

  @Override
  public boolean supportsDatasetManagement() {
    return true;
  }

  @Override
  public String currentDatasetName() {
    DatasetEndpoint info = parseDatasetEndpoint(endpoint);
    return info != null ? info.datasetName() : null;
  }

  /**
   * Re-point this instance at another dataset on the same server. Used by blue/green rebuilds so
   * the flip is a reference swap rather than a rebuild of every caller's storage handle.
   */
  @Override
  public void repointToDataset(String datasetName) {
    if (datasetName == null || datasetName.isBlank()) {
      return;
    }
    String newEndpoint = redirectToDataset(endpoint, datasetName);
    if (newEndpoint.equals(endpoint)) {
      return;
    }
    RDFConnection newConnection = buildConnection(newEndpoint);
    this.endpoint = newEndpoint;
    this.connection = newConnection;
    this.writeCapabilities = null;
    LOG.info("RDF storage now serving dataset '{}'", datasetName);
  }

  @Override
  public void createDatasetIfMissing(String datasetName) {
    verifyDataset(redirectToDataset(endpoint, datasetName));
  }

  /**
   * Removes the dataset from the running server and its configuration. Fuseki does not guarantee
   * that the on-disk files are reclaimed, which is why blue/green alternates between two fixed
   * dataset names and clears the target before reuse rather than minting a new name per run —
   * otherwise every rebuild would leak a dataset directory.
   */
  @Override
  public void deleteDataset(String datasetName) {
    DatasetEndpoint info = requireServerInfo("deleteDataset");
    try {
      HttpResponse<String> response =
          sendAdminRequest(
              info.serverBaseUrl() + "/$/datasets/" + encodePathSegment(datasetName),
              builder -> builder.DELETE(),
              info.userInfo());
      int status = response.statusCode();
      if (status == 200 || status == 204 || status == 404) {
        LOG.info("Removed Fuseki dataset '{}' (status {})", datasetName, status);
      } else {
        throw new IllegalStateException(
            "Failed to delete Fuseki dataset '"
                + datasetName
                + "': "
                + status
                + " - "
                + response.body());
      }
    } catch (IOException | InterruptedException e) {
      if (e instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      throw new IllegalStateException("Error deleting Fuseki dataset '" + datasetName + "'", e);
    }
  }

  @Override
  public boolean datasetExists(String datasetName) {
    DatasetEndpoint info = requireServerInfo("datasetExists");
    try {
      HttpResponse<String> response =
          sendAdminRequest(
              info.serverBaseUrl() + "/$/datasets/" + encodePathSegment(datasetName),
              HttpRequest.Builder::GET,
              info.userInfo());
      return response.statusCode() == 200;
    } catch (IOException | InterruptedException e) {
      if (e instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      throw new IllegalStateException("Error checking Fuseki dataset '" + datasetName + "'", e);
    }
  }

  private DatasetEndpoint requireServerInfo(String operation) {
    DatasetEndpoint info = parseDatasetEndpoint(endpoint);
    if (info == null) {
      throw new IllegalStateException(
          "Cannot " + operation + ": unparseable RDF endpoint " + maskUserInfo(endpoint));
    }
    return info;
  }

  private HttpResponse<String> sendAdminRequest(
      String url, UnaryOperator<HttpRequest.Builder> method, String endpointUserInfo)
      throws IOException, InterruptedException {
    HttpClient httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
    HttpRequest.Builder builder = method.apply(HttpRequest.newBuilder().uri(URI.create(url)));
    addBasicAuth(builder, username, password, endpointUserInfo);
    return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }

  private void loadOntology() {
    try {
      String checkQuery = String.format("ASK { GRAPH <%s> { ?s ?p ?o } }", METADATA_GRAPH);
      boolean ontologyExists = false;

      try (QueryExecution qe = connection.query(checkQuery)) {
        ontologyExists = qe.execAsk();
      } catch (Exception e) {
        LOG.debug("Could not check if ontology exists, will attempt to load", e);
      }

      if (ontologyExists) {
        LOG.info("OpenMetadata ontology already exists in Fuseki");
        return;
      }

      Model ontologyModel = ModelFactory.createDefaultModel();
      RDFDataMgr.read(
          ontologyModel,
          Objects.requireNonNull(getClass().getResourceAsStream("/rdf/ontology/openmetadata.ttl")),
          org.apache.jena.riot.Lang.TURTLE);

      runWriteWithTimeout(() -> connection.load(METADATA_GRAPH, ontologyModel), "loadOntology");
      LOG.info("Loaded OpenMetadata ontology to Fuseki");
    } catch (Exception e) {
      LOG.error("Failed to load ontology to Fuseki", e);
    }
  }

  private boolean isCircuitOpen() {
    return System.currentTimeMillis() < circuitOpenUntilMs.get();
  }

  private void throwIfCircuitOpen(String operation) {
    if (isCircuitOpen()) {
      throw new RdfStorageCircuitOpenException(operation);
    }
  }

  private void recordSuccess() {
    consecutiveFailures.set(0);
    circuitOpenUntilMs.set(0L);
  }

  private void recordFailure() {
    int failures = consecutiveFailures.incrementAndGet();
    if (failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      long until = System.currentTimeMillis() + CIRCUIT_BREAKER_COOLDOWN_MS;
      if (circuitOpenUntilMs.getAndSet(until) < until) {
        LOG.warn(
            "RDF circuit breaker tripped after {} consecutive failures; "
                + "short-circuiting writes for {} ms",
            failures,
            CIRCUIT_BREAKER_COOLDOWN_MS);
      }
    }
  }

  static boolean isCircuitBreakerFailure(Throwable t) {
    return isConnectError(t) || isTimeoutError(t) || isServerError(t);
  }

  // Only gateway/availability 5xx (502/503/504) indicate Fuseki itself is
  // unhealthy and should count toward the shared breaker. A bare 500 is often a
  // per-request failure (e.g. an expensive SPARQL SELECT that exceeds a server
  // limit) — tripping the breaker on those would let one heavy graph query
  // short-circuit ALL RDF traffic. Client errors (4xx) are the caller's fault
  // and must never trip it either.
  private static boolean isServerError(Throwable t) {
    Throwable cause = t;
    boolean result = false;
    while (cause != null && !result) {
      if (cause instanceof HttpException httpException) {
        int code = httpException.getStatusCode();
        result = code == 502 || code == 503 || code == 504;
      }
      Throwable next = cause.getCause();
      cause = (next == cause) ? null : next;
    }
    return result;
  }

  private static boolean isConnectError(Throwable t) {
    Throwable cause = t;
    while (cause != null) {
      if (cause instanceof ConnectException
          || cause instanceof ClosedChannelException
          || cause instanceof HttpConnectTimeoutException) {
        return true;
      }
      Throwable next = cause.getCause();
      if (next == cause) {
        return false;
      }
      cause = next;
    }
    return false;
  }

  private static boolean isTimeoutError(Throwable t) {
    Throwable cause = t;
    while (cause != null) {
      if (cause instanceof TimeoutException
          || cause instanceof HttpTimeoutException
          || cause instanceof SocketTimeoutException) {
        return true;
      }
      Throwable next = cause.getCause();
      if (next == cause) {
        return false;
      }
      cause = next;
    }
    return false;
  }

  private void runWriteWithRetry(final Runnable operation, final String description) {
    RdfWriteRetry.run(
        remainingMillis -> runWriteWithTimeout(operation, description, remainingMillis),
        description,
        new RdfWriteRetry.Policy(
            writeMaxRetries, writeRetryInitialBackoffMs, writeRetryMaxBackoffMs, requestTimeoutMs),
        new RdfWriteRetry.Circuit(
            () -> throwIfCircuitOpen(description),
            this::recordSuccess,
            this::recordFailure,
            this::isCircuitOpen),
        retryDelayMs);
  }

  private static void sleepRetryDelay(long waitTime) {
    try {
      Thread.sleep(waitTime);
    } catch (InterruptedException ie) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("Interrupted while retrying RDF write", ie);
    }
  }

  private <T> T runWithTimeout(Supplier<T> op, String description) {
    return runWithTimeout(op, description, requestTimeoutMs);
  }

  private <T> T runWithTimeout(Supplier<T> op, String description, long timeoutMillis) {
    long startNanos = System.nanoTime();
    Future<T> future = TIMEOUT_EXECUTOR.submit(op::get);
    try {
      T result = future.get(timeoutMillis, TimeUnit.MILLISECONDS);
      recordRequestMetrics(description, startNanos, REQUEST_OUTCOME_SUCCESS);
      return result;
    } catch (TimeoutException te) {
      // Cancellation interrupts work that is still queued for the writer. An active Jena HTTP
      // call may ignore interruption and therefore keeps the writer permit until it really exits.
      future.cancel(true);
      recordRequestMetrics(description, startNanos, REQUEST_OUTCOME_TIMEOUT);
      Metrics.counter(METRIC_FUSEKI_TIMEOUTS, TAG_OPERATION, description).increment();
      throw new RuntimeException(description + " timed out after " + timeoutMillis + "ms", te);
    } catch (ExecutionException ee) {
      recordRequestMetrics(description, startNanos, REQUEST_OUTCOME_ERROR);
      Throwable cause = ee.getCause() != null ? ee.getCause() : ee;
      if (cause instanceof RuntimeException re) {
        throw re;
      }
      throw new RuntimeException(description + " failed", cause);
    } catch (InterruptedException ie) {
      future.cancel(true);
      Thread.currentThread().interrupt();
      recordRequestMetrics(description, startNanos, REQUEST_OUTCOME_ERROR);
      throw new RuntimeException(description + " interrupted", ie);
    }
  }

  /**
   * Every Fuseki round trip flows through runWithTimeout, so this is the one spot that can answer
   * "where does the time go" — the 164-hour production incident was invisible precisely because
   * no pipeline stat measured the storage round trip. The WARN threshold surfaces individual slow
   * requests with their operation name; the timer feeds dashboards/alerts.
   */
  private void recordRequestMetrics(String description, long startNanos, String outcome) {
    long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
    Metrics.timer(METRIC_FUSEKI_REQUEST, TAG_OPERATION, description, TAG_OUTCOME, outcome)
        .record(elapsedMs, TimeUnit.MILLISECONDS);
    if (elapsedMs >= SLOW_REQUEST_WARN_THRESHOLD_MS) {
      LOG.warn(
          "Slow RDF request {}: {} ms (outcome={}, timeout budget {} ms)",
          description,
          elapsedMs,
          outcome,
          requestTimeoutMs);
    }
  }

  private void runWithTimeout(Runnable op, String description) {
    runWithTimeout(
        () -> {
          op.run();
          return null;
        },
        description);
  }

  void runWriteWithTimeout(Runnable op, String description) {
    runWriteWithTimeout(op, description, requestTimeoutMs);
  }

  private void runWriteWithTimeout(Runnable op, String description, long timeoutMillis) {
    try {
      runWithTimeout(
          () -> {
            long queuedAt = System.nanoTime();
            boolean acquired = false;
            try {
              writePermit.acquire();
              acquired = true;
              Metrics.timer(METRIC_FUSEKI_WRITER_WAIT, TAG_OPERATION, description)
                  .record(System.nanoTime() - queuedAt, TimeUnit.NANOSECONDS);
              op.run();
              return null;
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
              throw new RuntimeException("Interrupted while waiting for the RDF writer", e);
            } finally {
              if (acquired) {
                writePermit.release();
              }
            }
          },
          description,
          timeoutMillis);
    } catch (RuntimeException exception) {
      if (RdfWriteRetry.isUncertain(exception)) {
        throw new RdfWriteOutcomeUnknownException(description, exception);
      }
      throw exception;
    }
  }

  // Union the translator's static "always managed" predicates with whatever
  // predicates the current model actually emits for this entity. The static
  // set covers shrink-to-empty cases (e.g. all tags removed -> current model
  // no longer emits om:hasTag, but we still need to clean up the old triples).
  // The dynamic walk covers translator-only predicates introduced via the
  // JSON-LD context that aren't in the static set. CRITICAL: exclude
  // RELATIONSHIP_HOOK_PREDICATES from the dynamic-walk result. Callers like
  // RdfRepository.addRelationship load the existing entity model from Fuseki
  // (which includes hook-managed predicates like om:owns / om:contains) and
  // pass it here; without this exclusion the dynamic walk would pull those
  // hook predicates into the DELETE scope and the subsequent INSERT would
  // overwrite them with a possibly-stale snapshot, opening a lost-update
  // race window with concurrent async relationship writes.
  private static Set<String> collectTranslatorPredicates(String entityUri, Model entityModel) {
    Set<String> predicates =
        new LinkedHashSet<>(RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES);
    Resource entityResource = entityModel.createResource(entityUri);
    StmtIterator stmts = entityModel.listStatements(entityResource, null, (RDFNode) null);
    while (stmts.hasNext()) {
      String predicateUri = stmts.next().getPredicate().getURI();
      if (RdfRepository.RELATIONSHIP_HOOK_PREDICATES.contains(predicateUri)) {
        continue;
      }
      predicates.add(predicateUri);
    }
    // Defensive belt-and-braces in case a future change adds a hook predicate
    // to the static set: filter the static set the same way.
    predicates.removeAll(RdfRepository.RELATIONSHIP_HOOK_PREDICATES);
    return predicates;
  }

  private static String buildPredicateScopedDelete(String entityUri, Set<String> predicates) {
    // ONE operation, not two. Everything this must remove is expressed as a single filter:
    //
    //   !isIRI(?o)      literal-/blank-node-valued triples, whatever the predicate. Predicates
    //                   that emit literals (description, displayName, name, ...) may SHRINK TO
    //                   EMPTY between writes - the new translator output simply omits the triple -
    //                   and the old literal would persist unless swept here.
    //   ?p IN (...)     URI-valued triples for predicates the translator owns, so its fresh output
    //                   replaces the prior values. Hook-managed URI predicates, including
    //                   om:upstream, om:downstream, om:owns and om:contains, survive.
    //
    // The two used to be separate DELETE...WHERE operations chained with ';'. They cannot be:
    // Fuseki rejects an update request carrying more than one WHERE-bearing operation with
    // "400 Bad Request" (logged server-side as "Bad request: null") whenever arq:updateTimeout
    // is configured, because the timeout controller governs a single execution per request.
    // Operations without a WHERE (INSERT DATA) are unaffected and may still be chained.
    // Merging is exactly equivalent - !isIRI(?o) || (isIRI(?o) && ?p IN (P)) reduces to
    // !isIRI(?o) || ?p IN (P) - and it scans the entity's triples once instead of twice.
    return buildPredicateScopedDelete(Set.of(entityUri), predicates);
  }

  private static String buildPredicateScopedDelete(Set<String> entityUris, Set<String> predicates) {
    if (entityUris.isEmpty()) {
      return "";
    }
    String filter =
        predicates.isEmpty() ? "!isIRI(?o)" : "!isIRI(?o) || ?p IN (" + iriList(predicates) + ")";
    return String.format(
        "DELETE { GRAPH <%1$s> { ?subject ?p ?o } } WHERE { GRAPH <%1$s> { "
            + "VALUES ?entity { %2$s } "
            + "{ ?entity ?p ?o . BIND(?entity AS ?subject) FILTER(%3$s) } UNION { %4$s } } }",
        KNOWLEDGE_GRAPH, iriValues(entityUris), filter, RdfOwnedResources.ownedTriplesPattern());
  }

  private static String iriList(Set<String> predicates) {
    StringBuilder list = new StringBuilder();
    for (String predicate : predicates) {
      if (!list.isEmpty()) {
        list.append(", ");
      }
      list.append('<').append(predicate).append('>');
    }
    return list.toString();
  }

  private static String iriValues(Iterable<String> iris) {
    StringBuilder values = new StringBuilder();
    for (String iri : iris) {
      if (!values.isEmpty()) {
        values.append(' ');
      }
      values.append('<').append(iri).append('>');
    }
    return values.toString();
  }

  static String buildEntityUpsertUpdate(String entityUri, Model entityModel) {
    return buildEntityUpsertUpdate(entityUri, entityModel, RdfWriteMode.RECONCILE);
  }

  static String buildEntityUpsertUpdate(
      String entityUri, Model entityModel, RdfWriteMode writeMode) {
    String triples = serializeModel(entityModel);
    if (writeMode == RdfWriteMode.INSERT_ONLY) {
      return triples.isBlank() ? "" : buildInsertData(triples);
    }
    Set<String> predicatesToDelete = collectTranslatorPredicates(entityUri, entityModel);
    String deleteQuery = buildPredicateScopedDelete(entityUri, predicatesToDelete);
    if (triples.isBlank()) {
      return deleteQuery;
    }
    return deleteQuery + ";\n" + buildInsertData(triples);
  }

  private static String serializeModel(Model model) {
    StringWriter writer = new StringWriter();
    model.write(writer, "N-TRIPLES");
    return writer.toString();
  }

  private static String buildInsertData(String triples) {
    return "INSERT DATA { GRAPH <" + KNOWLEDGE_GRAPH + "> { " + triples + " } }";
  }

  /**
   * Bulk variant: one request per repository chunk, in a SINGLE transaction at the Fuseki side,
   * with a hard payload-size guard.
   *
   * <p>Transport differs by write mode. RECONCILE embeds one VALUES-scoped DELETE and the unioned
   * N-Triples in one multi-operation SPARQL UPDATE — Fuseki runs it in one
   * transaction, so the delete/insert pair can never half-apply. INSERT_ONLY has no DELETE side, so
   * it appends via the Graph Store Protocol instead ({@link #bulkAppendEntities}) — Fuseki parses
   * the streamed body with the RIOT parser rather than the SPARQL grammar, which is materially
   * cheaper for multi-MB payloads, and one GSP POST is still one transaction.
   *
   * <p>Payload guard: repository chunks are budgeted by estimated triple size, but DELETE
   * statements and long literals can push the serialized body past the estimate. RECONCILE chunks
   * that serialize above {@code maxUpdatePayloadBytes} are split in half and retried recursively —
   * one oversized request is what turns a slow Fuseki into a timeout-retry spiral. A single entity
   * above the cap is still sent alone (never dropped), with a WARN.
   */
  @Override
  public void bulkStoreEntities(List<EntityWriteRequest> requests) {
    bulkStoreEntities(requests, RdfWriteMode.RECONCILE);
  }

  @Override
  public void bulkStoreEntities(List<EntityWriteRequest> requests, RdfWriteMode writeMode) {
    bulkStoreEntities(requests, writeMode, maxAppendPayloadBytes);
  }

  @Override
  public void bulkStoreEntities(
      List<EntityWriteRequest> requests, RdfWriteMode writeMode, long appendBudget) {
    if (requests == null || requests.isEmpty()) {
      return;
    }
    throwIfCircuitOpen("bulkStoreEntities");
    if (writeMode == RdfWriteMode.INSERT_ONLY) {
      bulkAppendEntities(
          requests,
          appendBudget > 0 ? Math.min(maxAppendPayloadBytes, appendBudget) : maxAppendPayloadBytes);
    } else {
      bulkReconcileEntities(requests);
    }
  }

  private void bulkReconcileEntities(List<EntityWriteRequest> requests) {
    writeWithPayloadGuard(
        requests,
        chunk -> buildBulkReconcileUpdate(baseUri, chunk),
        maxUpdatePayloadBytes,
        this::executeReconcileUpdate,
        oversized ->
            LOG.warn(
                "Single entity {}/{} serializes above maxUpdatePayloadBytes={}; sending alone",
                oversized.entityType(),
                oversized.entityId(),
                maxUpdatePayloadBytes));
  }

  /**
   * Recursive halving guard applied AFTER serialization, where the true payload size is known.
   * Splitting re-unions each half's models before serializing again — per-entity N-Triples
   * fragments cannot simply be concatenated because blank-node labels are scoped to one
   * serialization. Count UTF-8 bytes because Jena preserves Unicode literals in N-Triples.
   */
  static void writeWithPayloadGuard(
      List<EntityWriteRequest> requests,
      Function<List<EntityWriteRequest>, String> updateBuilder,
      int maxPayloadBytes,
      BiConsumer<String, List<EntityWriteRequest>> executor,
      Consumer<EntityWriteRequest> oversizedSingleLogger) {
    String update = updateBuilder.apply(requests);
    boolean overCap = Utf8.encodedLength(update) > maxPayloadBytes;
    if (overCap && requests.size() > 1) {
      int mid = requests.size() / 2;
      writeWithPayloadGuard(
          requests.subList(0, mid),
          updateBuilder,
          maxPayloadBytes,
          executor,
          oversizedSingleLogger);
      writeWithPayloadGuard(
          requests.subList(mid, requests.size()),
          updateBuilder,
          maxPayloadBytes,
          executor,
          oversizedSingleLogger);
    } else if (!update.isEmpty()) {
      if (overCap) {
        oversizedSingleLogger.accept(requests.getFirst());
      }
      executor.accept(update, requests);
    }
  }

  static String buildBulkReconcileUpdate(String baseUri, List<EntityWriteRequest> requests) {
    Set<String> entityUris = new LinkedHashSet<>();
    Set<String> predicatesToDelete = new LinkedHashSet<>();
    Model combinedModel = ModelFactory.createDefaultModel();
    for (EntityWriteRequest req : requests) {
      String entityUri = baseUri + "entity/" + req.entityType() + "/" + req.entityId();
      entityUris.add(entityUri);
      predicatesToDelete.addAll(collectTranslatorPredicates(entityUri, req.model()));
      combinedModel.add(req.model());
    }
    String triples = serializeModel(combinedModel);
    combinedModel.close();
    StringBuilder combined =
        new StringBuilder(buildPredicateScopedDelete(entityUris, predicatesToDelete));
    if (!triples.isBlank()) {
      if (!combined.isEmpty()) {
        combined.append(";\n");
      }
      combined.append(buildInsertData(triples));
    }
    return combined.toString();
  }

  private void executeReconcileUpdate(String update, List<EntityWriteRequest> requests) {
    try {
      Metrics.summary(METRIC_FUSEKI_PAYLOAD_BYTES, TAG_OPERATION, "bulkStoreEntities")
          .record(Utf8.encodedLength(update));
      UpdateRequest updateRequest = UpdateFactory.create(update);
      runWriteWithRetry(() -> connection.update(updateRequest), "bulkStoreEntities");
      // DEBUG, not INFO: this fires per-batch in a hot reindex loop (default
      // batchSize=100 → tens of thousands of log lines on a real reindex).
      // Keep INFO reserved for events ops actually want to grep for.
      LOG.debug("Bulk-reconciled {} entities in {}", requests.size(), KNOWLEDGE_GRAPH);
    } catch (Exception e) {
      LOG.error("Failed to bulk-store {} entities in Fuseki", requests.size(), e);
      throw new RuntimeException("Failed to bulk-store entities in RDF", e);
    }
  }

  /** Serialize complete, bounded RDF without constructing a combined model or a body string. */
  private void bulkAppendEntities(final List<EntityWriteRequest> requests, final long budget) {
    if (requests.stream().allMatch(request -> request.model().isEmpty())) {
      return;
    }
    final FusekiWriteCapabilities capabilities = writeCapabilities();
    runWriteWithRetry(() -> appendPayload(requests, budget, capabilities), "bulkAppendEntities");
  }

  private void appendPayload(
      final List<EntityWriteRequest> requests,
      final long budget,
      final FusekiWriteCapabilities capabilities) {
    try (SerializedRdfPayload payload =
        SerializedRdfPayload.prepare(
            requests, gzipRequests, Math.min(budget, capabilities.maxBytes()))) {
      Metrics.summary(METRIC_FUSEKI_PAYLOAD_BYTES, TAG_OPERATION, "bulkAppendEntities")
          .record(payload.bytes());
      if (streamingAppendEnabled) {
        upload(payload, capabilities);
      } else {
        appendViaLibraryUpload(requests);
      }
    } catch (IOException exception) {
      throw new UncheckedIOException("Unable to stage RDF append", exception);
    }
  }

  private void appendViaLibraryUpload(final List<EntityWriteRequest> requests) {
    final Model combined = ModelFactory.createDefaultModel();
    try {
      requests.forEach(request -> combined.add(request.model()));
      connection.load(KNOWLEDGE_GRAPH, combined);
    } finally {
      combined.close();
    }
  }

  private void upload(
      final SerializedRdfPayload payload, final FusekiWriteCapabilities capabilities) {
    final DatasetEndpoint info = requireServerInfo("append");
    final String url =
        info.serverBaseUrl()
            + "/"
            + encodePathSegment(info.datasetName())
            + "/data?graph="
            + URLEncoder.encode(KNOWLEDGE_GRAPH, StandardCharsets.UTF_8);
    try {
      final HttpRequest.Builder request =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .timeout(Duration.ofMillis(requestTimeoutMs))
              .header(HEADER_CONTENT_TYPE, CONTENT_TYPE_RDF_THRIFT)
              .header(
                  FusekiWriteCapabilities.DEADLINE,
                  Long.toString(
                      Math.min(
                          capabilities.timeoutMillis(), Math.max(1, requestTimeoutMs * 4 / 5))))
              .POST(HttpRequest.BodyPublishers.ofFile(payload.path()));
      if (gzipRequests) {
        request.header(HEADER_CONTENT_ENCODING, ENCODING_GZIP);
      }
      addBasicAuth(request, username, password);
      final HttpResponse<String> response =
          streamingHttpClient.send(request.build(), HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        throw new HttpException(response.statusCode(), "GSP append failed", response.body());
      }
    } catch (IOException exception) {
      throw new RdfWriteOutcomeUnknownException("Graph Store append", exception);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new RdfWriteOutcomeUnknownException("Graph Store append", exception);
    }
  }

  @Override
  public OptionalLong fetchServerMaxHeapBytes() {
    OptionalLong result = OptionalLong.empty();
    DatasetEndpoint info = parseDatasetEndpoint(endpoint);
    if (info != null) {
      try {
        HttpRequest.Builder requestBuilder =
            HttpRequest.newBuilder()
                .uri(URI.create(info.serverBaseUrl() + "/$/metrics"))
                .timeout(Duration.ofMillis(requestTimeoutMs))
                .GET();
        addBasicAuth(requestBuilder, username, password, info.userInfo());
        HttpResponse<String> response =
            streamingHttpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 200) {
          result = parseJvmMaxHeapBytes(response.body());
        }
      } catch (IOException e) {
        LOG.debug("Fuseki metrics endpoint unreachable: {}", e.getMessage());
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    return result;
  }

  /**
   * Sums {@code jvm_memory_max_bytes{area="heap",...}} samples from Prometheus text exposition.
   * Pools reporting -1 (unbounded) are skipped.
   */
  static OptionalLong parseJvmMaxHeapBytes(String prometheusText) {
    double totalBytes = 0;
    boolean found = false;
    for (String line : prometheusText.split("\n")) {
      if (line.startsWith("jvm_memory_max_bytes") && line.contains("area=\"heap\"")) {
        double value = parseSampleValue(line);
        if (value > 0) {
          totalBytes += value;
          found = true;
        }
      }
    }
    return found ? OptionalLong.of((long) totalBytes) : OptionalLong.empty();
  }

  private static double parseSampleValue(String prometheusLine) {
    double result = -1;
    int lastSpace = prometheusLine.lastIndexOf(' ');
    if (lastSpace > 0) {
      try {
        result = Double.parseDouble(prometheusLine.substring(lastSpace + 1).trim());
      } catch (NumberFormatException e) {
        LOG.debug("Skipping unparsable metrics line: {}", prometheusLine);
      }
    }
    return result;
  }

  @Override
  public void storeEntity(String entityType, UUID entityId, Model entityModel) {
    throwIfCircuitOpen("storeEntity");
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;
    // Scope the DELETE to predicates the translator owns. The previous
    // FILTER(!isIRI(?o)) preserved EVERY URI object, which let stale
    // translator-emitted triples (old om:hasOwner, removed om:hasTag, etc.)
    // accumulate across updates because no hook ever cleans them up — owner /
    // tag / glossary-term URIs aren't in entity_relationship. Predicate
    // scoping lets the translator's fresh output replace the prior values,
    // while hook-managed predicates (om:upstream/om:downstream, om:hasLineageDetails,
    // om:owns / om:contains / …) are untouched so relationship and lineage
    // state survives a metadata-only update.
    //
    // The set we delete is the union of:
    //  - RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES (covers the
    //    shrink-to-empty case where a field is now absent and the new model
    //    no longer emits its predicate), and
    //  - the predicates the current model actually emits for <entityUri>
    //    (covers translator-only predicates introduced via the JSON-LD
    //    context that aren't in the static set).
    String upsertQuery = buildEntityUpsertUpdate(entityUri, entityModel);
    try {
      UpdateRequest request = UpdateFactory.create(upsertQuery);
      runWriteWithRetry(() -> connection.update(request), "storeEntity");
      LOG.debug("Stored entity {} in graph {}", entityId, KNOWLEDGE_GRAPH);
    } catch (Exception e) {
      LOG.error("Failed to store entity in Fuseki", e);
      throw new RuntimeException("Failed to store entity in RDF", e);
    }
  }

  @Override
  public void storeRelationship(
      String fromType, UUID fromId, String toType, UUID toId, String relationshipType) {
    throwIfCircuitOpen("storeRelationship");

    // Use DELETE/INSERT pattern for idempotency - deletes existing triple before inserting
    String deleteInsertQuery =
        String.format(
            "PREFIX om: <%sontology/> "
                + "DELETE DATA { "
                + "  GRAPH <%s> { "
                + "    <%sentity/%s/%s> om:%s <%sentity/%s/%s> . "
                + "  } "
                + "}; "
                + "INSERT DATA { "
                + "  GRAPH <%s> { "
                + "    <%sentity/%s/%s> om:%s <%sentity/%s/%s> . "
                + "  } "
                + "}",
            baseUri,
            KNOWLEDGE_GRAPH,
            baseUri,
            fromType,
            fromId,
            relationshipType,
            baseUri,
            toType,
            toId,
            KNOWLEDGE_GRAPH,
            baseUri,
            fromType,
            fromId,
            relationshipType,
            baseUri,
            toType,
            toId);

    try {
      LOG.debug("SPARQL Update Query: {}", deleteInsertQuery);
      UpdateRequest request = UpdateFactory.create(deleteInsertQuery);
      runWriteWithRetry(() -> connection.update(request), "storeRelationship");
      LOG.debug("Stored relationship (idempotent): {} -{}- {}", fromId, relationshipType, toId);
    } catch (Exception e) {
      LOG.error("Failed to store relationship in Fuseki", e);
      throw new RuntimeException("Failed to store relationship in RDF", e);
    }
  }

  @Override
  public String buildEntityUri(String entityType, String entityId) {
    return baseUri + "entity/" + entityType + "/" + entityId;
  }

  @Override
  public void bulkStoreRelationships(
      List<RelationshipData> relationships, Set<String> sourcesToReconcile) {
    if (relationships.isEmpty() && (sourcesToReconcile == null || sourcesToReconcile.isEmpty())) {
      return;
    }
    throwIfCircuitOpen("bulkStoreRelationships");
    // Normalise to an empty set once so the per-source DELETE loop is safe
    // regardless of caller. The early-return above already handles the
    // null+empty-relationships case; this guards a caller that passes null
    // with a non-empty relationships list (insert-only, no reconcile).
    Set<String> effectiveSources = sourcesToReconcile != null ? sourcesToReconcile : Set.of();

    String combined = buildBulkRelationshipUpdate(baseUri, relationships, effectiveSources);

    try {
      UpdateRequest request = UpdateFactory.create(combined);
      runWriteWithRetry(() -> connection.update(request), "bulkStoreRelationships");
      LOG.debug(
          "Bulk stored {} relationships, reconciled {} source entities",
          relationships.size(),
          effectiveSources.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk store relationships in Fuseki", e);
      throw new RuntimeException("Failed to bulk store relationships in RDF", e);
    }
  }

  static String buildBulkRelationshipUpdate(
      String baseUri, List<RelationshipData> relationships, Set<String> sourcesToReconcile) {
    String deleteUpdate = RdfRepository.buildOutgoingRelationshipDelete(sourcesToReconcile);
    StringBuilder combined = new StringBuilder(deleteUpdate);
    if (!relationships.isEmpty()) {
      if (!combined.isEmpty()) {
        combined.append("; ");
      }
      combined.append("INSERT DATA { GRAPH <").append(KNOWLEDGE_GRAPH).append("> { ");
      for (RelationshipData relationship : relationships) {
        String predicateUri =
            relationship.getPredicateUri() != null
                ? relationship.getPredicateUri()
                : baseUri + "ontology/" + relationship.getRelationshipType();
        combined.append(
            String.format(
                "<%sentity/%s/%s> <%s> <%sentity/%s/%s> . ",
                baseUri,
                relationship.getFromType(),
                relationship.getFromId(),
                predicateUri,
                baseUri,
                relationship.getToType(),
                relationship.getToId()));
      }
      combined.append("} }");
    }
    return combined.toString();
  }

  @Override
  public Model getEntity(String entityType, UUID entityId) {
    if (isCircuitOpen()) {
      return null;
    }
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;

    String query =
        String.format(
            "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <%s> { <%s> ?p ?o . BIND(<%s> as ?s) } }",
            KNOWLEDGE_GRAPH, entityUri, entityUri);

    try {
      Query q = QueryFactory.create(query);
      Model result =
          runWithTimeout(
              () -> {
                try (QueryExecution qexec = connection.query(q)) {
                  return qexec.execConstruct();
                }
              },
              "getEntity");
      recordSuccess();
      return result.isEmpty() ? null : result;
    } catch (Exception e) {
      LOG.error("Failed to get entity from Fuseki", e);
      if (isCircuitBreakerFailure(e)) {
        recordFailure();
      }
      return null;
    }
  }

  @Override
  public void deleteEntity(String entityType, UUID entityId) {
    throwIfCircuitOpen("deleteEntity");
    String entityUri = baseUri + "entity/" + entityType + "/" + entityId;

    String deleteQuery = RdfRepository.buildEntityDeleteUpdate(entityUri);

    try {
      UpdateRequest request = UpdateFactory.create(deleteQuery);
      runWriteWithTimeout(() -> connection.update(request), "deleteEntity");
      LOG.debug("Deleted entity {} from Fuseki", entityId);
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to delete entity from Fuseki", e);
      if (isCircuitBreakerFailure(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to delete entity from RDF", e);
    }
  }

  @Override
  public String executeSparqlQuery(String sparqlQuery, String format) {
    throwIfCircuitOpen("executeSparqlQuery");
    try {
      String result =
          runWithTimeout(() -> doExecuteSparqlQuery(sparqlQuery, format), "executeSparqlQuery");
      recordSuccess();
      return result;
    } catch (Exception e) {
      LOG.error("Failed to execute SPARQL query on Fuseki", e);
      if (isCircuitBreakerFailure(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to execute SPARQL query", e);
    }
  }

  private String doExecuteSparqlQuery(String sparqlQuery, String format) {
    Query query = QueryFactory.create(sparqlQuery);

    if (query.isSelectType()) {
      try (QueryExecution qexec = connection.query(query)) {
        ResultSet results = qexec.execSelect();

        switch (format.toLowerCase()) {
          case "json":
          case "application/json":
          case "application/sparql-results+json":
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ResultSetFormatter.outputAsJSON(out, results);
            return out.toString();
          case "xml":
          case "application/xml":
          case "application/sparql-results+xml":
            return ResultSetFormatter.asXMLString(results);
          case "csv":
          case "text/csv":
            ByteArrayOutputStream csvOut = new ByteArrayOutputStream();
            ResultSetFormatter.outputAsCSV(csvOut, results);
            return csvOut.toString();
          default:
            return ResultSetFormatter.asText(results);
        }
      }
    } else if (query.isConstructType()) {
      try (QueryExecution qexec = connection.query(query)) {
        return formatModel(qexec.execConstruct(), format);
      }
    } else if (query.isAskType()) {
      try (QueryExecution qexec = connection.query(query)) {
        boolean result = qexec.execAsk();
        LOG.info("ASK query result: {}", result);
        return "{\"head\": {}, \"boolean\": " + result + "}";
      }
    } else if (query.isDescribeType()) {
      try (QueryExecution qexec = connection.query(query)) {
        return formatModel(qexec.execDescribe(), format);
      }
    }

    return "Unsupported query type";
  }

  private String formatModel(Model model, String format) {
    StringWriter writer = new StringWriter();
    RDFDataMgr.write(writer, model, resolveGraphFormat(format));
    return writer.toString();
  }

  /**
   * Resolves a CONSTRUCT/DESCRIBE serialization, accepting short names and media types alike.
   *
   * <p>The previous chain compared against the short names only, so every caller passing a media
   * type - {@code EntityNeighborhoodTool} asks for {@code text/turtle}, {@code OntologyDescribeTool}
   * passes {@code format.mediaType()} - silently landed on the RDF/XML fallback while the surrounding
   * response still advertised {@code "format":"turtle"}. Callers got XML labelled as Turtle, which is
   * worse than an outright failure because it parses cleanly as the wrong thing. An unrecognised
   * value still falls back to RDF/XML rather than throwing, but it is logged instead of passing
   * silently.
   */
  private static RDFFormat resolveGraphFormat(String format) {
    try {
      return RdfSerializationFormat.parseOrDefault(format, RdfSerializationFormat.RDF_XML)
          .rdfFormat();
    } catch (IllegalArgumentException exception) {
      LOG.warn("Unrecognised RDF serialization '{}'; falling back to RDF/XML", format);
      return RDFFormat.RDFXML;
    }
  }

  @Override
  public void executeSparqlUpdate(String sparqlUpdate) {
    throwIfCircuitOpen("executeSparqlUpdate");
    try {
      UpdateRequest request = UpdateFactory.create(sparqlUpdate);
      runWriteWithTimeout(() -> connection.update(request), "executeSparqlUpdate");
      LOG.debug("Executed SPARQL update on Fuseki");
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to execute SPARQL update on Fuseki", e);
      if (isCircuitBreakerFailure(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to execute SPARQL update", e);
    }
  }

  @Override
  public void loadTurtleFile(java.io.InputStream turtleStream, String graphUri) {
    throwIfCircuitOpen("loadTurtleFile");
    try {
      Model model = ModelFactory.createDefaultModel();
      model.read(turtleStream, null, "TURTLE");
      runWriteWithTimeout(
          () -> {
            try {
              connection.delete(graphUri);
            } catch (HttpException e) {
              if (e.getStatusCode() != 404) {
                throw e;
              }
            }
            connection.load(graphUri, model);
          },
          "loadTurtleFile");

      LOG.info("Loaded Turtle file into graph {} with {} triples", graphUri, model.size());
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to load Turtle file into Fuseki", e);
      if (isCircuitBreakerFailure(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to load Turtle file", e);
    }
  }

  @Override
  public List<String> getAllGraphs() {
    throwIfCircuitOpen("getAllGraphs");
    String query = "SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } }";
    List<String> graphs = new ArrayList<>();

    try (QueryExecution qexec = connection.query(query)) {
      ResultSet results = qexec.execSelect();
      results.forEachRemaining(
          qs -> {
            String graphUri = qs.getResource("g").getURI();
            graphs.add(graphUri);
          });
      recordSuccess();
    } catch (Exception e) {
      if (isCircuitBreakerFailure(e)) {
        recordFailure();
      }
      throw e;
    }

    return graphs;
  }

  @Override
  public long getTripleCount() {
    throwIfCircuitOpen("getTripleCount");
    String query = "SELECT (COUNT(*) as ?count) WHERE { GRAPH ?g { ?s ?p ?o } }";

    try (QueryExecution qexec = connection.query(query)) {
      ResultSet results = qexec.execSelect();
      recordSuccess();
      if (results.hasNext()) {
        return results.next().getLiteral("count").getLong();
      }
    } catch (Exception e) {
      if (isCircuitBreakerFailure(e)) {
        recordFailure();
      }
      throw e;
    }

    return 0;
  }

  @Override
  public long getTripleCount(final String graphUri) {
    throwIfCircuitOpen("getTripleCount");
    final Query query = graphTripleCountQuery(graphUri);
    long tripleCount = 0;
    try (QueryExecution queryExecution = connection.query(query)) {
      final ResultSet results = queryExecution.execSelect();
      if (results.hasNext()) {
        tripleCount = results.next().getLiteral("count").getLong();
      }
      recordSuccess();
    } catch (RuntimeException exception) {
      if (isCircuitBreakerFailure(exception)) {
        recordFailure();
      }
      throw exception;
    }
    return tripleCount;
  }

  static Query graphTripleCountQuery(final String graphUri) {
    final URI validatedGraphUri = requireAbsoluteGraphUri(graphUri);
    final ParameterizedSparqlString query = new ParameterizedSparqlString(GRAPH_TRIPLE_COUNT_QUERY);
    query.setIri("graph", validatedGraphUri.toASCIIString());
    return query.asQuery();
  }

  private static URI requireAbsoluteGraphUri(final String graphUri) {
    if (nullOrEmpty(graphUri) || graphUri.isBlank()) {
      throw new IllegalArgumentException("graphUri must be a valid absolute IRI");
    }
    try {
      final URI uri = URI.create(graphUri);
      if (!uri.isAbsolute()) {
        throw new IllegalArgumentException("graphUri must be a valid absolute IRI");
      }
      return uri;
    } catch (IllegalArgumentException exception) {
      throw new IllegalArgumentException("graphUri must be a valid absolute IRI", exception);
    }
  }

  @Override
  public void clearGraph(String graphUri) {
    throwIfCircuitOpen("clearGraph");
    try {
      final ParameterizedSparqlString update =
          new ParameterizedSparqlString("CLEAR SILENT GRAPH ?graph");
      update.setIri("graph", requireAbsoluteGraphUri(graphUri).toASCIIString());
      runWriteWithRetry(() -> connection.update(update.asUpdate()), "clearGraph");
      LOG.info("Cleared graph: {}", graphUri);
      recordSuccess();
    } catch (Exception e) {
      LOG.error("Failed to clear graph on Fuseki", e);
      if (isCircuitBreakerFailure(e)) {
        recordFailure();
      }
      throw new RuntimeException("Failed to clear graph", e);
    }
  }

  /**
   * Triggers Fuseki's TDB2 compaction admin endpoint and blocks until the
   * background task completes. {@code deleteOld=true} tells Fuseki to swap the
   * dataset directory and delete the old one once the new copy is fully written
   * — this is the only way to physically reclaim disk after {@code CLEAR ALL}
   * or large {@code DELETE WHERE} updates, because TDB2 deletes are logical
   * (free-list marker) and the write-ahead journal grows monotonically.
   *
   * <p>Failures are logged and swallowed. A missing or failing compaction
   * degrades disk usage, not correctness — the caller's higher-level
   * operation (re-index, ontology reload, …) must not fail just because the
   * Fuseki admin endpoint is unreachable or returns a non-2xx.
   */
  @Override
  public void compactStorage() {
    // Wrap the whole flow in a catch-all so any failure here is best-effort
    // and never demotes a successful indexer run to FAILED. parseDatasetEndpoint
    // already returns null on URI.create failure; this guard covers any other
    // unexpected runtime exception that could surface from HTTP / JSON parsing.
    //
    // Skip the call entirely if the circuit breaker is open. The breaker
    // trips on connect failures (Fuseki unreachable), and a compact-then-
    // poll cycle would burn its two-call budget hitting timeouts on the
    // same dead server. The next reindex run can try again once Fuseki
    // recovers and the breaker closes.
    if (isCircuitOpen()) {
      LOG.warn("Skipping compaction; Fuseki circuit breaker is open");
      return;
    }
    DatasetEndpoint info;
    try {
      info = parseDatasetEndpoint(endpoint);
    } catch (RuntimeException e) {
      LOG.warn(
          "Skipping compaction: could not parse Fuseki endpoint '{}'. Reason: {}",
          maskUserInfo(endpoint),
          e.getMessage());
      return;
    }
    if (info == null) {
      LOG.warn(
          "Skipping compaction: could not parse dataset name from endpoint {}",
          maskUserInfo(endpoint));
      return;
    }
    try {
      String taskId = startCompaction(info);
      if (taskId == null) {
        return;
      }
      waitForCompactionTask(info.serverBaseUrl(), info.userInfo(), taskId);
    } catch (InterruptedException e) {
      // Re-assert the interrupt flag so downstream blocking calls (e.g. the
      // surrounding Quartz job's shutdown path) see the cancellation request.
      // Swallowing it here without restoring the flag would silently turn a
      // shutdown signal into a normal return.
      Thread.currentThread().interrupt();
      LOG.warn(
          "Compaction wait for Fuseki dataset '{}' was interrupted; "
              + "the compact task may still be running on the server.",
          info.datasetName());
    } catch (IOException e) {
      LOG.warn(
          "Failed to compact Fuseki dataset '{}' — disk reclamation skipped, "
              + "indexing will continue but on-disk usage may stay elevated.",
          info.datasetName(),
          e);
    } catch (RuntimeException e) {
      // The Javadoc on compactStorage promises "Failures are logged and
      // swallowed". The HTTP path can throw IllegalArgumentException (URI),
      // RdfStorageCircuitOpenException (if state flips mid-run), the
      // timeout wrappers' RuntimeException re-throws, or any of
      // Jena's runtime exceptions. Catch them all so a stray RuntimeException
      // never demotes a successful reindex to FAILED.
      LOG.warn(
          "Unexpected runtime error compacting Fuseki dataset '{}' — disk "
              + "reclamation skipped, indexing will continue.",
          info.datasetName(),
          e);
    }
  }

  private String startCompaction(DatasetEndpoint info) throws IOException, InterruptedException {
    HttpClient httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
    String compactUrl =
        info.serverBaseUrl()
            + "/$/compact/"
            + encodePathSegment(info.datasetName())
            + "?deleteOld=true";

    HttpRequest.Builder requestBuilder =
        HttpRequest.newBuilder()
            .uri(URI.create(compactUrl))
            .timeout(COMPACT_HTTP_TIMEOUT)
            .header("Accept", "application/json")
            .POST(HttpRequest.BodyPublishers.noBody());
    addBasicAuth(requestBuilder, username, password, info.userInfo());

    HttpResponse<String> response =
        httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Fuseki compaction request returned HTTP {}: {} — older Fuseki versions or "
              + "configurations without the /$/compact admin endpoint will report this; "
              + "disk reclamation skipped.",
          response.statusCode(),
          response.body());
      return null;
    }

    String taskId = extractTaskId(response.body());
    if (taskId == null) {
      LOG.warn(
          "Fuseki compaction response missing taskId; cannot wait for completion. Body: {}",
          response.body());
      return null;
    }
    LOG.info("Started Fuseki compaction for dataset '{}' (taskId={})", info.datasetName(), taskId);
    return taskId;
  }

  static String extractTaskId(String responseBody) {
    if (responseBody == null || responseBody.isBlank()) {
      return null;
    }
    try {
      var node = JsonUtils.readTree(responseBody);
      var taskNode = node.get("taskId");
      return taskNode != null && !taskNode.isNull() ? taskNode.asText() : null;
    } catch (JsonParsingException e) {
      LOG.debug("Could not parse taskId from Fuseki compaction response: {}", responseBody, e);
      return null;
    }
  }

  private void waitForCompactionTask(String serverBaseUrl, String userInfo, String taskId)
      throws InterruptedException {
    HttpClient httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
    String taskUrl = serverBaseUrl + "/$/tasks/" + encodePathSegment(taskId);
    long deadline = System.currentTimeMillis() + COMPACT_MAX_WAIT_MS;
    // Poll-then-sleep ordering: the very first iteration checks immediately so
    // a compaction that finished by the time we'd issued the POST (the empty
    // dataset case, which is the common one for recreateIndex=true) completes
    // without a 2 s wait. Subsequent iterations sleep between requests.
    boolean firstIteration = true;
    while (System.currentTimeMillis() < deadline) {
      if (!firstIteration) {
        Thread.sleep(COMPACT_POLL_INTERVAL_MS);
      }
      firstIteration = false;
      HttpRequest.Builder pollBuilder =
          HttpRequest.newBuilder()
              .uri(URI.create(taskUrl))
              .timeout(COMPACT_HTTP_TIMEOUT)
              .header("Accept", "application/json")
              .GET();
      addBasicAuth(pollBuilder, username, password, userInfo);
      HttpResponse<String> pollResponse;
      try {
        pollResponse = httpClient.send(pollBuilder.build(), HttpResponse.BodyHandlers.ofString());
      } catch (IOException e) {
        LOG.warn("Polling Fuseki task {} failed; abandoning wait", taskId, e);
        return;
      }
      if (pollResponse.statusCode() == 404) {
        // Some Fuseki versions retire finished tasks from /$/tasks/{id} immediately.
        // Treat 404-after-start as success — the task is no longer running.
        LOG.info("Fuseki compaction task {} finished (task entry removed by server)", taskId);
        return;
      }
      if (pollResponse.statusCode() != 200) {
        LOG.warn(
            "Polling Fuseki task {} returned HTTP {}: {}",
            taskId,
            pollResponse.statusCode(),
            pollResponse.body());
        return;
      }
      if (isTaskFinished(pollResponse.body())) {
        LOG.info("Fuseki compaction task {} finished: {}", taskId, pollResponse.body());
        return;
      }
      // Re-check the deadline AFTER the HTTP send. The loop-top check could
      // pass with a few ms left, then the send could hang up to
      // COMPACT_HTTP_TIMEOUT (30 s) before timing out — that would put total
      // elapsed up to ~30 s past COMPACT_MAX_WAIT_MS before we'd otherwise
      // notice. Break here so we abandon the wait promptly when the deadline
      // is already blown by a slow-responding server.
      if (System.currentTimeMillis() >= deadline) {
        break;
      }
    }
    LOG.warn(
        "Fuseki compaction task {} did not finish within {} ms; abandoning wait. "
            + "The task may still be running on the server.",
        taskId,
        COMPACT_MAX_WAIT_MS);
  }

  static boolean isTaskFinished(String responseBody) {
    if (responseBody == null || responseBody.isBlank()) {
      return false;
    }
    try {
      var node = JsonUtils.readTree(responseBody);
      var finished = node.get("finished");
      return finished != null && !finished.isNull() && !finished.asText().isBlank();
    } catch (JsonParsingException e) {
      LOG.debug("Could not parse Fuseki task status response: {}", responseBody, e);
      return false;
    }
  }

  @Override
  public boolean testConnection() {
    // testConnection is the probe used to detect when Fuseki has recovered, so
    // it must bypass the circuit breaker — otherwise we could never re-close it.
    try (QueryExecution qexec = connection.query("ASK { ?s ?p ?o }")) {
      qexec.execAsk();
      recordSuccess();
      return true;
    } catch (Exception e) {
      LOG.error("Connection test failed", e);
      return false;
    }
  }

  @Override
  public String getStorageType() {
    return "Apache Jena Fuseki";
  }

  @Override
  public void close() {
    if (connection != null) {
      connection.close();
      LOG.info("Closed connection to Fuseki server");
    }
  }
}

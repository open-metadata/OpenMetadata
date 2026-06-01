package org.openmetadata.service.rdf.storage;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.URI;
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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BooleanSupplier;
import java.util.function.LongConsumer;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
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
import org.openmetadata.service.rdf.translator.RdfPropertyMapper;

/**
 * Apache Jena Fuseki implementation of RDF storage.
 * Connects to a remote Fuseki server for stateless RDF operations.
 */
@Slf4j
public class JenaFusekiStorage implements RdfStorageInterface {

  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String METADATA_GRAPH = "https://open-metadata.org/graph/metadata";

  // Defaults keep TCP connect fail-fast while giving production Fuseki enough
  // time for larger SPARQL UPDATE transactions. The request timeout bounds the
  // per-request body via a CompletableFuture wrapper around every blocking
  // RDFConnection call below — caller thread frees on timeout even when Fuseki
  // accepts the TCP connection and then stalls on the response.
  //
  // We use CompletableFuture rather than Jena's QueryExecution.setTimeout
  // (removed in Jena 5; broke integration tests previously) or Jena's
  // QueryExecutionHTTPBuilder / UpdateExecHTTPBuilder (API surface differs
  // between Jena 4 and Jena 5, and our two classpaths use different
  // versions). The wrapper is Jena-API-agnostic. On timeout the underlying
  // HTTP request continues to leak its (virtual) thread until OS-level TCP
  // give-up; that's bounded by the circuit breaker, which trips after
  // CIRCUIT_BREAKER_FAILURE_THRESHOLD connect/timeout failures and
  // short-circuits new traffic for CIRCUIT_BREAKER_COOLDOWN_MS.
  static final int DEFAULT_CONNECT_TIMEOUT_MS = 2_000;
  static final long DEFAULT_REQUEST_TIMEOUT_MS = 60_000L;
  static final int DEFAULT_WRITE_MAX_RETRIES = 2;
  static final long DEFAULT_WRITE_RETRY_INITIAL_BACKOFF_MS = 250L;
  static final long DEFAULT_WRITE_RETRY_MAX_BACKOFF_MS = 2_000L;

  private static final int CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
  private static final long CIRCUIT_BREAKER_COOLDOWN_MS = 30_000L;

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
  // would starve unrelated CompletableFuture / parallel-stream work elsewhere
  // in the service. Virtual threads are cheap to leak (a few KB stack each)
  // and the circuit breaker bounds how many can pile up.
  private static final ExecutorService TIMEOUT_EXECUTOR =
      Executors.newThreadPerTaskExecutor(
          Thread.ofVirtual().name("rdf-storage-timeout-", 0).factory());

  private final RDFConnection connection;
  private final String baseUri;
  private final String endpoint;
  private final String username;
  private final String password;
  private final Duration connectTimeout;
  private final long requestTimeoutMs;
  private final int writeMaxRetries;
  private final long writeRetryInitialBackoffMs;
  private final long writeRetryMaxBackoffMs;
  private final LongConsumer retryDelayMs;

  private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
  private final AtomicLong circuitOpenUntilMs = new AtomicLong(0L);

  public JenaFusekiStorage(RdfConfiguration config) {
    this(config, JenaFusekiStorage::sleepRetryDelay);
  }

  JenaFusekiStorage(RdfConfiguration config, LongConsumer retryDelayMs) {
    this.baseUri =
        config.getBaseUri() != null ? config.getBaseUri().toString() : "https://open-metadata.org/";

    this.endpoint =
        config.getRemoteEndpoint() != null && !config.getRemoteEndpoint().toString().isEmpty()
            ? config.getRemoteEndpoint().toString()
            : "http://openmetadata-fuseki:3030/openmetadata";
    this.username = config.getUsername();
    this.password = config.getPassword();
    this.connectTimeout = Duration.ofMillis(resolveConnectTimeoutMs(config));
    this.requestTimeoutMs = resolveRequestTimeoutMs(config);
    this.writeMaxRetries = resolveWriteMaxRetries(config);
    this.writeRetryInitialBackoffMs = resolveWriteRetryInitialBackoffMs(config);
    this.writeRetryMaxBackoffMs = resolveWriteRetryMaxBackoffMs(config);
    this.retryDelayMs = retryDelayMs;

    // Best-effort attempt to create the dataset at startup; callers should invoke
    // ensureStorageReady() before running work to recover from later restarts of the RDF server.
    ensureDatasetExists(endpoint, username, password);

    if (username != null && password != null) {
      java.net.http.HttpClient httpClient =
          java.net.http.HttpClient.newBuilder()
              .connectTimeout(connectTimeout)
              .authenticator(
                  new java.net.Authenticator() {
                    @Override
                    protected java.net.PasswordAuthentication getPasswordAuthentication() {
                      return new java.net.PasswordAuthentication(
                          config.getUsername(), config.getPassword().toCharArray());
                    }
                  })
              .build();

      this.connection =
          RDFConnectionFuseki.create().destination(endpoint).httpClient(httpClient).build();
    } else {
      java.net.http.HttpClient httpClient =
          java.net.http.HttpClient.newBuilder().connectTimeout(connectTimeout).build();
      this.connection =
          RDFConnectionFuseki.create().destination(endpoint).httpClient(httpClient).build();
    }
    LOG.info("Connected to Apache Jena Fuseki at {}", maskUserInfo(endpoint));
    loadOntology();
  }

  static int resolveConnectTimeoutMs(RdfConfiguration config) {
    return positiveInt(config.getConnectTimeoutMs(), DEFAULT_CONNECT_TIMEOUT_MS);
  }

  static long resolveRequestTimeoutMs(RdfConfiguration config) {
    return positiveLong(config.getRequestTimeoutMs(), DEFAULT_REQUEST_TIMEOUT_MS);
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

  private static long positiveLong(Integer value, long defaultValue) {
    return value != null && value > 0 ? value.longValue() : defaultValue;
  }

  private static long nonNegativeLong(Integer value, long defaultValue) {
    return value != null && value >= 0 ? value.longValue() : defaultValue;
  }

  @Override
  public void ensureStorageReady() {
    if (testConnection()) {
      LOG.debug("Fuseki dataset at {} is accessible", endpoint);
      return;
    }

    LOG.warn(
        "Fuseki dataset at {} is not accessible; attempting to (re)create it before running",
        endpoint);
    ensureDatasetExists(endpoint, username, password);

    if (!testConnection()) {
      throw new IllegalStateException(
          String.format(
              "RDF storage is not accessible at %s after attempting dataset creation. "
                  + "Verify the configured RDF endpoint URL, credentials, that the Fuseki dataset "
                  + "exists, and that the configured user has permission to create it.",
              maskUserInfo(endpoint)));
    }
    LOG.info("Fuseki dataset at {} is now ready", maskUserInfo(endpoint));
    loadOntology();
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
  static DatasetEndpoint parseDatasetEndpoint(String endpoint) {
    URI uri;
    try {
      uri = URI.create(endpoint);
    } catch (IllegalArgumentException e) {
      return null;
    }
    String path = uri.getPath();
    if (path == null || path.isEmpty() || path.equals("/")) {
      return null;
    }
    String datasetName = path.startsWith("/") ? path.substring(1) : path;
    if (datasetName.contains("/")) {
      datasetName = datasetName.split("/")[0];
    }
    StringBuilder serverBaseUrl = new StringBuilder();
    serverBaseUrl.append(uri.getScheme()).append("://").append(uri.getHost());
    if (uri.getPort() > 0) {
      serverBaseUrl.append(':').append(uri.getPort());
    }
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

  /**
   * Ensures the Fuseki dataset exists, creating it if necessary.
   */
  private void ensureDatasetExists(String endpoint, String username, String password) {
    try {
      DatasetEndpoint info = parseDatasetEndpoint(endpoint);
      if (info == null) {
        LOG.warn("Could not extract dataset name from endpoint: {}", maskUserInfo(endpoint));
        return;
      }

      LOG.info(
          "Checking if Fuseki dataset '{}' exists at server {}",
          info.datasetName(),
          info.serverBaseUrl());

      HttpClient httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
      String adminUrl =
          info.serverBaseUrl() + "/$/datasets/" + encodePathSegment(info.datasetName());

      HttpRequest.Builder requestBuilder = HttpRequest.newBuilder().uri(URI.create(adminUrl)).GET();
      addBasicAuth(requestBuilder, username, password, info.userInfo());

      HttpResponse<String> response =
          httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        LOG.info("Fuseki dataset '{}' already exists", info.datasetName());
        return;
      }

      if (response.statusCode() == 404) {
        LOG.info("Fuseki dataset '{}' does not exist, creating it...", info.datasetName());
        createDataset(info.serverBaseUrl(), info.datasetName(), username, password);
      } else {
        LOG.warn(
            "Unexpected response checking dataset existence: {} - {}",
            response.statusCode(),
            response.body());
      }
    } catch (Exception e) {
      LOG.warn(
          "Could not verify/create Fuseki dataset. "
              + "If the dataset doesn't exist, you may need to create it manually. Error: {}",
          e.getMessage());
    }
  }

  /**
   * Creates a new TDB2 dataset in Fuseki using the admin API.
   */
  private void createDataset(
      String serverBaseUrl, String datasetName, String username, String password) {
    try {
      HttpClient httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
      String adminUrl = serverBaseUrl + "/$/datasets";

      String body = "dbName=" + datasetName + "&dbType=tdb2";

      HttpRequest.Builder requestBuilder =
          HttpRequest.newBuilder()
              .uri(URI.create(adminUrl))
              .header("Content-Type", "application/x-www-form-urlencoded")
              .POST(HttpRequest.BodyPublishers.ofString(body));

      addBasicAuth(requestBuilder, username, password);

      HttpResponse<String> response =
          httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200 || response.statusCode() == 201) {
        LOG.info("Successfully created Fuseki dataset '{}'", datasetName);
      } else {
        LOG.error(
            "Failed to create Fuseki dataset '{}': {} - {}",
            datasetName,
            response.statusCode(),
            response.body());
      }
    } catch (Exception e) {
      LOG.error("Error creating Fuseki dataset '{}': {}", datasetName, e.getMessage());
    }
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

      connection.load(METADATA_GRAPH, ontologyModel);
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
    return isConnectError(t) || isTimeoutError(t);
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

  private void runWriteWithRetry(Runnable op, String description) {
    runWriteWithRetry(
        op,
        description,
        writeMaxRetries,
        writeRetryInitialBackoffMs,
        writeRetryMaxBackoffMs,
        retryDelayMs,
        () -> throwIfCircuitOpen(description),
        this::recordSuccess,
        this::recordFailure,
        this::isCircuitOpen);
  }

  static void runWriteWithRetry(
      Runnable op,
      String description,
      int writeMaxRetries,
      long writeRetryInitialBackoffMs,
      long writeRetryMaxBackoffMs,
      LongConsumer retryDelayMs,
      Runnable throwIfCircuitOpen,
      Runnable recordSuccess,
      Runnable recordFailure,
      BooleanSupplier isCircuitOpen) {
    RuntimeException lastException = null;
    for (int attempt = 0; attempt <= writeMaxRetries; attempt++) {
      throwIfCircuitOpen.run();
      try {
        op.run();
        recordSuccess.run();
        return;
      } catch (RuntimeException e) {
        lastException = e;
        if (!isCircuitBreakerFailure(e)) {
          throw e;
        }
        recordFailure.run();
        if (isCircuitOpen.getAsBoolean()) {
          throw new RdfStorageCircuitOpenException(description, e);
        }
        if (attempt >= writeMaxRetries) {
          throw e;
        }
        sleepBeforeRetry(
            description,
            attempt + 1,
            e,
            writeMaxRetries,
            writeRetryInitialBackoffMs,
            writeRetryMaxBackoffMs,
            retryDelayMs);
      }
    }
    throw lastException;
  }

  private static void sleepBeforeRetry(
      String description,
      int retryNumber,
      RuntimeException cause,
      int writeMaxRetries,
      long writeRetryInitialBackoffMs,
      long writeRetryMaxBackoffMs,
      LongConsumer retryDelayMs) {
    long waitTime = retryBackoffMs(retryNumber, writeRetryInitialBackoffMs, writeRetryMaxBackoffMs);
    LOG.debug(
        "Retrying RDF write {} after {} ms (retry {}/{})",
        description,
        waitTime,
        retryNumber,
        writeMaxRetries,
        cause);
    if (waitTime <= 0) {
      return;
    }
    retryDelayMs.accept(waitTime);
  }

  private static void sleepRetryDelay(long waitTime) {
    try {
      Thread.sleep(waitTime);
    } catch (InterruptedException ie) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("Interrupted while retrying RDF write", ie);
    }
  }

  private static long retryBackoffMs(
      int retryNumber, long writeRetryInitialBackoffMs, long writeRetryMaxBackoffMs) {
    if (writeRetryInitialBackoffMs <= 0 || writeRetryMaxBackoffMs <= 0) {
      return 0L;
    }
    long multiplier = 1L << Math.min(retryNumber - 1, 30);
    long uncapped;
    try {
      uncapped = Math.multiplyExact(writeRetryInitialBackoffMs, multiplier);
    } catch (ArithmeticException e) {
      uncapped = Long.MAX_VALUE;
    }
    return Math.min(uncapped, writeRetryMaxBackoffMs);
  }

  // Run a blocking RDFConnection call with a request-level deadline.
  // CompletableFuture.runAsync executes the supplier on the common ForkJoinPool;
  // get(requestTimeoutMs, …) frees this thread when the deadline hits, even
  // if the underlying HTTP request continues blocking until the server
  // responds (or the OS gives up on the socket). Exceptions thrown by the
  // supplier are unwrapped from ExecutionException so the caller sees the
  // original Jena HttpException, IOException, etc. and can decide whether to
  // retry or surface to the circuit breaker.
  private <T> T runWithTimeout(Supplier<T> op, String description) {
    CompletableFuture<T> future = CompletableFuture.supplyAsync(op, TIMEOUT_EXECUTOR);
    try {
      return future.get(requestTimeoutMs, TimeUnit.MILLISECONDS);
    } catch (TimeoutException te) {
      // Cancellation doesn't actually interrupt Jena's HTTP call, but
      // releases this thread; the leaked task continues until OS TCP timeout.
      future.cancel(true);
      throw new RuntimeException(description + " timed out after " + requestTimeoutMs + "ms", te);
    } catch (ExecutionException ee) {
      Throwable cause = ee.getCause() != null ? ee.getCause() : ee;
      if (cause instanceof RuntimeException re) {
        throw re;
      }
      throw new RuntimeException(description + " failed", cause);
    } catch (InterruptedException ie) {
      Thread.currentThread().interrupt();
      throw new RuntimeException(description + " interrupted", ie);
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
      if (org.openmetadata.service.rdf.RdfRepository.RELATIONSHIP_HOOK_PREDICATES.contains(
          predicateUri)) {
        continue;
      }
      predicates.add(predicateUri);
    }
    // Defensive belt-and-braces in case a future change adds a hook predicate
    // to the static set: filter the static set the same way.
    predicates.removeAll(org.openmetadata.service.rdf.RdfRepository.RELATIONSHIP_HOOK_PREDICATES);
    return predicates;
  }

  private static String buildPredicateScopedDelete(String entityUri, Set<String> predicates) {
    // Always delete literal-/blank-node-valued triples regardless of predicate.
    // Predicates that emit literals (description, displayName, name, ...) may
    // SHRINK TO EMPTY between writes — the new translator output simply omits
    // the triple — and the old literal would persist unless we sweep it here.
    // Hook-managed URI triples (om:owns / om:contains / lineage / etc.) are
    // safe because the FILTER below requires isIRI(?o) for them to qualify.
    String literalSweep =
        String.format(
            "DELETE { GRAPH <%s> { <%s> ?p ?o } } "
                + "WHERE { GRAPH <%s> { <%s> ?p ?o . FILTER(!isIRI(?o)) } }",
            KNOWLEDGE_GRAPH, entityUri, KNOWLEDGE_GRAPH, entityUri);
    if (predicates.isEmpty()) {
      return literalSweep;
    }
    StringBuilder filterIn = new StringBuilder();
    boolean first = true;
    for (String pred : predicates) {
      if (!first) {
        filterIn.append(", ");
      }
      first = false;
      filterIn.append('<').append(pred).append('>');
    }
    // Chain the literal sweep + the predicate-scoped URI delete in one update.
    // The literal sweep on its own would leave stale URI triples for
    // translator predicates that disappeared from the new model (rare, but
    // possible if a JSON-LD context predicate is removed); the predicate-scoped
    // URI delete on its own would leave stale literals as Copilot flagged.
    return literalSweep
        + "; "
        + String.format(
            "DELETE { GRAPH <%s> { <%s> ?p ?o } } WHERE { GRAPH <%s> { <%s> ?p ?o . FILTER(isIRI(?o) && ?p IN (%s)) } }",
            KNOWLEDGE_GRAPH, entityUri, KNOWLEDGE_GRAPH, entityUri, filterIn);
  }

  static String buildEntityUpsertUpdate(String entityUri, Model entityModel) {
    Set<String> predicatesToDelete = collectTranslatorPredicates(entityUri, entityModel);
    String deleteQuery = buildPredicateScopedDelete(entityUri, predicatesToDelete);
    String triples = serializeModel(entityModel);
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
   * Bulk variant: one combined DELETE + INSERT DATA SPARQL UPDATE for the
   * whole batch, in a SINGLE transaction at the Fuseki side. Batching collapses
   * N per-entity updates into one request per repository chunk.
   *
   * <p>Atomicity: previously the bulk path issued a SPARQL UPDATE for the
   * DELETE and a separate GSP POST for the LOAD, which could leave the
   * dataset in a half-applied state if the second call failed — every
   * entity's prior translator-managed predicates would be gone but the new
   * triples never landed. Now we serialise the combined model as N-Triples
   * and embed it in the SAME SPARQL UPDATE via {@code INSERT DATA}; multi-
   * statement SPARQL UPDATEs run in one Fuseki transaction so the batch is
   * either fully applied or fully rolled back. Failure semantics stay
   * all-or-nothing from the caller's perspective.
   */
  @Override
  public void bulkStoreEntities(List<EntityWriteRequest> requests) {
    if (requests == null || requests.isEmpty()) {
      return;
    }
    throwIfCircuitOpen("bulkStoreEntities");

    StringBuilder combinedDelete = new StringBuilder();
    Model combinedModel = ModelFactory.createDefaultModel();
    boolean first = true;
    for (EntityWriteRequest req : requests) {
      String entityUri = baseUri + "entity/" + req.entityType() + "/" + req.entityId();
      Set<String> predicatesToDelete = collectTranslatorPredicates(entityUri, req.model());
      String deleteQuery = buildPredicateScopedDelete(entityUri, predicatesToDelete);
      if (!first) {
        combinedDelete.append(";\n");
      }
      first = false;
      combinedDelete.append(deleteQuery);
      combinedModel.add(req.model());
    }

    String triples = serializeModel(combinedModel);
    StringBuilder combined = new StringBuilder(combinedDelete);
    if (!triples.isBlank()) {
      if (combined.length() > 0) {
        combined.append(";\n");
      }
      combined.append(buildInsertData(triples));
    }

    try {
      UpdateRequest updateRequest = UpdateFactory.create(combined.toString());
      runWriteWithRetry(
          () -> runWithTimeout(() -> connection.update(updateRequest), "bulkStoreEntities"),
          "bulkStoreEntities");
      // DEBUG, not INFO: this fires per-batch in a hot reindex loop (default
      // batchSize=100 → tens of thousands of log lines on a real reindex).
      // Keep INFO reserved for events ops actually want to grep for.
      LOG.debug(
          "Bulk-stored {} entities in {} ({} triples)",
          requests.size(),
          KNOWLEDGE_GRAPH,
          combinedModel.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk-store {} entities in Fuseki", requests.size(), e);
      throw new RuntimeException("Failed to bulk-store entities in RDF", e);
    }
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
    // while hook-managed predicates (om:UPSTREAM, om:hasLineageDetails,
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
      runWriteWithRetry(
          () -> runWithTimeout(() -> connection.update(request), "storeEntity"), "storeEntity");
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
      runWriteWithRetry(
          () -> runWithTimeout(() -> connection.update(request), "storeRelationship"),
          "storeRelationship");
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

    // Per-source-entity reconciliation: for each source URI the caller asked
    // us to reconcile, wipe every outgoing relationship-hook edge first, then
    // insert the current batch. Sources NOT in sourcesToReconcile (e.g. an
    // outside-batch upstream entity that contributed only an incoming lineage
    // row) get their new edges inserted but their existing edges are left
    // alone — wiping them would destroy unrelated state that this batch
    // never had visibility into.
    //
    // The DELETE filter is scoped to RELATIONSHIP_HOOK_PREDICATES (derived
    // from the Relationship enum, see RdfRepository) so it ONLY touches
    // predicates that addRelationship / bulkAddRelationships actually write.
    // Lineage predicates (managed by addLineageWithDetails) and
    // translator-managed predicates (om:hasOwner / om:hasTag / etc., managed
    // by storeEntity's predicate-scoped DELETE) are NOT in the set and are
    // therefore preserved across reconciliation.
    String hookPredicateList =
        org.openmetadata.service.rdf.RdfRepository.buildPredicateInList(
            org.openmetadata.service.rdf.RdfRepository.RELATIONSHIP_HOOK_PREDICATES);

    StringBuilder deleteUpdate = new StringBuilder();
    boolean firstDelete = true;
    for (String sourceUri : effectiveSources) {
      if (!firstDelete) {
        deleteUpdate.append("; ");
      }
      firstDelete = false;
      deleteUpdate
          .append("DELETE { GRAPH <")
          .append(KNOWLEDGE_GRAPH)
          .append("> { <")
          .append(sourceUri)
          .append("> ?p ?o } } WHERE { GRAPH <")
          .append(KNOWLEDGE_GRAPH)
          .append("> { <")
          .append(sourceUri)
          .append("> ?p ?o . FILTER(?p IN (")
          .append(hookPredicateList)
          .append(")) } }");
    }

    StringBuilder insertData = new StringBuilder();
    insertData.append("INSERT DATA { GRAPH <").append(KNOWLEDGE_GRAPH).append("> { ");
    for (RelationshipData rel : relationships) {
      // Use the pre-computed predicateUri (via RdfRepository.getRelationshipPredicate)
      // so the triple written here matches what addRelationship / removeRelationship
      // expect for the same relationship type. Fall back to the lowercase
      // `<baseUri>ontology/<type>` for any caller that built RelationshipData via
      // the legacy 5-arg constructor — same shape the original implementation used.
      String predicateUri =
          rel.getPredicateUri() != null
              ? rel.getPredicateUri()
              : baseUri + "ontology/" + rel.getRelationshipType();
      insertData.append(
          String.format(
              "<%sentity/%s/%s> <%s> <%sentity/%s/%s> . ",
              baseUri,
              rel.getFromType(),
              rel.getFromId(),
              predicateUri,
              baseUri,
              rel.getToType(),
              rel.getToId()));
    }
    insertData.append("} }");

    // Combine DELETE and INSERT into a SINGLE SPARQL update so they share a
    // transaction at the Fuseki side — if the request fails, neither half
    // commits, and we never leave the graph half-reconciled. (The previous
    // separate calls + a failed insert could leave sources wiped without
    // their replacement edges in place until the next weekly recreate-index.)
    StringBuilder combined = new StringBuilder();
    if (deleteUpdate.length() > 0) {
      combined.append(deleteUpdate);
      if (!relationships.isEmpty()) {
        combined.append("; ");
      }
    }
    if (!relationships.isEmpty()) {
      combined.append(insertData);
    }

    try {
      if (combined.length() == 0) {
        return; // No work — empty relationships AND empty sourcesToReconcile is the early return
        // above.
      }
      UpdateRequest request = UpdateFactory.create(combined.toString());
      runWriteWithRetry(
          () -> runWithTimeout(() -> connection.update(request), "bulkStoreRelationships"),
          "bulkStoreRelationships");
      LOG.info(
          "Bulk stored {} relationships, reconciled {} source entities",
          relationships.size(),
          effectiveSources.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk store relationships in Fuseki", e);
      throw new RuntimeException("Failed to bulk store relationships in RDF", e);
    }
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

    // Delete entity and all its relationships from the knowledge graph
    String deleteQuery =
        String.format(
            "DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }; "
                + "DELETE WHERE { GRAPH <%s> { ?s ?p <%s> } }",
            KNOWLEDGE_GRAPH, entityUri, KNOWLEDGE_GRAPH, entityUri);

    try {
      UpdateRequest request = UpdateFactory.create(deleteQuery);
      runWithTimeout(() -> connection.update(request), "deleteEntity");
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

    RDFFormat rdfFormat =
        format.equalsIgnoreCase("turtle")
            ? RDFFormat.TURTLE
            : format.equalsIgnoreCase("jsonld")
                ? RDFFormat.JSONLD
                : format.equalsIgnoreCase("ntriples") ? RDFFormat.NTRIPLES : RDFFormat.RDFXML;

    RDFDataMgr.write(writer, model, rdfFormat);
    return writer.toString();
  }

  @Override
  public void executeSparqlUpdate(String sparqlUpdate) {
    throwIfCircuitOpen("executeSparqlUpdate");
    try {
      UpdateRequest request = UpdateFactory.create(sparqlUpdate);
      runWithTimeout(() -> connection.update(request), "executeSparqlUpdate");
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
      try {
        connection.delete(graphUri);
      } catch (org.apache.jena.atlas.web.HttpException e) {
        if (e.getStatusCode() != 404) {
          throw e;
        }
      }

      // Then load the new data
      connection.load(graphUri, model);

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
  public void clearGraph(String graphUri) {
    throwIfCircuitOpen("clearGraph");
    try {
      connection.delete(graphUri);
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
      // CompletableFuture wrappers' RuntimeException re-throws, or any of
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

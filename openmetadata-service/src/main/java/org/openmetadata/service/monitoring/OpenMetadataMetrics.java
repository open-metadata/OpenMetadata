package org.openmetadata.service.monitoring;

import static org.openmetadata.service.monitoring.MetricUtils.LATENCY_SLA_BUCKETS;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

/**
 * Central metrics class for OpenMetadata using Micrometer API.
 * This class provides a unified interface for recording various metrics
 * throughout the application.
 */
@Slf4j
@Singleton
public class OpenMetadataMetrics {
  private final MeterRegistry meterRegistry;

  // HTTP Metrics
  private final Timer httpRequestTimer;
  private final Counter httpRequestCounter;
  private final DistributionSummary httpResponseSize;

  // Database Metrics
  private final Timer jdbiQueryTimer;
  private final Counter jdbiConnectionCounter;
  private final Counter jdbiErrorCounter;

  // Business Metrics
  private final Counter entityCreatedCounter;
  private final Counter entityUpdatedCounter;
  private final Counter entityDeletedCounter;
  private final Counter searchQueryCounter;

  // Pipeline Metrics
  private final Counter pipelineStatusCounter;
  private final Timer pipelineExecutionTimer;

  // Authentication Metrics
  private final Counter authenticationAttempts;
  private final Counter authenticationFailures;

  @Inject
  public OpenMetadataMetrics(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;

    // Initialize HTTP metrics
    this.httpRequestTimer =
        Timer.builder("http.server.requests")
            .description("HTTP server request duration")
            .sla(LATENCY_SLA_BUCKETS)
            .register(meterRegistry);

    this.httpRequestCounter =
        Counter.builder("http.server.requests.total")
            .description("Total number of HTTP requests")
            .register(meterRegistry);

    this.httpResponseSize =
        DistributionSummary.builder("http.server.response.size")
            .description("HTTP response size in bytes")
            .baseUnit("bytes")
            .serviceLevelObjectives(1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216)
            .register(meterRegistry);

    // Initialize Database metrics
    this.jdbiQueryTimer =
        Timer.builder("db.query.duration")
            .description("Database query duration")
            .sla(LATENCY_SLA_BUCKETS)
            .register(meterRegistry);

    this.jdbiConnectionCounter =
        Counter.builder("db.connections.total")
            .description("Total database connections created")
            .register(meterRegistry);

    this.jdbiErrorCounter =
        Counter.builder("db.errors.total")
            .description("Total database errors")
            .register(meterRegistry);

    // Initialize Business metrics
    this.entityCreatedCounter =
        Counter.builder("entity.operations")
            .description("Number of entity operations")
            .tag("operation", "create")
            .register(meterRegistry);

    this.entityUpdatedCounter =
        Counter.builder("entity.operations")
            .description("Number of entity operations")
            .tag("operation", "update")
            .register(meterRegistry);

    this.entityDeletedCounter =
        Counter.builder("entity.operations")
            .description("Number of entity operations")
            .tag("operation", "delete")
            .register(meterRegistry);

    this.searchQueryCounter =
        Counter.builder("search.queries.total")
            .description("Total number of search queries")
            .register(meterRegistry);

    // Initialize Pipeline metrics
    this.pipelineStatusCounter =
        Counter.builder("pipeline.status")
            .description("Pipeline execution status")
            .register(meterRegistry);

    this.pipelineExecutionTimer =
        Timer.builder("pipeline.execution.duration")
            .description("Pipeline execution duration")
            .sla(LATENCY_SLA_BUCKETS)
            .register(meterRegistry);

    // Initialize Authentication metrics
    this.authenticationAttempts =
        Counter.builder("auth.attempts.total")
            .description("Total authentication attempts")
            .register(meterRegistry);

    this.authenticationFailures =
        Counter.builder("auth.failures.total")
            .description("Total authentication failures")
            .register(meterRegistry);
  }

  // HTTP metric recording methods
  public Timer.Sample startHttpRequestTimer() {
    return Timer.start(meterRegistry);
  }

  public void recordHttpRequest(Timer.Sample sample, String method, String uri, int status) {
    sample.stop(
        Timer.builder("http.server.requests")
            .tag("method", method)
            .tag("uri", normalizeUri(uri))
            .tag("status", String.valueOf(status))
            .tag("status.class", getStatusClass(status))
            .register(meterRegistry));

    httpRequestCounter.increment();
  }

  public void recordHttpRequest(String method, String uri, int status, long durationMs) {
    Timer.builder("http.server.requests")
        .tag("method", method)
        .tag("uri", normalizeUri(uri))
        .tag("status", String.valueOf(status))
        .tag("status.class", getStatusClass(status))
        .register(meterRegistry)
        .record(Duration.ofMillis(durationMs));

    httpRequestCounter.increment();
  }

  public void recordHttpResponseSize(long sizeBytes) {
    httpResponseSize.record(sizeBytes);
  }

  // Database metric recording methods
  public Timer.Sample startDatabaseQueryTimer() {
    return Timer.start(meterRegistry);
  }

  public void recordDatabaseQuery(Timer.Sample sample, String queryType, boolean success) {
    sample.stop(
        Timer.builder("db.query.duration")
            .tag("type", queryType)
            .tag("success", String.valueOf(success))
            .register(meterRegistry));

    if (!success) {
      jdbiErrorCounter.increment();
    }
  }

  public void recordDatabaseQuery(String queryType, long durationMs) {
    Timer.builder("db.query.duration")
        .tag("type", queryType)
        .register(meterRegistry)
        .record(Duration.ofMillis(durationMs));
  }

  public void incrementDatabaseConnections() {
    jdbiConnectionCounter.increment();
  }

  public void incrementDatabaseErrors(String errorType) {
    meterRegistry.counter("db.errors.total", "type", errorType).increment();
  }

  // Business metric recording methods
  public void recordEntityCreated(String entityType) {
    meterRegistry
        .counter("entity.operations", "type", entityType, "operation", "create")
        .increment();
  }

  public void recordEntityUpdated(String entityType) {
    meterRegistry
        .counter("entity.operations", "type", entityType, "operation", "update")
        .increment();
  }

  public void recordEntityDeleted(String entityType) {
    meterRegistry
        .counter("entity.operations", "type", entityType, "operation", "delete")
        .increment();
  }

  public void recordSearchQuery(String searchType, int resultCount) {
    meterRegistry
        .counter(
            "search.queries.total",
            "type",
            searchType,
            "has_results",
            String.valueOf(resultCount > 0))
        .increment();

    meterRegistry.summary("search.results.count", "type", searchType).record(resultCount);
  }

  // Pipeline metric recording methods
  public void recordPipelineStatus(String pipelineName, String status) {
    meterRegistry.counter("pipeline.status", "name", pipelineName, "status", status).increment();
  }

  public void recordPipelineExecution(String pipelineName, long durationMs, boolean success) {
    Timer.builder("pipeline.execution.duration")
        .tag("name", pipelineName)
        .tag("success", String.valueOf(success))
        .register(meterRegistry)
        .record(Duration.ofMillis(durationMs));
  }

  // Authentication metric recording methods
  public void recordAuthenticationAttempt(String authType) {
    meterRegistry.counter("auth.attempts.total", "type", authType).increment();
  }

  public void recordAuthenticationFailure(String authType, String reason) {
    meterRegistry.counter("auth.failures.total", "type", authType, "reason", reason).increment();
  }

  // Gauge registration methods
  public void registerGauge(
      String name, java.util.function.Supplier<Number> supplier, String description) {
    io.micrometer.core.instrument.Gauge.builder(name, () -> supplier.get().doubleValue())
        .description(description)
        .register(meterRegistry);
  }

  // Utility methods
  private String normalizeUri(String uri) {
    // Normalize URIs to avoid high cardinality
    if (uri == null || uri.isEmpty()) {
      return "/unknown";
    }

    // Remove query parameters to reduce cardinality
    String normalizedUri = uri.split("\\?")[0];

    // Replace various ID patterns with placeholders
    normalizedUri =
        normalizedUri
            // UUID patterns (e.g., /api/v1/tables/12345678-1234-1234-1234-123456789abc)
            .replaceAll("/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{id}")
            // Numeric IDs (e.g., /api/v1/tables/123456)
            .replaceAll("/\\d+", "/{id}")
            // Entity names that contain special characters or spaces (encoded)
            .replaceAll("/[^/]*%[0-9a-fA-F]{2}[^/]*", "/{name}")
            // Long alphanumeric strings that might be encoded names
            .replaceAll("/[a-zA-Z0-9_.-]{20,}", "/{name}")
            // Handle common OpenMetadata API patterns - split into multiple patterns to reduce
            // complexity
            .replaceAll(
                "/(tables|databases|services|pipelines|topics|dashboards|charts|containers)/[^/]+/[^/]+",
                "/$1/{name}/{subresource}")
            .replaceAll(
                "/(glossaryTerms|tags|policies|roles|users|teams|dataModels|searchIndexes)/[^/]+/[^/]+",
                "/$1/{name}/{subresource}")
            .replaceAll(
                "/(testSuites|testCases|webhooks|bots|automations|applications|connections)/[^/]+/[^/]+",
                "/$1/{name}/{subresource}")
            .replaceAll(
                "/(secrets|storedProcedures|databaseSchemas|mlModels|reports|metrics)/[^/]+/[^/]+",
                "/$1/{name}/{subresource}")
            .replaceAll(
                "/(queries|suggestions|lineage|events|feeds|conversations|activities)/[^/]+/[^/]+",
                "/$1/{name}/{subresource}")
            .replaceAll(
                "/(tasks|kpis|domains|dataProducts|governanceWorkflows)/[^/]+/[^/]+",
                "/$1/{name}/{subresource}")
            .replaceAll(
                "/(tables|databases|services|pipelines|topics|dashboards|charts|containers)/[^/]+",
                "/$1/{name}")
            .replaceAll(
                "/(glossaryTerms|tags|policies|roles|users|teams|dataModels|searchIndexes)/[^/]+",
                "/$1/{name}")
            .replaceAll(
                "/(testSuites|testCases|webhooks|bots|automations|applications|connections)/[^/]+",
                "/$1/{name}")
            .replaceAll(
                "/(secrets|storedProcedures|databaseSchemas|mlModels|reports|metrics)/[^/]+",
                "/$1/{name}")
            .replaceAll(
                "/(queries|suggestions|lineage|events|feeds|conversations|activities)/[^/]+",
                "/$1/{name}")
            .replaceAll(
                "/(tasks|kpis|domains|dataProducts|governanceWorkflows)/[^/]+", "/$1/{name}")
            // Analytics deep paths with timestamps and multiple segments
            .replaceAll(
                "/analytics/dataInsights/[^/]+/[^/]+", "/analytics/dataInsights/{type}/{id}")
            .replaceAll(
                "/analytics/web/events/[^/]+/[^/]+/collect",
                "/analytics/web/events/{name}/{timestamp}/collect")
            // Data quality multi-level paths
            .replaceAll("/dataQuality/testCases/[^/]+/[^/]+", "/dataQuality/testCases/{type}/{id}")
            .replaceAll(
                "/dataQuality/testSuites/[^/]+/[^/]+", "/dataQuality/testSuites/{id}/{subresource}")
            // Complex lineage patterns with multiple entities
            .replaceAll(
                "/lineage/[^/]+/[^/]+/[^/]+/[^/]+",
                "/lineage/{fromEntity}/{fromId}/{toEntity}/{toId}")
            .replaceAll(
                "/lineage/[^/]+/name/[^/]+/[^/]+/name/[^/]+",
                "/lineage/{fromEntity}/name/{fromFQN}/{toEntity}/name/{toFQN}")
            .replaceAll(
                "/lineage/[^/]+/[^/]+/type/[^/]+",
                "/lineage/{entityType}/{entityId}/type/{lineageSource}")
            // Event subscriptions complex paths
            .replaceAll(
                "/events/subscriptions/[^/]+/[^/]+/[^/]+",
                "/events/subscriptions/{id}/{resource}/{subresource}")
            .replaceAll(
                "/events/subscriptions/name/[^/]+/[^/]+",
                "/events/subscriptions/name/{name}/{resource}")
            // Service nested paths
            .replaceAll("/services/[^/]+/[^/]+/[^/]+", "/services/{serviceType}/{id}/{subresource}")
            .replaceAll(
                "/services/testConnectionDefinitions/[^/]+",
                "/services/testConnectionDefinitions/{connectionType}")
            // Governance workflow paths
            .replaceAll(
                "/governance/[^/]+/[^/]+/[^/]+",
                "/governance/{workflowType}/{definitionName}/{instanceId}")
            // Drive/file management paths
            .replaceAll("/drives/[^/]+/[^/]+/[^/]+", "/drives/{type}/{id}/{subresource}")
            // Universal entity sub-resources (versions, followers, results, etc.)
            .replaceAll("/([^/]+)/([^/]+)/versions/[^/]+", "/$1/$2/versions/{version}")
            .replaceAll("/([^/]+)/([^/]+)/followers/[^/]+", "/$1/$2/followers/{userId}")
            .replaceAll("/([^/]+)/([^/]+)/results/[^/]+", "/$1/$2/results/{result}")
            .replaceAll(
                "/([^/]+)/([^/]+)/results/before/[^/]+", "/$1/$2/results/before/{timestamp}")
            .replaceAll(
                "/([^/]+)/name/([^/]+)/(export|import|exportAsync|importAsync)", "/$1/name/$2/$3")
            // SCIM paths
            .replaceAll("/scim/(Users|Groups)/[^/]+", "/scim/$1/{id}")
            // Permission resource patterns
            .replaceAll("/permissions/[^/]+/[^/]+", "/permissions/{resource}/{id}")
            .replaceAll("/permissions/[^/]+/name/[^/]+", "/permissions/{resource}/name/{name}")
            .replaceAll("/permissions/view/[^/]+", "/permissions/view/{entityType}")
            .replaceAll("/permissions/debug/user/[^/]+", "/permissions/debug/user/{username}")
            .replaceAll("/permissions/debug/evaluate", "/permissions/debug/evaluate")
            // EventSubscription complex patterns (HIGH PRIORITY - prevents cardinality explosion)
            .replaceAll(
                "/events/subscriptions/name/[^/]+/status/[^/]+",
                "/events/subscriptions/name/{name}/status/{destinationId}")
            .replaceAll(
                "/events/subscriptions/[^/]+/status/[^/]+",
                "/events/subscriptions/{id}/status/{destinationId}")
            .replaceAll(
                "/events/subscriptions/[^/]+/resources",
                "/events/subscriptions/{alertType}/resources")
            .replaceAll(
                "/events/subscriptions/id/[^/]+/listEvents",
                "/events/subscriptions/id/{id}/listEvents")
            .replaceAll(
                "/events/subscriptions/id/[^/]+/eventsRecord",
                "/events/subscriptions/id/{subscriptionId}/eventsRecord")
            .replaceAll(
                "/events/subscriptions/name/[^/]+/eventsRecord",
                "/events/subscriptions/name/{subscriptionName}/eventsRecord")
            .replaceAll(
                "/events/subscriptions/id/[^/]+/diagnosticInfo",
                "/events/subscriptions/id/{subscriptionId}/diagnosticInfo")
            .replaceAll(
                "/events/subscriptions/name/[^/]+/diagnosticInfo",
                "/events/subscriptions/name/{subscriptionName}/diagnosticInfo")
            .replaceAll(
                "/events/subscriptions/id/[^/]+/failedEvents",
                "/events/subscriptions/id/{id}/failedEvents")
            .replaceAll(
                "/events/subscriptions/name/[^/]+/failedEvents",
                "/events/subscriptions/name/{eventSubscriptionName}/failedEvents")
            .replaceAll(
                "/events/subscriptions/id/[^/]+/listSuccessfullySentChangeEvents",
                "/events/subscriptions/id/{id}/listSuccessfullySentChangeEvents")
            .replaceAll(
                "/events/subscriptions/name/[^/]+/listSuccessfullySentChangeEvents",
                "/events/subscriptions/name/{eventSubscriptionName}/listSuccessfullySentChangeEvents")
            .replaceAll(
                "/events/subscriptions/id/[^/]+/destinations",
                "/events/subscriptions/id/{eventSubscriptionId}/destinations")
            .replaceAll(
                "/events/subscriptions/name/[^/]+/destinations",
                "/events/subscriptions/name/{eventSubscriptionName}/destinations")
            .replaceAll(
                "/events/subscriptions/name/[^/]+/syncOffset",
                "/events/subscriptions/name/{eventSubscriptionName}/syncOffset")
            // App management patterns
            .replaceAll("/apps/name/[^/]+/status", "/apps/name/{name}/status")
            .replaceAll("/apps/name/[^/]+/extension", "/apps/name/{name}/extension")
            .replaceAll("/apps/name/[^/]+/logs", "/apps/name/{name}/logs")
            .replaceAll("/apps/name/[^/]+/runs/latest", "/apps/name/{name}/runs/latest")
            .replaceAll("/apps/schedule/[^/]+", "/apps/schedule/{name}")
            .replaceAll("/apps/configure/[^/]+", "/apps/configure/{name}")
            .replaceAll("/apps/trigger/[^/]+", "/apps/trigger/{name}")
            .replaceAll("/apps/stop/[^/]+", "/apps/stop/{name}")
            .replaceAll("/apps/deploy/[^/]+", "/apps/deploy/{name}")
            // IngestionPipeline operational patterns
            .replaceAll(
                "/services/ingestionPipelines/deploy/[^/]+",
                "/services/ingestionPipelines/deploy/{id}")
            .replaceAll(
                "/services/ingestionPipelines/trigger/[^/]+",
                "/services/ingestionPipelines/trigger/{id}")
            .replaceAll(
                "/services/ingestionPipelines/toggleIngestion/[^/]+",
                "/services/ingestionPipelines/toggleIngestion/{id}")
            .replaceAll(
                "/services/ingestionPipelines/kill/[^/]+", "/services/ingestionPipelines/kill/{id}")
            .replaceAll(
                "/services/ingestionPipelines/logs/[^/]+/last",
                "/services/ingestionPipelines/logs/{id}/last")
            .replaceAll(
                "/services/ingestionPipelines/[^/]+/pipelineStatus/[^/]+",
                "/services/ingestionPipelines/{fqn}/pipelineStatus/{id}")
            .replaceAll(
                "/services/ingestionPipelines/[^/]+/pipelineStatus",
                "/services/ingestionPipelines/{fqn}/pipelineStatus")
            // Search resource patterns
            .replaceAll("/search/get/[^/]+/doc/[^/]+", "/search/get/{index}/doc/{id}")
            // User authentication & security patterns
            .replaceAll("/users/generateToken/[^/]+", "/users/generateToken/{id}")
            .replaceAll("/users/token/[^/]+", "/users/token/{id}")
            .replaceAll("/users/auth-mechanism/[^/]+", "/users/auth-mechanism/{id}")
            // Feed & discussion patterns
            .replaceAll("/feed/tasks/[^/]+/resolve", "/feed/tasks/{id}/resolve")
            .replaceAll("/feed/tasks/[^/]+/close", "/feed/tasks/{id}/close")
            .replaceAll("/feed/tasks/[^/]+", "/feed/tasks/{id}")
            .replaceAll("/feed/[^/]+/posts/[^/]+", "/feed/{threadId}/posts/{postId}")
            .replaceAll("/feed/[^/]+/posts", "/feed/{id}/posts")
            .replaceAll("/feed/[^/]+", "/feed/{threadId}")
            // System & configuration patterns
            .replaceAll("/system/settings/[^/]+", "/system/settings/{name}")
            .replaceAll("/system/settings/reset/[^/]+", "/system/settings/reset/{name}")
            // DocStore patterns
            .replaceAll(
                "/docStore/validateTemplate/[^/]+", "/docStore/validateTemplate/{templateName}")
            // Handle remaining timestamp patterns
            .replaceAll("/[0-9]{10,13}", "/{timestamp}");

    // Ensure we don't have empty path segments
    normalizedUri = normalizedUri.replaceAll("/+", "/");

    // Limit to reasonable URI length to prevent edge cases
    if (normalizedUri.length() > 100) {
      // For very long URIs, just use the first few path segments
      String[] segments = normalizedUri.split("/");
      if (segments.length > 5) {
        normalizedUri = String.join("/", java.util.Arrays.copyOfRange(segments, 0, 5)) + "/...";
      }
    }

    return normalizedUri.isEmpty() ? "/" : normalizedUri;
  }

  private String getStatusClass(int status) {
    if (status >= 100 && status < 200) return "1xx";
    if (status >= 200 && status < 300) return "2xx";
    if (status >= 300 && status < 400) return "3xx";
    if (status >= 400 && status < 500) return "4xx";
    if (status >= 500 && status < 600) return "5xx";
    return "unknown";
  }

  public MeterRegistry getMeterRegistry() {
    return meterRegistry;
  }
}

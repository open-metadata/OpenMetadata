package org.openmetadata.service.monitoring;

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
    this.httpRequestTimer = Timer.builder("http.server.requests")
        .description("HTTP server request duration")
        .publishPercentileHistogram()
        .serviceLevelObjectives(
            Duration.ofMillis(50), 
            Duration.ofMillis(100), 
            Duration.ofMillis(500),
            Duration.ofSeconds(1))
        .register(meterRegistry);
    
    this.httpRequestCounter = Counter.builder("http.server.requests.total")
        .description("Total number of HTTP requests")
        .register(meterRegistry);
        
    this.httpResponseSize = DistributionSummary.builder("http.server.response.size")
        .description("HTTP response size in bytes")
        .baseUnit("bytes")
        .publishPercentileHistogram()
        .register(meterRegistry);
    
    // Initialize Database metrics
    this.jdbiQueryTimer = Timer.builder("db.query.duration")
        .description("Database query duration")
        .publishPercentileHistogram()
        .serviceLevelObjectives(
            Duration.ofMillis(10),
            Duration.ofMillis(50),
            Duration.ofMillis(100))
        .register(meterRegistry);
        
    this.jdbiConnectionCounter = Counter.builder("db.connections.total")
        .description("Total database connections created")
        .register(meterRegistry);
        
    this.jdbiErrorCounter = Counter.builder("db.errors.total")
        .description("Total database errors")
        .register(meterRegistry);
    
    // Initialize Business metrics
    this.entityCreatedCounter = Counter.builder("entity.operations")
        .description("Number of entity operations")
        .tag("operation", "create")
        .register(meterRegistry);
        
    this.entityUpdatedCounter = Counter.builder("entity.operations")
        .description("Number of entity operations")
        .tag("operation", "update")
        .register(meterRegistry);
        
    this.entityDeletedCounter = Counter.builder("entity.operations")
        .description("Number of entity operations")
        .tag("operation", "delete")
        .register(meterRegistry);
        
    this.searchQueryCounter = Counter.builder("search.queries.total")
        .description("Total number of search queries")
        .register(meterRegistry);
    
    // Initialize Pipeline metrics
    this.pipelineStatusCounter = Counter.builder("pipeline.status")
        .description("Pipeline execution status")
        .register(meterRegistry);
        
    this.pipelineExecutionTimer = Timer.builder("pipeline.execution.duration")
        .description("Pipeline execution duration")
        .publishPercentileHistogram()
        .register(meterRegistry);
    
    // Initialize Authentication metrics
    this.authenticationAttempts = Counter.builder("auth.attempts.total")
        .description("Total authentication attempts")
        .register(meterRegistry);
        
    this.authenticationFailures = Counter.builder("auth.failures.total")
        .description("Total authentication failures")
        .register(meterRegistry);
  }
  
  // HTTP metric recording methods
  public Timer.Sample startHttpRequestTimer() {
    return Timer.start(meterRegistry);
  }
  
  public void recordHttpRequest(Timer.Sample sample, String method, String uri, int status) {
    sample.stop(Timer.builder("http.server.requests")
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
    sample.stop(Timer.builder("db.query.duration")
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
    meterRegistry.counter("entity.operations",
        "type", entityType,
        "operation", "create")
        .increment();
  }
  
  public void recordEntityUpdated(String entityType) {
    meterRegistry.counter("entity.operations",
        "type", entityType,
        "operation", "update")
        .increment();
  }
  
  public void recordEntityDeleted(String entityType) {
    meterRegistry.counter("entity.operations",
        "type", entityType,
        "operation", "delete")
        .increment();
  }
  
  public void recordSearchQuery(String searchType, int resultCount) {
    meterRegistry.counter("search.queries.total",
        "type", searchType,
        "has_results", String.valueOf(resultCount > 0))
        .increment();
        
    meterRegistry.summary("search.results.count",
        "type", searchType)
        .record(resultCount);
  }
  
  // Pipeline metric recording methods
  public void recordPipelineStatus(String pipelineName, String status) {
    meterRegistry.counter("pipeline.status",
        "name", pipelineName,
        "status", status)
        .increment();
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
    meterRegistry.counter("auth.attempts.total",
        "type", authType)
        .increment();
  }
  
  public void recordAuthenticationFailure(String authType, String reason) {
    meterRegistry.counter("auth.failures.total",
        "type", authType,
        "reason", reason)
        .increment();
  }
  
  // Gauge registration methods
  public void registerGauge(String name, java.util.function.Supplier<Number> supplier, String description) {
    io.micrometer.core.instrument.Gauge.builder(name, () -> supplier.get().doubleValue())
        .description(description)
        .register(meterRegistry);
  }
  
  // Utility methods
  private String normalizeUri(String uri) {
    // Normalize URIs to avoid high cardinality
    // Replace IDs with placeholders
    return uri.replaceAll("/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{id}")
        .replaceAll("/[0-9]+", "/{id}");
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
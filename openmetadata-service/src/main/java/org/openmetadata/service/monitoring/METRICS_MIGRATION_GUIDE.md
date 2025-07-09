# Metrics Migration Guide

This guide helps migrate from the legacy metrics system to the new Micrometer-based implementation.

## Overview

The new metrics system provides:
- Pure Micrometer API (no direct Prometheus client usage)
- Automatic HTTP and database metrics collection
- Better performance and lower memory footprint
- Easier to add new metrics
- Vendor-neutral (can export to multiple monitoring systems)

## Migration Steps

### 1. Replace MicrometerBundleSingleton with MicrometerBundle

In `OpenMetadataApplication.java`:

```java
// Old
bootstrap.addBundle(MicrometerBundleSingleton.getInstance());

// New
bootstrap.addBundle(new MicrometerBundle());
```

### 2. Update HTTP Metrics Usage

Replace direct histogram usage with OpenMetadataMetrics:

```java
// Old
import static org.openmetadata.service.util.MicrometerBundleSingleton.httpRequests;

httpRequests.labels(method).observe(duration);

// New
@Inject OpenMetadataMetrics metrics;

metrics.recordHttpRequest(method, uri, status, durationMs);
```

### 3. Update Database Metrics Usage

Replace JDBI metrics:

```java
// Old
import static org.openmetadata.service.util.MicrometerBundleSingleton.jdbiRequests;

jdbiRequests.observe(duration);

// New
@Inject OpenMetadataMetrics metrics;

Timer.Sample sample = metrics.startDatabaseQueryTimer();
// ... execute query ...
metrics.recordDatabaseQuery(sample, "select", true);
```

### 4. Update Pipeline Client Metrics

```java
// Old
import static org.openmetadata.service.util.MicrometerBundleSingleton.pipelineClientStatusCounter;

pipelineClientStatusCounter.labels(operation, String.valueOf(statusCode)).inc();

// New
@Inject OpenMetadataMetrics metrics;

metrics.getMeterRegistry()
    .counter("pipeline.client.request.status", 
             "operation", operation, 
             "status", String.valueOf(statusCode))
    .increment();
```

### 5. Add Business Metrics

The new system makes it easy to add business metrics:

```java
@Inject OpenMetadataMetrics metrics;

// Entity operations
metrics.recordEntityCreated("table");
metrics.recordEntityUpdated("dashboard");
metrics.recordEntityDeleted("pipeline");

// Search metrics
metrics.recordSearchQuery("fulltext", resultCount);

// Authentication metrics
metrics.recordAuthenticationAttempt("basic");
metrics.recordAuthenticationFailure("oauth", "invalid_token");
```

### 6. Register Custom Gauges

```java
metrics.registerGauge(
    "cache.size",
    () -> cache.size(),
    "Current cache size"
);
```

## Complete Migration

The migration is now complete. All references to MicrometerBundleSingleton have been replaced:

1. `OpenMetadataApplication.java` - Now uses `new MicrometerBundle()`
2. `OMSqlLogger.java` - Uses `Metrics.timer()` directly
3. `OMMicrometerHttpFilter.java` - Uses `Metrics.timer()` and `Metrics.globalRegistry`
4. `MeteredPipelineServiceClient.java` - Uses `Metrics.counter()`
5. `PrometheusEventMonitor.java` - Gets registry from `Metrics.globalRegistry`
6. `ServicesStatusJobHandler.java` - Gets registry from `Metrics.globalRegistry`

The new system provides:
- Pure Micrometer API
- Automatic metric collection via filters
- Better performance
- Easier extensibility

## Testing

Verify metrics are working:

```bash
curl http://localhost:8586/prometheus | grep -E "http_server_requests|entity_operations"
```

## Troubleshooting

1. **Missing metrics**: Check that MicrometerBundle is registered before other bundles
2. **Duplicate metrics**: Ensure you're not registering both old and new bundles
3. **Performance issues**: Review metric cardinality (avoid high-cardinality labels)

## Best Practices

1. Use descriptive metric names following Prometheus conventions
2. Keep label cardinality low (< 100 unique values per label)
3. Use Timer for latency, Counter for counts, Gauge for current values
4. Document all custom metrics in code
5. Set up alerts for critical business metrics
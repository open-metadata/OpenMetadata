package org.openmetadata.service.monitoring;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import jakarta.annotation.Priority;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;

@Provider
@Priority(1)
@Slf4j
public class RequestMetricsFilter implements ContainerRequestFilter, ContainerResponseFilter {

  private static final String REQUEST_START_TIME = "request.start.time";
  private static final String PROCESSING_START_TIME = "processing.start.time";

  private final JettyMetrics jettyMetrics;

  public RequestMetricsFilter(JettyMetrics jettyMetrics) {
    this.jettyMetrics = jettyMetrics;
  }

  @Override
  public void filter(ContainerRequestContext requestContext) throws IOException {
    // Record when request arrived at server
    long requestStartTime = System.nanoTime();

    // Record when processing actually starts (after queue)
    long processingStartTime = System.nanoTime();

    requestContext.setProperty(REQUEST_START_TIME, requestStartTime);
    requestContext.setProperty(PROCESSING_START_TIME, processingStartTime);

    // Calculate queue time (in a real implementation, you'd need request arrival time from Jetty)
    long queueTimeNanos = processingStartTime - requestStartTime;
    long queueTimeMs = TimeUnit.NANOSECONDS.toMillis(queueTimeNanos);

    if (queueTimeMs > 10) { // Log if queued for more than 10ms
      LOG.info(
          "Request queued for {}ms - URI: {} Method: {}",
          queueTimeMs,
          requestContext.getUriInfo().getPath(),
          requestContext.getMethod());
    }

    // Update metrics (safely handle null jettyMetrics)
    if (jettyMetrics != null) {
      try {
        jettyMetrics.recordRequestQueueTime(queueTimeMs);
        jettyMetrics.incrementActiveRequests();
      } catch (Exception e) {
        LOG.debug("JettyMetrics not fully initialized yet, skipping update: {}", e.getMessage());
      }
    }

    // Record queue time metric
    String method = requestContext.getMethod();
    String path = getPathTemplate(requestContext);
    Tags tags = Tags.of("method", method, "path", path);

    Timer.Sample queueSample = Timer.start(Metrics.globalRegistry);
    requestContext.setProperty("queue.timer.sample", queueSample);
  }

  @Override
  public void filter(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext)
      throws IOException {
    // Decrement active requests
    if (jettyMetrics != null) {
      try {
        jettyMetrics.decrementActiveRequests();
      } catch (Exception e) {
        LOG.debug("JettyMetrics not fully initialized yet, skipping decrement: {}", e.getMessage());
      }
    }

    // Calculate total request time
    Long requestStartTime = (Long) requestContext.getProperty(REQUEST_START_TIME);
    Long processingStartTime = (Long) requestContext.getProperty(PROCESSING_START_TIME);

    if (requestStartTime != null) {
      long totalTimeNanos = System.nanoTime() - requestStartTime;
      long totalTimeMs = TimeUnit.NANOSECONDS.toMillis(totalTimeNanos);

      long processingTimeNanos = System.nanoTime() - processingStartTime;
      long processingTimeMs = TimeUnit.NANOSECONDS.toMillis(processingTimeNanos);

      long queueTimeMs = totalTimeMs - processingTimeMs;

      String method = requestContext.getMethod();
      String path = getPathTemplate(requestContext);
      int status = responseContext.getStatus();

      Tags tags =
          Tags.of(
              "method", method,
              "path", path,
              "status", String.valueOf(status));

      // Record metrics
      Timer.builder("http.request.duration")
          .description("Total request duration including queue time")
          .tags(tags)
          .register(Metrics.globalRegistry)
          .record(totalTimeMs, TimeUnit.MILLISECONDS);

      Timer.builder("http.request.processing")
          .description("Request processing time excluding queue time")
          .tags(tags)
          .register(Metrics.globalRegistry)
          .record(processingTimeMs, TimeUnit.MILLISECONDS);

      Timer.builder("http.request.queue")
          .description("Time spent in request queue")
          .tags(tags)
          .register(Metrics.globalRegistry)
          .record(queueTimeMs, TimeUnit.MILLISECONDS);

      // Count requests by status
      Counter.builder("http.requests.total")
          .description("Total HTTP requests")
          .tags(tags)
          .register(Metrics.globalRegistry)
          .increment();

      // Log slow requests
      if (totalTimeMs > 1000) {
        LOG.warn(
            "Slow request detected - Total: {}ms (Queue: {}ms, Processing: {}ms) - {} {}",
            totalTimeMs,
            queueTimeMs,
            processingTimeMs,
            method,
            path);
      }
    }
  }

  private String getPathTemplate(ContainerRequestContext context) {
    // Simplify path for metrics (replace IDs with placeholders)
    String path = context.getUriInfo().getPath();

    // Replace UUIDs with {id}
    path = path.replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "{id}");

    // Replace numbers with {num}
    path = path.replaceAll("/\\d+", "/{num}");

    return path;
  }
}

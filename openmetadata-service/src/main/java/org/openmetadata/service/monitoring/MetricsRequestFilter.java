package org.openmetadata.service.monitoring;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;

/**
 * JAX-RS filter that automatically tracks HTTP request metrics using Micrometer.
 * This filter measures request duration, tracks status codes, and records
 * response sizes for all API endpoints.
 */
@Slf4j
@Provider
@Priority(Priorities.HEADER_DECORATOR)
public class MetricsRequestFilter implements ContainerRequestFilter, ContainerResponseFilter {
  private static final String TIMER_SAMPLE_PROPERTY = "metrics.timer.sample";
  private static final String REQUEST_START_TIME_PROPERTY = "metrics.request.start";
  
  private final OpenMetadataMetrics metrics;
  
  @Inject
  public MetricsRequestFilter(OpenMetadataMetrics metrics) {
    this.metrics = metrics;
  }
  
  @Override
  public void filter(ContainerRequestContext requestContext) throws IOException {
    // Start timing the request
    Timer.Sample sample = metrics.startHttpRequestTimer();
    requestContext.setProperty(TIMER_SAMPLE_PROPERTY, sample);
    requestContext.setProperty(REQUEST_START_TIME_PROPERTY, System.currentTimeMillis());
  }
  
  @Override
  public void filter(ContainerRequestContext requestContext, 
                    ContainerResponseContext responseContext) throws IOException {
    try {
      // Get timing information
      Timer.Sample sample = (Timer.Sample) requestContext.getProperty(TIMER_SAMPLE_PROPERTY);
      
      // Extract request details
      String method = requestContext.getMethod();
      String uri = requestContext.getUriInfo().getPath();
      int status = responseContext.getStatus();
      
      // Record the request metrics
      if (sample != null) {
        metrics.recordHttpRequest(sample, method, uri, status);
      } else {
        // Fallback if sample is not available
        Long startTime = (Long) requestContext.getProperty(REQUEST_START_TIME_PROPERTY);
        if (startTime != null) {
          long duration = System.currentTimeMillis() - startTime;
          metrics.recordHttpRequest(method, uri, status, duration);
        }
      }
      
      // Record response size if available
      if (responseContext.hasEntity() && responseContext.getLength() > 0) {
        metrics.recordHttpResponseSize(responseContext.getLength());
      }
      
    } catch (Exception e) {
      LOG.warn("Error recording HTTP metrics", e);
    }
  }
}
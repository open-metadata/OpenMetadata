package org.openmetadata.service.monitoring;

import jakarta.annotation.Priority;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;

@Provider
@Priority(1)
@Slf4j
public class RequestMetricsFilter implements ContainerRequestFilter, ContainerResponseFilter {

  private static final String ACTIVE_REQUEST_TRACKED =
      RequestMetricsFilter.class.getName() + ".activeRequestTracked";

  private final JettyMetrics jettyMetrics;

  public RequestMetricsFilter(JettyMetrics jettyMetrics) {
    this.jettyMetrics = jettyMetrics;
  }

  @Override
  public void filter(ContainerRequestContext requestContext) throws IOException {
    if (jettyMetrics == null) {
      return;
    }

    try {
      jettyMetrics.incrementActiveRequests();
      requestContext.setProperty(ACTIVE_REQUEST_TRACKED, Boolean.TRUE);
    } catch (Exception e) {
      LOG.debug("JettyMetrics not fully initialized yet: {}", e.getMessage());
    }
  }

  @Override
  public void filter(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext)
      throws IOException {
    if (!Boolean.TRUE.equals(requestContext.getProperty(ACTIVE_REQUEST_TRACKED))) {
      return;
    }
    requestContext.removeProperty(ACTIVE_REQUEST_TRACKED);
    if (jettyMetrics == null) {
      return;
    }
    try {
      jettyMetrics.decrementActiveRequests();
    } catch (Exception e) {
      LOG.debug("JettyMetrics not fully initialized yet: {}", e.getMessage());
    }
  }
}

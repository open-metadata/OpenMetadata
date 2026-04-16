package org.openmetadata.service.monitoring;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import org.junit.jupiter.api.Test;

class RequestMetricsFilterTest {

  @Test
  void requestFilterIncrementsAndTracksWhenMetricsAvailable() {
    JettyMetrics jettyMetrics = mock(JettyMetrics.class);
    RequestMetricsFilter filter = new RequestMetricsFilter(jettyMetrics);
    ContainerRequestContext requestContext = mock(ContainerRequestContext.class);

    filter.filter(requestContext);

    verify(jettyMetrics).incrementActiveRequests();
    verify(requestContext).setProperty(anyString(), eq(Boolean.TRUE));
  }

  @Test
  void requestFilterSkipsTrackingWhenIncrementFails() {
    JettyMetrics jettyMetrics = mock(JettyMetrics.class);
    doThrow(new RuntimeException("not ready")).when(jettyMetrics).incrementActiveRequests();
    RequestMetricsFilter filter = new RequestMetricsFilter(jettyMetrics);
    ContainerRequestContext requestContext = mock(ContainerRequestContext.class);

    filter.filter(requestContext);

    verify(requestContext, never()).setProperty(anyString(), eq(Boolean.TRUE));
  }

  @Test
  void responseFilterDecrementsWhenRequestWasTracked() {
    JettyMetrics jettyMetrics = mock(JettyMetrics.class);
    RequestMetricsFilter filter = new RequestMetricsFilter(jettyMetrics);
    ContainerRequestContext requestContext = mock(ContainerRequestContext.class);
    ContainerResponseContext responseContext = mock(ContainerResponseContext.class);
    when(requestContext.getProperty(anyString())).thenReturn(Boolean.TRUE);

    filter.filter(requestContext, responseContext);

    verify(requestContext).removeProperty(anyString());
    verify(jettyMetrics).decrementActiveRequests();
  }

  @Test
  void responseFilterSkipsDecrementWhenRequestWasNotTracked() {
    JettyMetrics jettyMetrics = mock(JettyMetrics.class);
    RequestMetricsFilter filter = new RequestMetricsFilter(jettyMetrics);
    ContainerRequestContext requestContext = mock(ContainerRequestContext.class);
    ContainerResponseContext responseContext = mock(ContainerResponseContext.class);
    when(requestContext.getProperty(anyString())).thenReturn(null);

    filter.filter(requestContext, responseContext);

    verify(jettyMetrics, never()).decrementActiveRequests();
  }
}

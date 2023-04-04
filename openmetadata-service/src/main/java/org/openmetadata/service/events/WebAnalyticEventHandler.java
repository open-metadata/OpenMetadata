package org.openmetadata.service.events;

import io.micrometer.core.instrument.Counter;
import io.micrometer.prometheus.PrometheusMeterRegistry;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.util.MicrometerBundleSingleton;

@Slf4j
public class WebAnalyticEventHandler implements EventHandler {
  private PrometheusMeterRegistry prometheusMeterRegistry;
  private String clusterName;
  public static final String WEB_ANALYTIC_ENDPOINT = "v1/analytics/web/events/collect";
  private static final String COUNTER_NAME = "web.analytics.events";

  public void init(OpenMetadataApplicationConfig config, Jdbi jdbi) {
    this.prometheusMeterRegistry = MicrometerBundleSingleton.prometheusMeterRegistry;
    this.clusterName = config.getClusterName();
  }

  public Void process(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    UriInfo uriInfo = requestContext.getUriInfo();
    if (uriInfo.getPath().contains(WEB_ANALYTIC_ENDPOINT)) {
      String username = "anonymous";
      if (requestContext.getSecurityContext().getUserPrincipal() != null) {
        username = requestContext.getSecurityContext().getUserPrincipal().getName();
      }
      incrementMetric(username);
    }
    return null;
  }

  private void incrementMetric(String username) {
    Counter.builder(COUNTER_NAME)
        .tags("clusterName", clusterName, "username", username)
        .register(prometheusMeterRegistry)
        .increment();
  }

  public void close() {
    prometheusMeterRegistry.close();
  }
}

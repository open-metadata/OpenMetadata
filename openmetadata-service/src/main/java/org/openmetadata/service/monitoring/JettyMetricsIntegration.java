package org.openmetadata.service.monitoring;

import io.dropwizard.core.setup.Environment;
import io.micrometer.core.instrument.Metrics;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.StatisticsHandler;

/**
 * Integration class to add Jetty metrics to OpenMetadata
 */
@Slf4j
public class JettyMetricsIntegration {

  public static void registerJettyMetrics(Environment environment) {
    try {
      // Get the Jetty server instance from lifecycle
      Server server = null;

      // The server might not be available immediately, so we'll register a lifecycle listener
      environment
          .lifecycle()
          .addServerLifecycleListener(
              new io.dropwizard.lifecycle.ServerLifecycleListener() {
                @Override
                public void serverStarted(Server srv) {
                  try {
                    // Create and register Jetty metrics
                    JettyMetrics jettyMetrics = new JettyMetrics(srv);

                    // Start the metrics
                    jettyMetrics.start();

                    // Bind metrics to Prometheus registry
                    jettyMetrics.bindTo(Metrics.globalRegistry);

                    // Register request metrics filter
                    RequestMetricsFilter requestFilter = new RequestMetricsFilter(jettyMetrics);
                    environment.jersey().register(requestFilter);

                    // Add Jetty Statistics Handler for additional metrics
                    StatisticsHandler statisticsHandler = new StatisticsHandler();
                    statisticsHandler.setHandler(srv.getHandler());
                    srv.setHandler(statisticsHandler);

                    // Register statistics handler metrics
                    registerStatisticsHandlerMetrics(statisticsHandler);

                    LOG.info(
                        "Jetty metrics integration complete - Monitoring enabled for thread pool, queue, and requests");
                  } catch (Exception e) {
                    LOG.error("Failed to register Jetty metrics", e);
                  }
                }
              });

    } catch (Exception e) {
      LOG.error("Failed to register Jetty metrics", e);
    }
  }

  private static void registerStatisticsHandlerMetrics(StatisticsHandler handler) {
    // Request statistics
    Metrics.gauge("jetty.requests.current", handler, StatisticsHandler::getRequestsActive);
    Metrics.gauge("jetty.requests.total", handler, StatisticsHandler::getRequests);
    Metrics.gauge("jetty.requests.failed", handler, h -> h.getResponses5xx());

    // Response time statistics
    Metrics.gauge("jetty.response.time.mean", handler, StatisticsHandler::getRequestTimeMean);
    Metrics.gauge("jetty.response.time.max", handler, StatisticsHandler::getRequestTimeMax);
    Metrics.gauge("jetty.response.time.stddev", handler, StatisticsHandler::getRequestTimeStdDev);

    // Bytes statistics
    Metrics.gauge("jetty.bytes.sent.total", handler, StatisticsHandler::getResponsesBytesTotal);

    // Connection statistics
    Metrics.gauge("jetty.connections.duration.mean", handler, h -> h.getRequestTimeMean());
    Metrics.gauge("jetty.connections.duration.max", handler, h -> h.getRequestTimeMax());

    LOG.info("Jetty StatisticsHandler metrics registered");
  }
}

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

  private static StatisticsHandler statisticsHandler;

  public static void registerJettyMetrics(Environment environment) {
    try {
      LOG.info("Registering Jetty metrics integration...");

      // Create placeholder JettyMetrics that will be initialized later
      JettyMetrics placeholderJettyMetrics = new JettyMetrics(null);

      // Register RequestMetricsFilter BEFORE server starts (when Jersey config is mutable)
      RequestMetricsFilter requestFilter = new RequestMetricsFilter(placeholderJettyMetrics);
      environment.jersey().register(requestFilter);
      LOG.info("RequestMetricsFilter registered with Jersey");

      // Setup StatisticsHandler BEFORE server starts
      statisticsHandler = new StatisticsHandler();
      environment.getApplicationContext().insertHandler(statisticsHandler);
      LOG.info("StatisticsHandler configured for Jetty metrics");

      // Register a lifecycle listener to setup Jetty metrics after server starts
      environment
          .lifecycle()
          .addServerLifecycleListener(
              new io.dropwizard.lifecycle.ServerLifecycleListener() {
                @Override
                public void serverStarted(Server srv) {
                  try {
                    LOG.info("Server started, initializing Jetty metrics...");

                    // Initialize JettyMetrics for thread pool monitoring
                    JettyMetrics jettyMetrics = new JettyMetrics(srv);
                    jettyMetrics.start();
                    jettyMetrics.bindTo(Metrics.globalRegistry);

                    // Register StatisticsHandler metrics now that server is running
                    registerStatisticsHandlerMetrics(statisticsHandler);

                    LOG.info(
                        "Jetty metrics integration complete - Thread pool and request statistics monitoring enabled");
                  } catch (Exception e) {
                    LOG.error("Failed to register Jetty metrics", e);
                  }
                }
              });

    } catch (Exception e) {
      LOG.error("Failed to setup Jetty metrics integration", e);
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

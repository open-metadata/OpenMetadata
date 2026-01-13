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
    // Request statistics - Jetty 12 uses getRequestTotal() instead of deprecated getRequests()
    Metrics.gauge("jetty.requests.current", handler, StatisticsHandler::getRequestsActive);
    Metrics.gauge("jetty.requests.total", handler, StatisticsHandler::getRequestTotal);
    Metrics.gauge("jetty.requests.failed", handler, h -> h.getResponses5xx());
    Metrics.gauge("jetty.requests.active.max", handler, StatisticsHandler::getRequestsActiveMax);

    // Response time statistics (values are in nanoseconds in Jetty 12)
    Metrics.gauge("jetty.response.time.mean", handler, StatisticsHandler::getRequestTimeMean);
    Metrics.gauge("jetty.response.time.max", handler, StatisticsHandler::getRequestTimeMax);
    Metrics.gauge("jetty.response.time.stddev", handler, StatisticsHandler::getRequestTimeStdDev);

    // Bytes statistics - Jetty 12 uses getBytesWritten() instead of getResponsesBytesTotal()
    Metrics.gauge("jetty.bytes.sent.total", handler, StatisticsHandler::getBytesWritten);
    Metrics.gauge("jetty.bytes.received.total", handler, StatisticsHandler::getBytesRead);

    // Response status code statistics
    Metrics.gauge("jetty.responses.1xx", handler, StatisticsHandler::getResponses1xx);
    Metrics.gauge("jetty.responses.2xx", handler, StatisticsHandler::getResponses2xx);
    Metrics.gauge("jetty.responses.3xx", handler, StatisticsHandler::getResponses3xx);
    Metrics.gauge("jetty.responses.4xx", handler, StatisticsHandler::getResponses4xx);
    Metrics.gauge("jetty.responses.5xx", handler, StatisticsHandler::getResponses5xx);

    // Failure statistics
    Metrics.gauge("jetty.failures.total", handler, StatisticsHandler::getFailures);
    Metrics.gauge("jetty.failures.handling", handler, StatisticsHandler::getHandlingFailures);

    LOG.info("Jetty StatisticsHandler metrics registered");
  }
}

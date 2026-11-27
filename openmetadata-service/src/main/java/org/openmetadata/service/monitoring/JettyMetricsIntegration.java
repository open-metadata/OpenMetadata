package org.openmetadata.service.monitoring;

import io.dropwizard.core.setup.Environment;
import io.micrometer.core.instrument.FunctionCounter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import java.util.concurrent.TimeUnit;
import java.util.function.ToDoubleFunction;
import java.util.function.ToIntFunction;
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
      environment.jersey().register(new RequestMetricsFilter(new JettyMetrics(null)));
      StatisticsHandler handler = new StatisticsHandler();
      environment.getApplicationContext().insertHandler(handler);
      environment
          .lifecycle()
          .addServerLifecycleListener(server -> bindJettyMetrics(server, handler));
    } catch (RuntimeException e) {
      LOG.error("Failed to setup Jetty metrics integration", e);
    }
  }

  private static void bindJettyMetrics(Server server, StatisticsHandler handler) {
    try {
      JettyMetrics jettyMetrics = new JettyMetrics(server);
      jettyMetrics.start();
      jettyMetrics.bindTo(Metrics.globalRegistry);
      registerStatisticsHandlerMetrics(Metrics.globalRegistry, handler);
    } catch (RuntimeException e) {
      LOG.error("Failed to register Jetty metrics", e);
    }
  }

  static void registerStatisticsHandlerMetrics(MeterRegistry registry, StatisticsHandler handler) {
    registerLegacyGauges(registry, handler);
    registerRequestCounters(registry, handler);
    registerResponseCounters(registry, handler);
    registerTrafficCounters(registry, handler);
    registerTimeGauge(registry, handler, "max", StatisticsHandler::getRequestTimeMax, "Maximum");
    registerTimeGauge(registry, handler, "mean", StatisticsHandler::getRequestTimeMean, "Mean");
    registerTimeGauge(
        registry,
        handler,
        "stddev",
        StatisticsHandler::getRequestTimeStdDev,
        "Standard deviation of");
    LOG.info("Jetty StatisticsHandler metrics registered");
  }

  private static void registerLegacyGauges(MeterRegistry registry, StatisticsHandler handler) {
    registry.gauge("jetty.requests.current", handler, StatisticsHandler::getRequestsActive);
    registry.gauge("jetty.requests.total", handler, StatisticsHandler::getRequestTotal);
    registry.gauge("jetty.requests.failed", handler, StatisticsHandler::getResponses5xx);
    registry.gauge("jetty.requests.active.max", handler, StatisticsHandler::getRequestsActiveMax);
    registry.gauge("jetty.response.time.mean", handler, StatisticsHandler::getRequestTimeMean);
    registry.gauge("jetty.response.time.max", handler, StatisticsHandler::getRequestTimeMax);
    registry.gauge("jetty.response.time.stddev", handler, StatisticsHandler::getRequestTimeStdDev);
    registry.gauge("jetty.bytes.sent.total", handler, StatisticsHandler::getBytesWritten);
    registry.gauge("jetty.bytes.received.total", handler, StatisticsHandler::getBytesRead);
    registry.gauge("jetty.responses.1xx", handler, StatisticsHandler::getResponses1xx);
    registry.gauge("jetty.responses.2xx", handler, StatisticsHandler::getResponses2xx);
    registry.gauge("jetty.responses.3xx", handler, StatisticsHandler::getResponses3xx);
    registry.gauge("jetty.responses.4xx", handler, StatisticsHandler::getResponses4xx);
    registry.gauge("jetty.responses.5xx", handler, StatisticsHandler::getResponses5xx);
    registry.gauge("jetty.failures.total", handler, StatisticsHandler::getFailures);
    registry.gauge("jetty.failures.handling", handler, StatisticsHandler::getHandlingFailures);
  }

  private static void registerRequestCounters(MeterRegistry registry, StatisticsHandler handler) {
    registerIntCounter(
        registry,
        handler,
        "jetty.http.requests",
        "Total HTTP requests handled by Jetty",
        StatisticsHandler::getRequestTotal);
    registerIntCounter(
        registry,
        handler,
        "jetty.http.request.failures",
        "Total Jetty requests completed with a failure",
        StatisticsHandler::getFailures);
    registerIntCounter(
        registry,
        handler,
        "jetty.http.handler.failures",
        "Total exceptions thrown during Jetty request handling",
        StatisticsHandler::getHandlingFailures);
  }

  private static void registerResponseCounters(MeterRegistry registry, StatisticsHandler handler) {
    registerResponseCounter(registry, handler, "1xx", StatisticsHandler::getResponses1xx);
    registerResponseCounter(registry, handler, "2xx", StatisticsHandler::getResponses2xx);
    registerResponseCounter(registry, handler, "3xx", StatisticsHandler::getResponses3xx);
    registerResponseCounter(registry, handler, "4xx", StatisticsHandler::getResponses4xx);
    registerResponseCounter(registry, handler, "5xx", StatisticsHandler::getResponses5xx);
  }

  private static void registerTrafficCounters(MeterRegistry registry, StatisticsHandler handler) {
    FunctionCounter.builder("jetty.http.sent", handler, StatisticsHandler::getBytesWritten)
        .description("Total HTTP response bytes written by Jetty")
        .baseUnit("bytes")
        .register(registry);
    FunctionCounter.builder("jetty.http.received", handler, StatisticsHandler::getBytesRead)
        .description("Total HTTP request bytes read by Jetty")
        .baseUnit("bytes")
        .register(registry);
  }

  private static void registerIntCounter(
      MeterRegistry registry,
      StatisticsHandler handler,
      String name,
      String description,
      ToIntFunction<StatisticsHandler> getter) {
    FunctionCounter.builder(
            name, handler, stats -> Integer.toUnsignedLong(getter.applyAsInt(stats)))
        .description(description)
        .register(registry);
  }

  private static void registerResponseCounter(
      MeterRegistry registry,
      StatisticsHandler handler,
      String statusClass,
      ToIntFunction<StatisticsHandler> getter) {
    FunctionCounter.builder(
            "jetty.http.responses",
            handler,
            stats -> Integer.toUnsignedLong(getter.applyAsInt(stats)))
        .tag("status_class", statusClass)
        .description("Total HTTP responses handled by Jetty by status class")
        .register(registry);
  }

  private static void registerTimeGauge(
      MeterRegistry registry,
      StatisticsHandler handler,
      String statistic,
      ToDoubleFunction<StatisticsHandler> getter,
      String descriptionPrefix) {
    Gauge.builder(
            "jetty.response.time." + statistic + ".seconds",
            handler,
            stats -> getter.applyAsDouble(stats) / TimeUnit.SECONDS.toNanos(1))
        .baseUnit("seconds")
        .description(descriptionPrefix + " Jetty request duration in seconds")
        .register(registry);
  }
}

package org.openmetadata.service.monitoring;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.time.Duration;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.LocalConnector;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.StatisticsHandler;
import org.eclipse.jetty.util.Callback;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class JettyMetricsIntegrationTest {

  private final PrometheusMeterRegistry registry =
      new PrometheusMeterRegistry(PrometheusConfig.DEFAULT).throwExceptionOnRegistrationFailure();

  @AfterEach
  void closeRegistry() {
    registry.close();
  }

  @Test
  void separatesHttpStatusesFromJettyFailures() throws Exception {
    Server server = new Server();
    LocalConnector connector = new LocalConnector(server);
    server.addConnector(connector);
    StatisticsHandler statistics = new StatisticsHandler(new StatusHandler());
    server.setHandler(statistics);

    try {
      JettyMetricsIntegration.registerStatisticsHandlerMetrics(registry, statistics);
      server.start();

      assertTrue(request(connector, "/success").startsWith("HTTP/1.1 200"));
      assertTrue(request(connector, "/unavailable").startsWith("HTTP/1.1 503"));
      await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(
              () -> {
                assertEquals(2.0, registry.get("jetty.http.requests").functionCounter().count());
                assertResponseCount(registry, "2xx", 1.0);
                assertResponseCount(registry, "5xx", 1.0);
                assertEquals(
                    0.0, registry.get("jetty.http.handler.failures").functionCounter().count());
                assertEquals(1.0, registry.get("jetty.requests.failed").gauge().value());
              });

      assertTrue(request(connector, "/throws").startsWith("HTTP/1.1 500"));
      await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(
              () -> {
                assertEquals(3.0, registry.get("jetty.http.requests").functionCounter().count());
                assertResponseCount(registry, "5xx", 2.0);
                assertEquals(
                    1.0, registry.get("jetty.http.handler.failures").functionCounter().count());
                assertEquals(2.0, registry.get("jetty.requests.failed").gauge().value());
              });
    } finally {
      server.stop();
    }
  }

  @Test
  void scrapesUnsignedCountersAlongsideLegacyGaugesAcrossTheSignedBoundary() {
    StatisticsHandler statistics = mock(StatisticsHandler.class);
    when(statistics.getRequestTotal()).thenReturn(Integer.MAX_VALUE);
    when(statistics.getResponses5xx()).thenReturn(Integer.MIN_VALUE);
    when(statistics.getFailures()).thenReturn(Integer.MIN_VALUE);
    when(statistics.getHandlingFailures()).thenReturn(Integer.MIN_VALUE);
    when(statistics.getBytesWritten()).thenReturn(4_500_000_000L);
    when(statistics.getBytesRead()).thenReturn(5_500_000_000L);

    JettyMetricsIntegration.registerStatisticsHandlerMetrics(registry, statistics);
    assertEquals(Integer.MAX_VALUE, registry.get("jetty.http.requests").functionCounter().count());
    when(statistics.getRequestTotal()).thenReturn(Integer.MIN_VALUE);

    String scrape = registry.scrape();
    assertTrue(
        scrape.contains("# HELP jetty_http_requests_total Total HTTP requests handled by Jetty"));
    assertTrue(scrape.contains("# TYPE jetty_http_requests_total counter"));
    assertTrue(scrape.contains("# TYPE jetty_http_responses_total counter"));
    assertTrue(scrape.contains("# TYPE jetty_requests gauge"));
    assertTrue(scrape.contains("# TYPE jetty_requests_failed gauge"));
    assertResponseCount(registry, "5xx", 2_147_483_648.0);
    assertEquals(2_147_483_648.0, valueOf(scrape, "jetty_http_requests_total"));
    assertEquals(2_147_483_648.0, valueOf(scrape, "jetty_http_request_failures_total"));
    assertEquals(2_147_483_648.0, valueOf(scrape, "jetty_http_handler_failures_total"));
    assertEquals(4_500_000_000.0, valueOf(scrape, "jetty_http_sent_bytes_total"));
    assertEquals(5_500_000_000.0, valueOf(scrape, "jetty_http_received_bytes_total"));
    assertEquals(Integer.MIN_VALUE, valueOf(scrape, "jetty_requests_failed"));

    when(statistics.getRequestTotal()).thenReturn(-1);
    assertEquals(4_294_967_295.0, valueOf(registry.scrape(), "jetty_http_requests_total"));
    when(statistics.getRequestTotal()).thenReturn(0);
    assertEquals(0.0, valueOf(registry.scrape(), "jetty_http_requests_total"));
  }

  @Test
  void keepsLegacyNanosecondsAlongsideSecondsGauges() {
    StatisticsHandler statistics = mock(StatisticsHandler.class);
    when(statistics.getRequestTimeMax()).thenReturn(9_000_000_000L);
    when(statistics.getRequestTimeMean()).thenReturn(3_500_000_000.0);
    when(statistics.getRequestTimeStdDev()).thenReturn(125_000_000.0);

    JettyMetricsIntegration.registerStatisticsHandlerMetrics(registry, statistics);
    String scrape = registry.scrape();

    assertTrue(scrape.contains("# TYPE jetty_response_time_max_seconds gauge"));
    assertEquals(9.0, valueOf(scrape, "jetty_response_time_max_seconds"));
    assertEquals(3.5, valueOf(scrape, "jetty_response_time_mean_seconds"));
    assertEquals(0.125, valueOf(scrape, "jetty_response_time_stddev_seconds"));
    assertEquals(9_000_000_000.0, valueOf(scrape, "jetty_response_time_max"));
    assertEquals(3_500_000_000.0, valueOf(scrape, "jetty_response_time_mean"));
    assertEquals(125_000_000.0, valueOf(scrape, "jetty_response_time_stddev"));
  }

  private static String request(LocalConnector connector, String path) throws Exception {
    return connector.getResponse(
        "GET " + path + " HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");
  }

  private static void assertResponseCount(
      PrometheusMeterRegistry registry, String statusClass, double count) {
    assertEquals(
        count,
        registry
            .get("jetty.http.responses")
            .tag("status_class", statusClass)
            .functionCounter()
            .count());
  }

  private static double valueOf(String scrape, String metric) {
    return scrape
        .lines()
        .filter(line -> line.startsWith(metric + " "))
        .mapToDouble(line -> Double.parseDouble(line.substring(metric.length() + 1)))
        .findFirst()
        .orElseThrow(() -> new AssertionError("Missing sample: " + metric));
  }

  private static class StatusHandler extends Handler.Abstract {
    @Override
    public boolean handle(Request request, Response response, Callback callback) {
      String path = request.getHttpURI().getPath();
      if ("/throws".equals(path)) {
        throw new IllegalStateException("Jetty handler failed");
      }
      response.setStatus("/unavailable".equals(path) ? 503 : 200);
      callback.succeeded();
      return true;
    }
  }
}

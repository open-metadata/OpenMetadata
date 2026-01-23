/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.operator.service;

import com.fasterxml.jackson.core.io.JsonStringEncoder;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * HTTP server for health check endpoints.
 * Provides /health, /ready, and /metrics endpoints for Kubernetes probes
 * and observability.
 *
 * <p>Health checks verify:
 * <ul>
 *   <li>/health - Liveness: operator process is running</li>
 *   <li>/ready - Readiness: operator is ready AND K8s API is accessible (if check is configured)</li>
 * </ul>
 */
public class HealthCheckService {

  private static final Logger LOG = LoggerFactory.getLogger(HealthCheckService.class);

  private final int port;
  private final AtomicBoolean ready = new AtomicBoolean(false);
  private final PrometheusMeterRegistry meterRegistry;
  private final AtomicReference<Supplier<HealthStatus>> k8sHealthCheck = new AtomicReference<>();
  private HttpServer server;

  public HealthCheckService(int port) {
    this.port = port;
    this.meterRegistry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
    registerMetrics();
  }

  /**
   * Set a custom health check that verifies K8s API connectivity.
   * This check is called on each /ready request to ensure the operator
   * can still communicate with the K8s API server.
   *
   * @param healthCheck supplier that returns current health status
   */
  public void setK8sHealthCheck(Supplier<HealthStatus> healthCheck) {
    this.k8sHealthCheck.set(healthCheck);
    LOG.info("Configured K8s API health check");
  }

  /**
   * Start the health check HTTP server.
   */
  public void start() throws IOException {
    server = HttpServer.create(new InetSocketAddress(port), 0);

    // Health endpoint - always returns OK if server is running
    server.createContext("/health", new HealthHandler());

    // Ready endpoint - returns OK only when operator is ready
    server.createContext("/ready", new ReadinessHandler());

    // Metrics endpoint placeholder
    server.createContext("/metrics", new MetricsHandler());

    server.setExecutor(null); // Use default executor
    server.start();

    LOG.info("Health check server started on port {}", port);
  }

  /**
   * Stop the health check HTTP server.
   */
  public void stop() {
    if (server != null) {
      server.stop(0);
      LOG.info("Health check server stopped");
    }
  }

  /**
   * Mark the operator as ready.
   */
  public void setReady(boolean ready) {
    this.ready.set(ready);
    LOG.debug("Operator readiness set to: {}", ready);
  }

  public MeterRegistry getMeterRegistry() {
    return meterRegistry;
  }

  private void registerMetrics() {
    Gauge.builder("omjob_operator_ready", ready, value -> value.get() ? 1 : 0)
        .description("Operator readiness status")
        .register(meterRegistry);

    String version =
        HealthCheckService.class.getPackage() != null
            ? HealthCheckService.class.getPackage().getImplementationVersion()
            : null;
    if (version == null || version.isBlank()) {
      version = "unknown";
    }

    Gauge.builder("omjob_operator_info", () -> 1)
        .description("Operator build info")
        .tag("version", version)
        .register(meterRegistry);
  }

  /**
   * Health handler - always returns 200 OK.
   */
  private class HealthHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      String response = "{\"status\":\"UP\",\"timestamp\":\"" + System.currentTimeMillis() + "\"}";

      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, response.getBytes(StandardCharsets.UTF_8).length);

      try (OutputStream os = exchange.getResponseBody()) {
        os.write(response.getBytes(StandardCharsets.UTF_8));
      }
    }
  }

  /**
   * Readiness handler - returns 200 only when operator is ready and K8s API is accessible.
   */
  private class ReadinessHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      HealthStatus status = checkReadiness();

      String escapedMessage = escapeJson(status.message() != null ? status.message() : "");
      String response =
          String.format(
              "{\"status\":\"%s\",\"k8sApi\":\"%s\",\"message\":\"%s\",\"timestamp\":\"%d\"}",
              status.isHealthy() ? "READY" : "NOT_READY",
              status.isK8sApiAccessible() ? "UP" : "DOWN",
              escapedMessage,
              System.currentTimeMillis());

      int statusCode = status.isHealthy() ? 200 : 503;

      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(statusCode, response.getBytes(StandardCharsets.UTF_8).length);

      try (OutputStream os = exchange.getResponseBody()) {
        os.write(response.getBytes(StandardCharsets.UTF_8));
      }
    }
  }

  private static String escapeJson(String value) {
    return new String(JsonStringEncoder.getInstance().quoteAsString(value));
  }

  /**
   * Check overall readiness including K8s API connectivity.
   */
  private HealthStatus checkReadiness() {
    if (!ready.get()) {
      return new HealthStatus(false, false, "Operator not ready");
    }

    Supplier<HealthStatus> healthCheck = k8sHealthCheck.get();
    if (healthCheck != null) {
      try {
        return healthCheck.get();
      } catch (Exception e) {
        LOG.warn("K8s health check failed: {}", e.getMessage());
        return new HealthStatus(false, false, "K8s API check failed: " + e.getMessage());
      }
    }

    // No K8s health check configured, just return based on ready flag
    return new HealthStatus(true, true, "OK");
  }

  /**
   * Health status record for readiness checks.
   *
   * @param isHealthy overall health status
   * @param isK8sApiAccessible whether K8s API is accessible
   * @param message optional status message
   */
  public record HealthStatus(boolean isHealthy, boolean isK8sApiAccessible, String message) {}

  /**
   * Simple metrics handler placeholder.
   */
  private class MetricsHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      String response = meterRegistry.scrape();

      exchange.getResponseHeaders().set("Content-Type", "text/plain; version=0.0.4");
      exchange.sendResponseHeaders(200, response.getBytes(StandardCharsets.UTF_8).length);

      try (OutputStream os = exchange.getResponseBody()) {
        os.write(response.getBytes(StandardCharsets.UTF_8));
      }
    }
  }
}

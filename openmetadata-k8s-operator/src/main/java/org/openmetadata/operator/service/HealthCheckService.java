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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Simple HTTP server for health check endpoints.
 * Provides /health and /ready endpoints for Kubernetes probes.
 */
public class HealthCheckService {

  private static final Logger LOG = LoggerFactory.getLogger(HealthCheckService.class);

  private final int port;
  private final AtomicBoolean ready = new AtomicBoolean(false);
  private final PrometheusMeterRegistry meterRegistry;
  private HttpServer server;

  public HealthCheckService(int port) {
    this.port = port;
    this.meterRegistry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
    registerMetrics();
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
   * Readiness handler - returns 200 only when operator is ready.
   */
  private class ReadinessHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      if (ready.get()) {
        String response =
            "{\"status\":\"READY\",\"timestamp\":\"" + System.currentTimeMillis() + "\"}";

        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.getBytes(StandardCharsets.UTF_8).length);

        try (OutputStream os = exchange.getResponseBody()) {
          os.write(response.getBytes(StandardCharsets.UTF_8));
        }
      } else {
        String response =
            "{\"status\":\"NOT_READY\",\"timestamp\":\"" + System.currentTimeMillis() + "\"}";

        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(503, response.getBytes(StandardCharsets.UTF_8).length);

        try (OutputStream os = exchange.getResponseBody()) {
          os.write(response.getBytes(StandardCharsets.UTF_8));
        }
      }
    }
  }

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

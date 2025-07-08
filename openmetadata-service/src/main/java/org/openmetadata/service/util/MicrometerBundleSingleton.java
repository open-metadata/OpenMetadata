package org.openmetadata.service.util;

import com.codahale.metrics.MetricRegistry;
import io.micrometer.core.instrument.Clock;
import io.micrometer.core.instrument.dropwizard.DropwizardConfig;
import io.micrometer.core.instrument.dropwizard.DropwizardMeterRegistry;
import io.micrometer.core.instrument.util.HierarchicalNameMapper;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import io.prometheus.client.CollectorRegistry;
import io.prometheus.client.dropwizard.DropwizardExports;
import lombok.Getter;

public class MicrometerBundleSingleton {
  @Getter private static final MetricRegistry metrics = new MetricRegistry();

  @Getter
  private static final CollectorRegistry collectorRegistry = CollectorRegistry.defaultRegistry;

  @Getter
  public static final PrometheusMeterRegistry prometheusMeterRegistry =
      new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);

  private static final DropwizardMeterRegistry dropwizardRegistry;

  static {
    // Create a DropwizardConfig
    DropwizardConfig config =
        new DropwizardConfig() {
          @Override
          public String prefix() {
            return "dropwizard";
          }

          @Override
          public String get(String key) {
            return null;
          }
        };

    // Create concrete implementation of DropwizardMeterRegistry
    dropwizardRegistry =
        new DropwizardMeterRegistry(config, metrics, HierarchicalNameMapper.DEFAULT, Clock.SYSTEM) {
          @Override
          protected Double nullGaugeValue() {
            return 0.0;
          }
        };

    // Register Dropwizard metrics with Prometheus
    new DropwizardExports(metrics).register();
  }

  @Getter private static io.micrometer.core.instrument.Timer requestsLatencyTimer;
  @Getter private static io.micrometer.core.instrument.Timer jdbiLatencyTimer;

  private MicrometerBundleSingleton() {}

  private static final double[] latencyBuckets = new double[] {.01, .1, 1, 2, 5, 10, 20, 60};

  public static final io.prometheus.client.Histogram httpRequests =
      io.prometheus.client.Histogram.build()
          .name("http_server_requests_sec")
          .help("HTTP methods duration")
          .labelNames("method")
          .buckets(latencyBuckets)
          .register();

  public static final io.prometheus.client.Histogram jdbiRequests =
      io.prometheus.client.Histogram.build()
          .name("jdbi_requests_seconds")
          .help("jdbi requests duration distribution")
          .buckets(latencyBuckets)
          .register();

  public static final io.prometheus.client.Counter pipelineClientStatusCounter =
      io.prometheus.client.Counter.build()
          .name("pipeline_client_request_status")
          .help("status codes returned by pipeline client by operation")
          .labelNames("operation", "status")
          .register();

  public static void initLatencyEvents() {
    requestsLatencyTimer =
        io.micrometer.core.instrument.Timer.builder("http_latency_requests")
            .description("HTTP request latency in seconds")
            .register(prometheusMeterRegistry);

    jdbiLatencyTimer =
        io.micrometer.core.instrument.Timer.builder("jdbi_latency_requests")
            .description("JDBI queries latency in seconds")
            .register(prometheusMeterRegistry);
  }
}

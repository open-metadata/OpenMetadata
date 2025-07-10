package org.openmetadata.service.util;

import com.codahale.metrics.MetricRegistry;
import io.dropwizard.core.ConfiguredBundle;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.micrometer.core.instrument.Clock;
import io.micrometer.core.instrument.dropwizard.DropwizardConfig;
import io.micrometer.core.instrument.dropwizard.DropwizardMeterRegistry;
import io.micrometer.core.instrument.util.HierarchicalNameMapper;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import io.prometheus.client.CollectorRegistry;
import io.prometheus.client.dropwizard.DropwizardExports;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.Getter;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MicrometerBundleSingleton implements ConfiguredBundle<OpenMetadataApplicationConfig> {
  private static final Logger LOG = LoggerFactory.getLogger(MicrometerBundleSingleton.class);
  private static final MicrometerBundleSingleton INSTANCE = new MicrometerBundleSingleton();

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
          public @NotNull String prefix() {
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
          protected @NotNull Double nullGaugeValue() {
            return 0.0;
          }
        };

    // Register Dropwizard metrics with Prometheus
    new DropwizardExports(metrics).register();

    // Initialize JVM and system metrics
    new io.micrometer.core.instrument.binder.jvm.ClassLoaderMetrics()
        .bindTo(prometheusMeterRegistry);
    new io.micrometer.core.instrument.binder.jvm.JvmMemoryMetrics().bindTo(prometheusMeterRegistry);
    new io.micrometer.core.instrument.binder.jvm.JvmGcMetrics().bindTo(prometheusMeterRegistry);
    new io.micrometer.core.instrument.binder.jvm.JvmThreadMetrics().bindTo(prometheusMeterRegistry);
    new io.micrometer.core.instrument.binder.jvm.JvmHeapPressureMetrics()
        .bindTo(prometheusMeterRegistry);
    new io.micrometer.core.instrument.binder.system.ProcessorMetrics()
        .bindTo(prometheusMeterRegistry);
    new io.micrometer.core.instrument.binder.system.UptimeMetrics().bindTo(prometheusMeterRegistry);
    new io.micrometer.core.instrument.binder.system.FileDescriptorMetrics()
        .bindTo(prometheusMeterRegistry);
    new io.micrometer.core.instrument.binder.logging.LogbackMetrics()
        .bindTo(prometheusMeterRegistry);
  }

  @Getter private static io.micrometer.core.instrument.Timer requestsLatencyTimer;
  @Getter private static io.micrometer.core.instrument.Timer jdbiLatencyTimer;

  private MicrometerBundleSingleton() {}

  public static MicrometerBundleSingleton getInstance() {
    return INSTANCE;
  }

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
        io.micrometer.core.instrument.Timer.builder("http.latency.requests")
            .description("HTTP request latency in seconds")
            .register(prometheusMeterRegistry);

    jdbiLatencyTimer =
        io.micrometer.core.instrument.Timer.builder("jdbi.latency.requests")
            .description("JDBI queries latency in seconds")
            .register(prometheusMeterRegistry);
  }

  @Override
  public void initialize(Bootstrap<?> bootstrap) {
    // Nothing to initialize
  }

  @Override
  public void run(OpenMetadataApplicationConfig configuration, Environment environment) {
    // Register Dropwizard's metric registry with the environment
    // This ensures Dropwizard's built-in metrics are available
    environment.metrics().removeMatching((name, metric) -> true);
    environment.metrics().registerAll(metrics);

    // Register Prometheus metrics endpoint on admin connector
    environment
        .admin()
        .addServlet(
            "prometheus",
            new HttpServlet() {
              @Override
              protected void doGet(HttpServletRequest req, HttpServletResponse resp)
                  throws IOException {
                try {
                  resp.setStatus(HttpServletResponse.SC_OK);
                  resp.setContentType("text/plain; version=0.0.4; charset=utf-8");

                  java.io.Writer writer = resp.getWriter();

                  // 1. Write Micrometer metrics
                  String micrometerMetrics = prometheusMeterRegistry.scrape();
                  writer.write(micrometerMetrics);

                  // 2. Write legacy metrics in Prometheus format
                  // This is a temporary solution until we migrate all metrics to Micrometer
                  writer.write(formatLegacyMetrics(micrometerMetrics));

                  writer.flush();
                } catch (IOException e) {
                  LOG.error("Error writing Prometheus metrics", e);
                  throw e; // Re-throw to let the container handle it
                }
              }
            })
        .addMapping("/prometheus");

    LOG.info("Prometheus metrics endpoint registered at admin port on /prometheus");
  }

  private static String formatLegacyMetrics(String existingMetrics) {
    StringBuilder sb = new StringBuilder();

    // Format legacy metrics manually
    // This is a temporary solution until all code is migrated to use Micrometer
    try {
      java.util.Enumeration<io.prometheus.client.Collector.MetricFamilySamples> mfs =
          collectorRegistry.metricFamilySamples();

      while (mfs.hasMoreElements()) {
        io.prometheus.client.Collector.MetricFamilySamples samples = mfs.nextElement();

        // Skip if this metric is already in the Micrometer output
        if (existingMetrics.contains(samples.name + " ")
            || existingMetrics.contains(samples.name + "{")) {
          continue;
        }

        // Write metric help and type
        sb.append("# HELP ").append(samples.name).append(" ").append(samples.help).append("\n");
        sb.append("# TYPE ")
            .append(samples.name)
            .append(" ")
            .append(samples.type.name().toLowerCase())
            .append("\n");

        // Write each sample
        for (io.prometheus.client.Collector.MetricFamilySamples.Sample sample : samples.samples) {
          sb.append(sample.name);

          if (!sample.labelNames.isEmpty()) {
            sb.append("{");
            for (int i = 0; i < sample.labelNames.size(); i++) {
              if (i > 0) sb.append(",");
              sb.append(sample.labelNames.get(i))
                  .append("=\"")
                  .append(escapeLabelValue(sample.labelValues.get(i)))
                  .append("\"");
            }
            sb.append("}");
          }

          sb.append(" ").append(sample.value).append("\n");
        }
      }
    } catch (Exception e) {
      LOG.warn("Error formatting legacy metrics", e);
    }

    return sb.toString();
  }

  private static String escapeLabelValue(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
  }
}

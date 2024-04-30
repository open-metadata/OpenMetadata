/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.util;

import static io.github.maksymdolgykh.dropwizard.micrometer.MicrometerBundle.prometheusRegistry;

import io.github.maksymdolgykh.dropwizard.micrometer.MicrometerBundle;
import io.micrometer.core.instrument.Timer;
import io.micrometer.prometheus.PrometheusMeterRegistry;
import io.prometheus.client.Histogram;
import lombok.Getter;
import org.openmetadata.service.OpenMetadataApplicationConfig;

public class MicrometerBundleSingleton {
  @Getter private static final MicrometerBundle instance = new MicrometerBundle();
  // We'll use this registry to add monitoring around Ingestion Pipelines
  public static final PrometheusMeterRegistry prometheusMeterRegistry = prometheusRegistry;
  @Getter private static Timer requestsLatencyTimer;
  @Getter private static Timer jdbiLatencyTimer;

  private MicrometerBundleSingleton() {}

  private static final double[] latencyBuckets = new double[] {.01, .1, 1, 2, 5, 10, 20, 60};

  public static final Histogram httpRequests =
      Histogram.build()
          .name("http_server_requests_sec")
          .help("HTTP methods duration")
          .labelNames("method")
          .buckets(latencyBuckets)
          .register(prometheusMeterRegistry.getPrometheusRegistry());

  public static final Histogram jdbiRequests =
      Histogram.build()
          .name("jdbi_requests_seconds")
          .help("jdbi requests duration distribution")
          .buckets(latencyBuckets)
          .register(MicrometerBundle.prometheusRegistry.getPrometheusRegistry());

  public static void initLatencyEvents(OpenMetadataApplicationConfig config) {
    requestsLatencyTimer =
        Timer.builder("http_latency_requests")
            .description("HTTP request latency in seconds.")
            .publishPercentiles(config.getEventMonitorConfiguration().getLatency())
            .register(prometheusMeterRegistry);

    jdbiLatencyTimer =
        Timer.builder("jdbi_latency_requests")
            .description("JDBI queries latency in seconds.")
            .publishPercentiles(config.getEventMonitorConfiguration().getLatency())
            .register(prometheusMeterRegistry);
  }
}

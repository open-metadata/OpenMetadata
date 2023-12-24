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
import org.openmetadata.service.OpenMetadataApplicationConfig;

public class MicrometerBundleSingleton {
  private static final MicrometerBundle instance = new MicrometerBundle();
  // We'll use this registry to add monitoring around Ingestion Pipelines
  public static final PrometheusMeterRegistry prometheusMeterRegistry = prometheusRegistry;
  private static Timer webAnalyticEvents;

  private MicrometerBundleSingleton() {}

  public static MicrometerBundle getInstance() {
    return instance;
  }

  public static void setWebAnalyticsEvents(OpenMetadataApplicationConfig config) {
    webAnalyticEvents =
        Timer.builder("latency_requests")
            .description("Request latency in seconds.")
            .publishPercentiles(config.getEventMonitorConfiguration().getLatency())
            .publishPercentileHistogram()
            .register(prometheusMeterRegistry);
  }

  public static Timer getWebAnalyticEvents() {
    return webAnalyticEvents;
  }
}

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

import io.github.maksymdolgykh.dropwizard.micrometer.MicrometerBundle;
import io.micrometer.core.instrument.Timer;
import io.micrometer.prometheus.PrometheusMeterRegistry;

public class MicrometerBundleSingleton {
  private static MicrometerBundle INSTANCE;
  public static Timer webAnalyticEvents;
  public static PrometheusMeterRegistry prometheusMeterRegistry;

  private MicrometerBundleSingleton() {}

  public static MicrometerBundle getInstance() {
    if (INSTANCE == null) {
      INSTANCE = new MicrometerBundle();
      // We'll use this registry to add monitoring around Ingestion Pipelines
      prometheusMeterRegistry = MicrometerBundle.prometheusRegistry;
    }

    return INSTANCE;
  }
}

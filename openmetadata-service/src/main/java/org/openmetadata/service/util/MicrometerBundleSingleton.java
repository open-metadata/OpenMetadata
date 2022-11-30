package org.openmetadata.service.util;

import io.github.maksymdolgykh.dropwizard.micrometer.MicrometerBundle;
import io.micrometer.core.instrument.Timer;

public class MicrometerBundleSingleton {
  private static MicrometerBundle INSTANCE;
  public static Timer webAnalyticEvents;

  private MicrometerBundleSingleton() {}

  public static MicrometerBundle getInstance() {
    if (INSTANCE == null) {
      INSTANCE = new MicrometerBundle();
      webAnalyticEvents = MicrometerBundle.prometheusRegistry.timer("web.analytics.events");
    }

    return INSTANCE;
  }
}

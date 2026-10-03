package org.openmetadata.service.events.subscription;

import java.time.Duration;
import org.openmetadata.service.config.AlertingConfiguration;

/**
 * Every setting of the alerting pipeline, read through this one object so that a test can set any
 * of them without restarting the scheduler. They are this server's own, read when it starts. A
 * zero budget means ticks are never stopped for time.
 */
public record AlertingSettings(Duration tickTimeBudget, boolean skipUnreachableTargetWithinTick) {

  private static volatile AlertingSettings current = from(new AlertingConfiguration());

  public static AlertingSettings current() {
    return current;
  }

  public static void use(AlertingSettings settings) {
    current = settings;
  }

  public static AlertingSettings from(AlertingConfiguration configuration) {
    return new AlertingSettings(
        Duration.ofSeconds(configuration.getTickTimeBudgetSeconds()),
        configuration.isSkipUnreachableTargetWithinTick());
  }

  public boolean hasTimeBudget() {
    return tickTimeBudget.isPositive();
  }
}

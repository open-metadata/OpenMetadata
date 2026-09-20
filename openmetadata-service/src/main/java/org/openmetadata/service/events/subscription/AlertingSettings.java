package org.openmetadata.service.events.subscription;

import java.time.Duration;
import java.util.function.Function;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertMatcherMode;
import org.openmetadata.service.config.AlertingConfiguration;
import org.openmetadata.service.events.subscription.matching.MatcherModes;

/**
 * Every setting of the alerting pipeline, read through this one object so that a test can set any
 * of them without restarting the scheduler. The budget and the skip are this server's own, read
 * when it starts. Which engine decides matching is one value for the cluster, asked for whenever
 * a tick opens. A zero budget means ticks are never stopped for time.
 */
public record AlertingSettings(
    Duration tickTimeBudget,
    boolean skipUnreachableTargetWithinTick,
    Function<AlertType, AlertMatcherMode> matcherMode) {

  private static volatile AlertingSettings current = from(new AlertingConfiguration());

  public AlertingSettings(Duration tickTimeBudget, boolean skipUnreachableTargetWithinTick) {
    this(tickTimeBudget, skipUnreachableTargetWithinTick, MatcherModes::of);
  }

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

  public AlertingSettings withMatcherMode(AlertMatcherMode mode) {
    return new AlertingSettings(tickTimeBudget, skipUnreachableTargetWithinTick, alertType -> mode);
  }

  /** Alerts whose rules were written by hand have no plan, so the stored rules decide them. */
  public AlertMatcherMode matcherModeOf(AlertType alertType) {
    boolean planned = alertType == AlertType.NOTIFICATION || alertType == AlertType.OBSERVABILITY;
    return planned ? matcherMode.apply(alertType) : AlertMatcherMode.STORED;
  }
}

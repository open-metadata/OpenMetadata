package org.openmetadata.service.events.subscription;

import java.time.Duration;
import org.openmetadata.service.config.AlertingConfiguration;

/**
 * Every setting of the alerting pipeline, read through this one object so that a test can set any
 * of them without restarting the scheduler. They are this server's own, read when it starts. A
 * zero budget means ticks are never stopped for time.
 */
public record AlertingSettings(
    Duration tickTimeBudget, boolean skipUnreachableTargetWithinTick, Sending sending) {
  /** How messages leave. The defaults are what the server did before each could be chosen. */
  public record Sending(
      boolean honourWebhookMethod, boolean awaitEmailOutcome, int targetSendConcurrency) {
    public static final Sending AS_BEFORE = new Sending(false, false, 1);
  }

  private static volatile AlertingSettings current = from(new AlertingConfiguration());

  public AlertingSettings(Duration tickTimeBudget, boolean skipUnreachableTargetWithinTick) {
    this(tickTimeBudget, skipUnreachableTargetWithinTick, Sending.AS_BEFORE);
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
        configuration.isSkipUnreachableTargetWithinTick(),
        new Sending(
            configuration.isHonourWebhookMethod(),
            configuration.isAwaitEmailOutcome(),
            configuration.getTargetSendConcurrency()));
  }

  public boolean hasTimeBudget() {
    return tickTimeBudget.isPositive();
  }

  public AlertingSettings withSending(Sending howMessagesLeave) {
    return new AlertingSettings(tickTimeBudget, skipUnreachableTargetWithinTick, howMessagesLeave);
  }
}

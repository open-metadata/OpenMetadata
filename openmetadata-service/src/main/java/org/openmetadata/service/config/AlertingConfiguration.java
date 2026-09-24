package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.AssertTrue;
import lombok.Getter;
import lombok.Setter;

/**
 * Tuning of the alerting pipeline, read when a server starts. Servers with different values are
 * safe during a deploy: each tick uses the value of the server that runs it, and no value affects
 * which server owns a tick.
 */
@Getter
@Setter
public class AlertingConfiguration {

  static final int SMALLEST_TICK_TIME_BUDGET_SECONDS = 10;
  static final int MOST_TARGETS_AT_ONCE = 8;

  /**
   * A tick stops after the event it is processing once it has run this long, commits, and runs
   * again at once. 0 switches the budget off, so a tick always processes its whole batch.
   */
  @JsonProperty private int tickTimeBudgetSeconds = 60;

  /**
   * When true, a target whose connection failed is recorded as failed without another attempt for
   * the rest of that tick.
   */
  @JsonProperty private boolean skipUnreachableTargetWithinTick = false;

  /** When true, a webhook delivery uses the method its destination configures, POST or PUT. */
  @JsonProperty private boolean honourWebhookMethod = false;

  /**
   * When true, an event waits for the mail server's answer to each of its emails, up to the time
   * left in the tick's budget, and a rejection or a wait that runs out is a failed outcome.
   */
  @JsonProperty private boolean awaitEmailOutcome = false;

  /** How many of one event's targets are sent to at the same time. 1 sends one after another. */
  @JsonProperty private int targetSendConcurrency = 1;

  @JsonIgnore
  @AssertTrue(message = "targetSendConcurrency must be between 1 and 8")
  public boolean isTargetSendConcurrencyUsable() {
    return targetSendConcurrency >= 1 && targetSendConcurrency <= MOST_TARGETS_AT_ONCE;
  }

  @JsonIgnore
  @AssertTrue(message = "tickTimeBudgetSeconds must be 0, which switches it off, or at least 10")
  public boolean isTickTimeBudgetUsable() {
    return tickTimeBudgetSeconds == 0 || tickTimeBudgetSeconds >= SMALLEST_TICK_TIME_BUDGET_SECONDS;
  }
}

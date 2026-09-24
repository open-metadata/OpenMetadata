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

  @JsonIgnore
  @AssertTrue(message = "tickTimeBudgetSeconds must be 0, which switches it off, or at least 10")
  public boolean isTickTimeBudgetUsable() {
    return tickTimeBudgetSeconds == 0 || tickTimeBudgetSeconds >= SMALLEST_TICK_TIME_BUDGET_SECONDS;
  }
}

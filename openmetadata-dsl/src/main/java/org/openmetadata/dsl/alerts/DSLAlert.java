package org.openmetadata.dsl.alerts;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;
import org.openmetadata.dsl.core.DSLAction;
import org.openmetadata.dsl.core.DSLCondition;

@Data
@Builder
@Jacksonized
public class DSLAlert {

  @JsonProperty("id")
  private UUID id;

  @JsonProperty("name")
  private String name;

  @JsonProperty("description")
  private String description;

  @JsonProperty("enabled")
  @Builder.Default
  private boolean enabled = true;

  @JsonProperty("condition")
  private DSLCondition condition;

  @JsonProperty("actions")
  private List<DSLAction> actions;

  @JsonProperty("schedule")
  @Builder.Default
  private AlertSchedule schedule = AlertSchedule.REAL_TIME;

  @JsonProperty("metadata")
  private Map<String, Object> metadata;

  @JsonProperty("severity")
  @Builder.Default
  private AlertSeverity severity = AlertSeverity.MEDIUM;

  @JsonProperty("tags")
  private List<String> tags;

  @JsonProperty("owners")
  private List<String> owners;

  @JsonProperty("throttling")
  private AlertThrottling throttling;

  public enum AlertSeverity {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
  }

  public enum AlertSchedule {
    REAL_TIME,
    HOURLY,
    DAILY,
    WEEKLY,
    CUSTOM
  }

  @Data
  @Builder
  @Jacksonized
  public static class AlertThrottling {
    @JsonProperty("enabled")
    private boolean enabled;

    @JsonProperty("duration")
    private Duration duration;

    @JsonProperty("maxAlerts")
    private int maxAlerts;
  }
}

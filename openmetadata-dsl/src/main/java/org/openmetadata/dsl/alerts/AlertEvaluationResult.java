package org.openmetadata.dsl.alerts;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;
import org.openmetadata.dsl.core.DSLExecutionContext;

@Data
@Builder
@Jacksonized
public class AlertEvaluationResult {

  @JsonProperty("alertId")
  private UUID alertId;

  @JsonProperty("conditionMet")
  private boolean conditionMet;

  @JsonProperty("executionTime")
  private long executionTime;

  @JsonProperty("timestamp")
  @Builder.Default
  private long timestamp = System.currentTimeMillis();

  @JsonProperty("context")
  private DSLExecutionContext context;

  @JsonProperty("actionResults")
  private List<ActionExecutionResult> actionResults;

  @JsonProperty("error")
  private String error;

  @JsonProperty("throttled")
  private boolean throttled;

  public boolean isSuccessful() {
    return error == null && conditionMet;
  }

  public boolean hasErrors() {
    return error != null
        || (actionResults != null
            && actionResults.stream().anyMatch(result -> !result.isSuccess()));
  }
}

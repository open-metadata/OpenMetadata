package org.openmetadata.dsl.alerts;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;
import org.openmetadata.dsl.core.DSLAction;

@Data
@Builder
@Jacksonized
public class ActionExecutionResult {

  @JsonProperty("action")
  private DSLAction action;

  @JsonProperty("success")
  private boolean success;

  @JsonProperty("result")
  private Object result;

  @JsonProperty("error")
  private String error;

  @JsonProperty("executionTime")
  private long executionTime;

  @JsonProperty("timestamp")
  @Builder.Default
  private long timestamp = System.currentTimeMillis();

  @JsonProperty("metadata")
  private Object metadata;
}

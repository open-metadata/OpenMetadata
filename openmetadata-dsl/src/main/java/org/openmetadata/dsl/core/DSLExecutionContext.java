package org.openmetadata.dsl.core;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.HashMap;
import java.util.Map;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

@Data
@Builder
@Jacksonized
public class DSLExecutionContext {

  @JsonProperty("variables")
  @Builder.Default
  private Map<String, Object> variables = new HashMap<>();

  @JsonProperty("metadata")
  @Builder.Default
  private Map<String, Object> metadata = new HashMap<>();

  public Object getVariable(String name) {
    return variables.get(name);
  }

  public void setVariable(String name, Object value) {
    variables.put(name, value);
  }

  public boolean hasVariable(String name) {
    return variables.containsKey(name);
  }

  public DSLExecutionContext withVariable(String name, Object value) {
    variables.put(name, value);
    return this;
  }

  public DSLExecutionContext withMetadata(String key, Object value) {
    metadata.put(key, value);
    return this;
  }
}

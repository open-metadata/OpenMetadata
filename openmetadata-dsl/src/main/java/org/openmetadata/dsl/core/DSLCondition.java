package org.openmetadata.dsl.core;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

@Data
@Builder
@Jacksonized
public class DSLCondition {

  @JsonProperty("expression")
  private String expression;

  @JsonProperty("type")
  private String type;

  @JsonProperty("parameters")
  private Object parameters;

  public static DSLCondition of(String expression) {
    return DSLCondition.builder().expression(expression).type("condition").build();
  }

  public static DSLCondition entity(String entityType) {
    return DSLCondition.builder()
        .expression("Entity.ofType(\"" + entityType + "\")")
        .type("entity")
        .build();
  }

  public DSLCondition and(DSLCondition other) {
    return DSLCondition.builder()
        .expression(this.expression + " && " + other.expression)
        .type("logical")
        .build();
  }

  public DSLCondition or(DSLCondition other) {
    return DSLCondition.builder()
        .expression(this.expression + " || " + other.expression)
        .type("logical")
        .build();
  }

  @Override
  public String toString() {
    return expression != null ? expression : "";
  }
}

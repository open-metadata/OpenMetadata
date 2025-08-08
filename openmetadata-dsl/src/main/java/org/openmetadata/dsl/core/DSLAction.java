package org.openmetadata.dsl.core;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;

@Data
@Builder
@Jacksonized
public class DSLAction {

  @JsonProperty("type")
  private String type;

  @JsonProperty("expression")
  private String expression;

  @JsonProperty("config")
  private Map<String, Object> config;

  @JsonProperty("enabled")
  @Builder.Default
  private boolean enabled = true;

  public static DSLAction notify(String destination) {
    return DSLAction.builder()
        .type("notify")
        .expression("Actions.notify().to(\"" + destination + "\")")
        .build();
  }

  public static DSLAction webhook(String url) {
    return DSLAction.builder()
        .type("webhook")
        .expression("Actions.webhook(\"" + url + "\")")
        .build();
  }

  public static DSLAction createTicket(String system) {
    return DSLAction.builder()
        .type("ticket")
        .expression("Actions.createTicket(\"" + system + "\")")
        .build();
  }

  @Override
  public String toString() {
    return expression != null ? expression : type;
  }
}

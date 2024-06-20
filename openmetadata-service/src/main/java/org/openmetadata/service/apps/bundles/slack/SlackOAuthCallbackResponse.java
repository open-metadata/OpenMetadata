package org.openmetadata.service.apps.bundles.slack;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SlackOAuthCallbackResponse {
  @JsonProperty("status")
  private int status;

  @JsonProperty("message")
  private String message;

  public SlackOAuthCallbackResponse(int status, String message) {
    this.status = status;
    this.message = message;
  }
}

package org.openmetadata.service.apps.bundles.slack;

import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class SlackPostMessageRequest {
  @NotNull(message = "Channel ID is required")
  private String channelId;

  @NotNull(message = "Message is required")
  private String message;
}

package org.openmetadata.service.apps.bundles.slack;

import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SlackMessageRequest {
  @NotNull private String channel;
  @NotNull private String message;
  @NotNull private String entityFqn;
  @NotNull private String entityUrl;
  @NotNull private String userName;
  private String serviceType;
}

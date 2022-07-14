package org.openmetadata.catalog.slackChat;

import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SlackChatConfiguration {
  private String apiToken;
  private String botName;
  private List<String> channels;
}

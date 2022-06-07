package org.openmetadata.catalog.slack;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

public class SlackMessage {
  @Getter @Setter private String username;

  @JsonProperty("icon_emoji")
  @Getter
  @Setter
  private String iconEmoji;

  @Getter @Setter private String channel;
  @Getter @Setter private String text;

  @JsonProperty("response_type")
  @Getter
  @Setter
  private String responseType;

  @Getter @Setter private SlackAttachment[] attachments;

  public SlackMessage() {}

  public SlackMessage(String text) {
    this.text = text;
  }

  public SlackMessage encodedMessage() {
    this.setText(this.getText().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"));
    return this;
  }
}

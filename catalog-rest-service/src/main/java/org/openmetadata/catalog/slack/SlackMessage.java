package org.openmetadata.catalog.slack;

import com.fasterxml.jackson.annotation.JsonProperty;

public class SlackMessage {
  private String username;

  @JsonProperty("icon_emoji")
  private String iconEmoji;

  private String channel;
  private String text;

  @JsonProperty("response_type")
  private String responseType;

  private SlackAttachment[] attachments;

  public SlackMessage() {}

  public SlackMessage(String text) {
    this.text = text;
  }

  public SlackMessage encodedMessage() {
    this.setText(this.getText().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"));
    return this;
  }

  public String getUsername() {
    return username;
  }

  public void setUsername(String username) {
    this.username = username;
  }

  public String getIconEmoji() {
    return iconEmoji;
  }

  public void setIconEmoji(String iconEmoji) {
    this.iconEmoji = iconEmoji;
  }

  public String getChannel() {
    return channel;
  }

  public void setChannel(String channel) {
    this.channel = channel;
  }

  public String getText() {
    return text;
  }

  public void setText(String text) {
    this.text = text;
  }

  public String getResponseType() {
    return responseType;
  }

  public void setResponseType(String responseType) {
    this.responseType = responseType;
  }

  public SlackAttachment[] getAttachments() {
    return attachments;
  }

  public void setAttachments(SlackAttachment[] attachments) {
    this.attachments = attachments;
  }
}

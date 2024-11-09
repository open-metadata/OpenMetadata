/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.formatter.decorators;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.email.EmailUtil.getSmtpSettings;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackAttachment;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackMessage;
import org.openmetadata.service.exception.UnhandledServerException;

public class SlackMessageDecorator implements MessageDecorator<SlackMessage> {

  @Override
  public String getBold() {
    return "*%s*";
  }

  @Override
  public String getLineBreak() {
    return "\n";
  }

  @Override
  public String getAddMarker() {
    return "*";
  }

  @Override
  public String getAddMarkerClose() {
    return "*";
  }

  @Override
  public String getRemoveMarker() {
    return "~";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "~";
  }

  public String getEntityUrl(String prefix, String fqn, String additionalParams) {
    return String.format(
        "<%s/%s/%s%s|%s>",
        getSmtpSettings().getOpenMetadataUrl(),
        prefix,
        fqn.trim().replaceAll(" ", "%20"),
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams),
        fqn.trim());
  }

  @Override
  public SlackMessage buildEntityMessage(String publisherName, ChangeEvent event) {
    return getSlackMessage(createEntityMessage(publisherName, event));
  }

  @Override
  public SlackMessage buildTestMessage(String publisherName) {
    return getSlackTestMessage(publisherName);
  }

  @Override
  public SlackMessage buildThreadMessage(String publisherName, ChangeEvent event) {
    return getSlackMessage(createThreadMessage(publisherName, event));
  }

  private SlackMessage getSlackMessage(OutgoingMessage outgoingMessage) {
    if (!outgoingMessage.getMessages().isEmpty()) {
      SlackMessage message = new SlackMessage();
      List<SlackAttachment> attachmentList = new ArrayList<>();
      outgoingMessage.getMessages().forEach(m -> attachmentList.add(getSlackAttachment(m)));
      message.setUsername(outgoingMessage.getUserName());
      message.setText(outgoingMessage.getHeader());
      message.setAttachments(attachmentList.toArray(new SlackAttachment[0]));
      return message;
    }
    throw new UnhandledServerException("No messages found for the event");
  }

  private SlackMessage getSlackTestMessage(String publisherName) {
    if (!publisherName.isEmpty()) {
      SlackMessage message = new SlackMessage();
      message.setUsername("Slack destination test");
      message.setText("Slack has been successfully configured for alerts from: " + publisherName);

      SlackAttachment attachment = new SlackAttachment();
      attachment.setFallback("Slack destination test successful.");
      attachment.setColor("#36a64f"); // Setting a green color to indicate success
      attachment.setTitle("Test Successful");
      attachment.setText(
          "This is a test message from OpenMetadata confirming that your Slack destination is correctly set up to receive alerts.");
      attachment.setFooter("OpenMetadata");
      attachment.setTs(String.valueOf(System.currentTimeMillis() / 1000)); // Adding timestamp

      List<SlackAttachment> attachmentList = new ArrayList<>();
      attachmentList.add(attachment);
      message.setAttachments(attachmentList.toArray(new SlackAttachment[0]));

      return message;
    }
    throw new UnhandledServerException("Publisher name not found.");
  }

  private SlackAttachment getSlackAttachment(String message) {
    SlackAttachment attachment = new SlackAttachment();
    List<String> mark = new ArrayList<>();
    mark.add("text");
    attachment.setMarkdownIn(mark);
    attachment.setText(message);
    return attachment;
  }
}

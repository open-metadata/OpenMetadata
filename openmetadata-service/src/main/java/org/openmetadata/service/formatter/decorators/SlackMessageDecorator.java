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

import static org.openmetadata.service.util.EmailUtil.getSmtpSettings;

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

  public String getEntityUrl(String entityType, String fqn) {
    return String.format(
        "<%s/%s/%s|%s>",
        getSmtpSettings().getOpenMetadataUrl(),
        entityType,
        fqn.trim().replaceAll(" ", "%20"),
        fqn.trim());
  }

  @Override
  public SlackMessage buildEntityMessage(ChangeEvent event) {
    return getSlackMessage(createEntityMessage(event));
  }

  @Override
  public SlackMessage buildThreadMessage(ChangeEvent event) {
    return getSlackMessage(createThreadMessage(event));
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

  private SlackAttachment getSlackAttachment(String message) {
    SlackAttachment attachment = new SlackAttachment();
    List<String> mark = new ArrayList<>();
    mark.add("text");
    attachment.setMarkdownIn(mark);
    attachment.setText(message);
    return attachment;
  }
}

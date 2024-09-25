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

import java.util.Arrays;
import java.util.Date;
import java.util.List;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage.*;
import org.openmetadata.service.exception.UnhandledServerException;

public class GChatMessageDecorator implements MessageDecorator<GChatMessage> {

  @Override
  public String getBold() {
    return "<b>%s</b>";
  }

  @Override
  public String getBoldWithSpace() {
    return "<b>%s</b> ";
  }

  @Override
  public String getLineBreak() {
    return " <br/> ";
  }

  @Override
  public String getAddMarker() {
    return "<b>";
  }

  @Override
  public String getAddMarkerClose() {
    return "</b>";
  }

  @Override
  public String getRemoveMarker() {
    return "<s>";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "</s>";
  }

  @Override
  public String getEntityUrl(String prefix, String fqn, String additionalParams) {
    return String.format(
        "<%s/%s/%s%s|%s>",
        getSmtpSettings().getOpenMetadataUrl(),
        prefix,
        fqn.trim().replace(" ", "%20"),
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams),
        fqn.trim());
  }

  @Override
  public GChatMessage buildEntityMessage(String publisherName, ChangeEvent event) {
    return getGChatMessage(publisherName, event, createEntityMessage(publisherName, event));
  }

  @Override
  public GChatMessage buildTestMessage(String publisherName) {
    return getGChatTestMessage(publisherName);
  }

  @Override
  public GChatMessage buildThreadMessage(String publisherName, ChangeEvent event) {
    return getGChatMessage(publisherName, event, createThreadMessage(publisherName, event));
  }

  private GChatMessage getGChatMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {
    if (outgoingMessage.getMessages().isEmpty()) {
      throw new UnhandledServerException("No messages found for the event");
    }

    return createGeneralChangeEventMessage(publisherName, event, outgoingMessage);
  }

  private GChatMessage getGChatTestMessage(String publisherName) {
    if (publisherName.isEmpty()) {
      throw new UnhandledServerException("Publisher name not found.");
    }

    return createConnectionTestMessage(publisherName);
  }

  public GChatMessage createGeneralChangeEventMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {
    Header header = new Header("Change Event Details", "https://imgur.com/kOOPEG4.png", "IMAGE");

    List<Widget> detailsWidgets =
        List.of(
            createWidget("Event Type:", event.getEventType().value()),
            createWidget("Updated By:", event.getUserName()),
            createWidget("Entity Type:", event.getEntityType()),
            createWidget("Publisher:", publisherName),
            createWidget("Time:", new Date(event.getTimestamp()).toString()));

    List<Widget> additionalMessageWidgets =
        outgoingMessage.getMessages().stream()
            .map(message -> new Widget(new TextParagraph(message)))
            .toList();

    Section detailsSection = new Section(detailsWidgets);
    Section messageSection = new Section(additionalMessageWidgets);
    Section fqnSection =
        new Section(List.of(createWidget("FQN:", getFQNForChangeEventEntity(event))));
    Section footerSection =
        new Section(List.of(new Widget(new TextParagraph("Change Event By OpenMetadata"))));

    Card card =
        new Card(header, List.of(detailsSection, fqnSection, messageSection, footerSection));
    return new GChatMessage(List.of(card));
  }

  public GChatMessage createConnectionTestMessage(String publisherName) {
    Header header =
        new Header("Connection Successful \u2705", "https://imgur.com/kOOPEG4.png", "IMAGE");

    Widget publisherWidget = createWidget("Publisher:", publisherName);

    Widget descriptionWidget =
        new Widget(
            new TextParagraph(
                "This is a Test Message, receiving this message confirms that you have successfully configured OpenMetadata to receive alerts."));

    Widget footerWidget = new Widget(new TextParagraph("Change Event By OpenMetadata."));

    Section publisherSection = new Section(List.of(publisherWidget));
    Section descriptionSection = new Section(List.of(descriptionWidget));
    Section footerSection = new Section(List.of(footerWidget));

    Card card =
        new Card(header, Arrays.asList(publisherSection, descriptionSection, footerSection));

    return new GChatMessage(List.of(card));
  }

  private Widget createWidget(String label, String content) {
    return new Widget(new TextParagraph(String.format(getBoldWithSpace(), label) + content));
  }
}

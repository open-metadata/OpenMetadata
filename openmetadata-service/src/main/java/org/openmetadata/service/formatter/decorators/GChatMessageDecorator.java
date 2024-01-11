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
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage;
import org.openmetadata.service.exception.UnhandledServerException;

public class GChatMessageDecorator implements MessageDecorator<GChatMessage> {

  @Override
  public String getBold() {
    return "<b>%s</b>";
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
  public String getEntityUrl(String entityType, String fqn) {
    return String.format(
        "<%s/%s/%s|%s>",
        getSmtpSettings().getOpenMetadataUrl(),
        entityType,
        fqn.trim().replace(" ", "%20"),
        fqn.trim());
  }

  @Override
  public GChatMessage buildEntityMessage(ChangeEvent event) {
    return getGChatMessage(createEntityMessage(event));
  }

  @Override
  public GChatMessage buildThreadMessage(ChangeEvent event) {
    return getGChatMessage(createThreadMessage(event));
  }

  private GChatMessage getGChatMessage(OutgoingMessage outgoingMessage) {
    if (!outgoingMessage.getMessages().isEmpty()) {
      GChatMessage gChatMessage = new GChatMessage();
      GChatMessage.CardsV2 cardsV2 = new GChatMessage.CardsV2();
      GChatMessage.Card card = new GChatMessage.Card();
      GChatMessage.Section section = new GChatMessage.Section();

      // Header
      gChatMessage.setText("Change Event from OpenMetadata");
      GChatMessage.CardHeader cardHeader = new GChatMessage.CardHeader();
      cardHeader.setTitle(outgoingMessage.getHeader());
      card.setHeader(cardHeader);

      // Attachments
      List<GChatMessage.Widget> widgets = new ArrayList<>();
      outgoingMessage.getMessages().forEach(m -> widgets.add(getGChatWidget(m)));
      section.setWidgets(widgets);
      card.setSections(List.of(section));
      cardsV2.setCard(card);
      gChatMessage.setCardsV2(List.of(cardsV2));

      return gChatMessage;
    }
    throw new UnhandledServerException("No messages found for the event");
  }

  private GChatMessage.Widget getGChatWidget(String message) {
    GChatMessage.Widget widget = new GChatMessage.Widget();
    widget.setTextParagraph(new GChatMessage.TextParagraph(message));
    return widget;
  }
}

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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackMessage;

class PlatformMessageDecoratorTest {

  @Test
  void slackBuildTestMessageCreatesGreenAttachmentWithConnectionText() {
    SlackMessage message = new SlackMessageDecorator().buildTestMessage();

    assertNotNull(message.getAttachments());
    assertEquals(1, message.getAttachments().size());
    assertEquals("#36a64f", message.getAttachments().getFirst().getColor());
    assertFalse(message.getAttachments().getFirst().getBlocks().isEmpty());
  }

  @Test
  void gchatCreatesConnectionAndGeneralChangeMessages() {
    GChatMessageDecorator decorator = new GChatMessageDecorator();

    GChatMessage testMessage = decorator.buildTestMessage();
    assertEquals(1, testMessage.getCards().size());
    assertEquals(
        "Connection Successful ✅", testMessage.getCards().getFirst().getHeader().getTitle());

    OutgoingMessage outgoingMessage = new OutgoingMessage();
    outgoingMessage.setMessages(List.of("Owner changed", "Tag added"));

    ChangeEvent event =
        new ChangeEvent()
            .withEntityType(Entity.TABLE)
            .withEntityFullyQualifiedName("service.sales.orders")
            .withEventType(EventType.ENTITY_UPDATED)
            .withUserName("alice")
            .withTimestamp(1_735_689_600_000L);

    GChatMessage changeMessage =
        decorator.createGeneralChangeEventMessage("publisher", event, outgoingMessage);

    assertEquals(
        "Change Event Details", changeMessage.getCards().getFirst().getHeader().getTitle());
    assertEquals(4, changeMessage.getCards().getFirst().getSections().size());
    assertTrue(
        changeMessage.getCards().getFirst().getSections().stream()
            .flatMap(section -> section.getWidgets().stream())
            .anyMatch(
                widget ->
                    widget.getTextParagraph() != null
                        && "Owner changed".equals(widget.getTextParagraph().getText())));
  }

  @Test
  void teamsBuildTestMessageCreatesAdaptiveCardPayload() {
    TeamsMessage message = new MSTeamsMessageDecorator().buildTestMessage();

    assertEquals("message", message.getType());
    assertEquals(1, message.getAttachments().size());
    assertEquals(
        "application/vnd.microsoft.card.adaptive",
        message.getAttachments().getFirst().getContentType());
    assertFalse(message.getAttachments().getFirst().getContent().getBody().isEmpty());
  }

  @Test
  void feedDecoratorUsesRelativeUrlsAndUiDiffMarkers() {
    FeedMessageDecorator decorator = new FeedMessageDecorator();

    assertEquals(
        "[service.sales.orders](/table/service.sales.orders/activity_feed/all)",
        decorator.getEntityUrl("table", "service.sales.orders", "activity_feed/all"));
    assertEquals("<span data-diff='true' class=\"diff-added\">", decorator.getAddMarker());
    assertEquals("<span data-diff='true' class=\"diff-removed\">", decorator.getRemoveMarker());
    assertEquals("**%s**", decorator.getBold());
  }
}

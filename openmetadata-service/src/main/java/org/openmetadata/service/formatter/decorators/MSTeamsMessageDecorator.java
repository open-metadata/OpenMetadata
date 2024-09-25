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
import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;
import static org.openmetadata.service.util.email.EmailUtil.getSmtpSettings;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.AdaptiveCardContent;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Attachment;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Column;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.ColumnSet;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Image;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.TextBlock;
import org.openmetadata.service.exception.UnhandledServerException;

public class MSTeamsMessageDecorator implements MessageDecorator<TeamsMessage> {

  @Override
  public String getBold() {
    return "**%s**";
  }

  @Override
  public String getLineBreak() {
    return " <br/> ";
  }

  @Override
  public String getAddMarker() {
    return "**";
  }

  @Override
  public String getAddMarkerClose() {
    return "** ";
  }

  @Override
  public String getRemoveMarker() {
    return "~~";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "~~ ";
  }

  @Override
  public String getEntityUrl(String prefix, String fqn, String additionalParams) {
    return String.format(
        "[%s](/%s/%s%s)",
        fqn.trim(),
        getSmtpSettings().getOpenMetadataUrl(),
        prefix,
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams));
  }

  @Override
  public TeamsMessage buildEntityMessage(String publisherName, ChangeEvent event) {
    return getTeamMessage(publisherName, event, createEntityMessage(publisherName, event));
  }

  @Override
  public TeamsMessage buildTestMessage(String publisherName) {
    return getTeamTestMessage(publisherName);
  }

  @Override
  public TeamsMessage buildThreadMessage(String publisherName, ChangeEvent event) {
    OutgoingMessage threadMessage = createThreadMessage(publisherName, event);
    return createGenericTeamsMessage(publisherName, event, threadMessage);
  }

  private TeamsMessage getTeamMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {
    if (!outgoingMessage.getMessages().isEmpty()) {
      return createGenericTeamsMessage(publisherName, event, outgoingMessage);
    }
    throw new UnhandledServerException("No messages found for the event");
  }

  private TeamsMessage createGenericTeamsMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {

    TeamsMessage.Image image =
        TeamsMessage.Image.builder()
            .type("Image")
            .url("https://imgur.com/kOOPEG4.png")
            .size("Small")
            .build();

    TeamsMessage.TextBlock changeEventDetailsTextBlock =
        TeamsMessage.TextBlock.builder()
            .type("TextBlock")
            .text("**Change Event Details**")
            .size("Large")
            .weight("Bolder")
            .wrap(true)
            .build();

    // Create the facts for the FactSet
    List<TeamsMessage.Fact> facts =
        List.of(
            createFact("**Event Type:**", event.getEventType().value()),
            createFact("**Updated By:**", event.getUserName()),
            createFact("**Entity Type:**", event.getEntityType()),
            createFact("**Publisher:** ", publisherName),
            createFact("**Time:**", String.valueOf(new Date(event.getTimestamp()))),
            createFact("**FQN:**", getFQNForChangeEventEntity(event)));

    // Create a list of TextBlocks for each message with a separator
    List<TeamsMessage.TextBlock> messageTextBlocks =
        outgoingMessage.getMessages().stream()
            .map(
                message ->
                    TeamsMessage.TextBlock.builder()
                        .type("TextBlock")
                        .text(message)
                        .wrap(true)
                        .spacing("Medium")
                        .separator(true) // Set separator for each message
                        .build())
            .toList();

    TeamsMessage.TextBlock footerMessage =
        TeamsMessage.TextBlock.builder()
            .type("TextBlock")
            .text("Change Event By OpenMetadata.")
            .size("Small")
            .weight("Lighter")
            .horizontalAlignment("Center")
            .spacing("Medium")
            .separator(true)
            .build();

    TeamsMessage.ColumnSet columnSet =
        TeamsMessage.ColumnSet.builder()
            .type("ColumnSet")
            .columns(
                List.of(
                    TeamsMessage.Column.builder()
                        .type("Column")
                        .items(List.of(image))
                        .width("auto")
                        .build(),
                    TeamsMessage.Column.builder()
                        .type("Column")
                        .items(List.of(changeEventDetailsTextBlock))
                        .width("stretch")
                        .build()))
            .build();

    // Create the body list and combine all elements
    List<TeamsMessage.BodyItem> body = new ArrayList<>();
    body.add(columnSet);
    body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(facts).build());
    body.addAll(messageTextBlocks); // Add the containers with message TextBlocks
    body.add(footerMessage);

    TeamsMessage.Attachment attachment =
        TeamsMessage.Attachment.builder()
            .contentType("application/vnd.microsoft.card.adaptive")
            .content(
                TeamsMessage.AdaptiveCardContent.builder()
                    .type("AdaptiveCard")
                    .version("1.0")
                    .body(body) // Pass the combined body list
                    .build())
            .build();
    return TeamsMessage.builder().type("message").attachments(List.of(attachment)).build();
  }

  public TeamsMessage getTeamTestMessage(String publisherName) {
    if (!publisherName.isEmpty()) {
      return createTestMessage(publisherName);
    }
    throw new UnhandledServerException("Publisher name not found.");
  }

  private TeamsMessage createTestMessage(String publisherName) {
    Image imageItem =
        Image.builder().type("Image").url("https://imgur.com/kOOPEG4.png").size("Small").build();

    Column column1 =
        Column.builder().type("Column").width("auto").items(List.of(imageItem)).build();

    TextBlock textBlock1 =
        TextBlock.builder()
            .type("TextBlock")
            .text("Connection Successful \u2705")
            .weight("Bolder")
            .size("Large")
            .wrap(true)
            .build();

    TextBlock textBlock2 =
        TextBlock.builder()
            .type("TextBlock")
            .text("**Publisher Name:** " + publisherName) // Use publisherName parameter
            .wrap(true)
            .build();

    TextBlock textBlock3 =
        TextBlock.builder()
            .type("TextBlock")
            .text(
                "This is a Test Message, receiving this message confirms that you have successfully configured OpenMetadata to receive alerts.")
            .wrap(true)
            .build();

    Column column2 =
        Column.builder()
            .type("Column")
            .width("stretch")
            .items(List.of(textBlock1, textBlock2, textBlock3))
            .build();

    ColumnSet columnSet =
        ColumnSet.builder().type("ColumnSet").columns(List.of(column1, column2)).build();

    // AdaptiveCardContent
    AdaptiveCardContent adaptiveCardContent =
        AdaptiveCardContent.builder()
            .type("AdaptiveCard")
            .version("1.0")
            .body(
                List.of(
                    columnSet,
                    TextBlock.builder()
                        .type("TextBlock")
                        .text("OpenMetadata")
                        .weight("Lighter")
                        .size("Small")
                        .horizontalAlignment("Center")
                        .spacing("Medium")
                        .build()))
            .build();

    Attachment attachment =
        Attachment.builder()
            .contentType("application/vnd.microsoft.card.adaptive")
            .content(adaptiveCardContent)
            .build();

    TeamsMessage messagePayload =
        TeamsMessage.builder().type("message").attachments(List.of(attachment)).build();

    return messagePayload;
  }

  private String getFQNForChangeEventEntity(ChangeEvent event) {
    return Optional.ofNullable(event.getEntityFullyQualifiedName())
        .filter(fqn -> !CommonUtil.nullOrEmpty(fqn))
        .orElseGet(
            () -> {
              EntityInterface entityInterface = getEntity(event);
              String fqn = entityInterface.getFullyQualifiedName();

              if (CommonUtil.nullOrEmpty(fqn)) {
                EntityInterface result =
                    Entity.getEntity(
                        event.getEntityType(), entityInterface.getId(), "id", Include.NON_DELETED);
                fqn = result.getFullyQualifiedName();
              }

              return fqn;
            });
  }

  private TeamsMessage.Fact createFact(String title, String value) {
    return TeamsMessage.Fact.builder().title(title).value(value).build();
  }
}

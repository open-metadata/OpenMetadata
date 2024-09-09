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
import static org.openmetadata.service.util.EmailUtil.getSmtpSettings;

import com.slack.api.model.block.Blocks;
import com.slack.api.model.block.LayoutBlock;
import com.slack.api.model.block.composition.BlockCompositions;
import com.slack.api.model.block.composition.PlainTextObject;
import com.slack.api.model.block.composition.TextObject;
import com.slack.api.model.block.element.ImageElement;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
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
    return getSlackMessage(publisherName, event, createEntityMessage(publisherName, event));
  }

  @Override
  public SlackMessage buildTestMessage(String publisherName) {
    return getSlackTestMessage(publisherName);
  }

  @Override
  public SlackMessage buildThreadMessage(String publisherName, ChangeEvent event) {
    return getSlackMessage(publisherName, event, createThreadMessage(publisherName, event));
  }

  private SlackMessage getSlackMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {
    if (outgoingMessage.getMessages().isEmpty()) {
      throw new UnhandledServerException("No messages found for the event");
    }

    List<LayoutBlock> messageBlocks = createMessage(publisherName, event, outgoingMessage);
    List<SlackAttachment> attachments = createSlackAttachments();
    return new SlackMessage(messageBlocks, attachments.toArray(new SlackAttachment[0]));
  }

  private List<SlackAttachment> createSlackAttachments() {
    SlackAttachment attachment = new SlackAttachment();
    attachment.setFallback("Slack destination test successful.");
    attachment.setColor("#36a64f");
    attachment.setTitle("OpenMetadata");

    String body =
        """
        Open and unified metadata platform for data discovery, observability, and governance.
        A single place for all your data and all your data practitioners to build and manage
        high-quality data assets at scale.
        """;

    attachment.setText(body);
    attachment.setTs(String.valueOf(System.currentTimeMillis() / 1000)); // Adding timestamp

    List<SlackAttachment> attachmentList = new ArrayList<>();
    attachmentList.add(attachment);
    return attachmentList;
  }

  public SlackMessage getSlackTestMessage(String publisherName) {
    if (publisherName.isEmpty()) {
      throw new UnhandledServerException("Publisher name not found.");
    }

    List<LayoutBlock> blocks = new ArrayList<>();

    // Header Block
    blocks.add(
        Blocks.header(
            header ->
                header.text(
                    PlainTextObject.builder()
                        .text("Connection Successful :white_check_mark: ")
                        .build())));

    // Section Block 1 (Publisher Name)
    blocks.add(
        Blocks.section(
            section ->
                section.text(BlockCompositions.markdownText("*Publisher Name:* alertTable"))));

    // Section Block 2 (Test Message)
    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        "This is a Test Message, receiving this message confirms that you have successfully configured OpenMetadata to receive alerts."))));

    // Divider Block
    blocks.add(Blocks.divider());

    // context
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        ImageElement.builder()
                            .imageUrl("https://i.postimg.cc/0jYLNmM1/image.png")
                            .altText("oss icon")
                            .build(),
                        BlockCompositions.markdownText("*OpenMetadata*")))));

    SlackAttachment attachment = new SlackAttachment();
    attachment.setColor("#36a64f");
    attachment.setBlocks(blocks);

    List<SlackAttachment> attachmentList = new ArrayList<>();
    attachmentList.add(attachment);

    SlackMessage message = new SlackMessage();
    message.setAttachments(attachmentList.toArray(new SlackAttachment[0]));

    return message;
  }

  private List<LayoutBlock> createMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {

    Set<String> entityList = Entity.getEntityList();
    System.out.println(entityList);
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header
    blocks.add(
        Blocks.header(
            header -> header.text(BlockCompositions.plainText("Change Event Details :memo:"))));

    // Info about the event
    List<TextObject> first_field = new ArrayList<>();
    first_field.add(BlockCompositions.markdownText("*Event Type:* " + event.getEventType()));
    first_field.add(BlockCompositions.markdownText("*Updated By:* " + event.getUserName()));
    first_field.add(BlockCompositions.markdownText("*Entity Type:* " + event.getEntityType()));
    first_field.add(BlockCompositions.markdownText("*Publisher:* " + publisherName));
    first_field.add(BlockCompositions.markdownText("*Time:* " + new Date(event.getTimestamp())));

    // Split fields into multiple sections to avoid block limits
    for (int i = 0; i < first_field.size(); i += 10) {
      List<TextObject> sublist = first_field.subList(i, Math.min(i + 10, first_field.size()));
      blocks.add(Blocks.section(section -> section.fields(sublist)));
    }

    String fqnForChangeEventEntity = getFQNForChangeEventEntity(event);

    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText("*FQN: * " + fqnForChangeEventEntity))));

    // divider
    blocks.add(Blocks.divider());

    // desc about the event
    List<String> thread_messages = outgoingMessage.getMessages();
    thread_messages.forEach(
        (message) -> {
          blocks.add(
              Blocks.section(
                  section -> section.text(BlockCompositions.markdownText("> " + message))));
        });

    // Divider
    blocks.add(Blocks.divider());

    // View event link
    String entityUrl = buildClickableEntityUrl(outgoingMessage.getEntityUrl());

    blocks.add(Blocks.section(section -> section.text(BlockCompositions.markdownText(entityUrl))));

    // Context Block
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        ImageElement.builder()
                            .imageUrl("https://i.postimg.cc/0jYLNmM1/image.png")
                            .altText("oss icon")
                            .build(),
                        BlockCompositions.markdownText("Change Event provided by OpenMetadata")))));

    return blocks;
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

  private String buildClickableEntityUrl(String entityUrl) {
    if (entityUrl.startsWith("<") && entityUrl.endsWith(">")) {
      entityUrl = entityUrl.substring(1, entityUrl.length() - 1);
    }

    int pipeIndex = entityUrl.indexOf("|");
    if (pipeIndex != -1) {
      entityUrl = entityUrl.substring(0, pipeIndex);
    }

    return String.format("Access data: <%s|View>", entityUrl);
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

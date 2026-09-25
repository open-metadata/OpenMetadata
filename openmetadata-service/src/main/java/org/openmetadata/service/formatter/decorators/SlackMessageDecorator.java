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
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqnSafe;

import com.slack.api.model.block.Blocks;
import com.slack.api.model.block.LayoutBlock;
import com.slack.api.model.block.composition.BlockCompositions;
import com.slack.api.model.block.composition.PlainTextObject;
import com.slack.api.model.block.element.ImageElement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackMessage;
import org.openmetadata.service.util.email.EmailUtil;

public class SlackMessageDecorator implements MessageDecorator<SlackMessage> {

  @Override
  public String getBold() {
    return "*%s*";
  }

  @Override
  public String getBoldWithSpace() {
    return "*%s* ";
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

  @Override
  public String getEntityUrl(String prefix, String fqn, String additionalParams) {
    String encodedFqn = encodeEntityFqnSafe(fqn);
    return String.format(
        "<%s/%s/%s%s|%s>",
        EmailUtil.getOMBaseURL(),
        prefix,
        encodedFqn, // Use safely encoded FQN in the URL
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams),
        fqn.trim() // Display text remains unencoded
        );
  }

  @Override
  public SlackMessage buildTestMessage() {
    return createConnectionTestMessage();
  }

  public SlackMessage createConnectionTestMessage() {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header Block
    blocks.add(
        Blocks.header(
            header ->
                header.text(
                    PlainTextObject.builder()
                        .text("Connection Successful :white_check_mark: ")
                        .build())));

    // Section Block 1 (Test Message)
    blocks.add(
        Blocks.section(
            section ->
                section.text(BlockCompositions.markdownText(getConnectionTestDescription()))));

    // Divider Block
    blocks.add(Blocks.divider());

    // context
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        ImageElement.builder().imageUrl(getOMImage()).altText("oss icon").build(),
                        BlockCompositions.markdownText(applyBoldFormat(getProductName()))))));

    SlackMessage.Attachment attachment = new SlackMessage.Attachment();
    attachment.setColor("#36a64f"); // green
    attachment.setBlocks(blocks);

    SlackMessage message = new SlackMessage();
    message.setAttachments(Collections.singletonList(attachment));

    return message;
  }

  private String applyBoldFormat(String title) {
    return String.format(getBold(), title);
  }

  private String getOMImage() {
    return getLogoUrl();
  }
}

/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.alerting.channel.slack;

import com.slack.api.model.block.Blocks;
import com.slack.api.model.block.LayoutBlock;
import com.slack.api.model.block.composition.BlockCompositions;
import com.slack.api.model.block.composition.PlainTextObject;
import com.slack.api.model.block.element.ImageElement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.openmetadata.service.alerting.channel.ConnectionTestText;

/** What a Slack destination receives when it is tested: a card saying the connection works. */
public final class SlackTestMessage {
  private SlackTestMessage() {}

  public static SlackMessage build() {
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
                section.text(BlockCompositions.markdownText(ConnectionTestText.description()))));

    // Divider Block
    blocks.add(Blocks.divider());

    // context
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        ImageElement.builder()
                            .imageUrl(ConnectionTestText.logoUrl())
                            .altText("oss icon")
                            .build(),
                        BlockCompositions.markdownText(
                            String.format("*%s*", ConnectionTestText.productName()))))));

    SlackMessage.Attachment attachment = new SlackMessage.Attachment();
    attachment.setColor("#36a64f"); // green
    attachment.setBlocks(blocks);

    SlackMessage message = new SlackMessage();
    message.setAttachments(Collections.singletonList(attachment));

    return message;
  }
}

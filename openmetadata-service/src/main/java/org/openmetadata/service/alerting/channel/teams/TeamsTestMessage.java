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

package org.openmetadata.service.alerting.channel.teams;

import java.util.List;
import org.openmetadata.service.alerting.channel.ConnectionTestText;
import org.openmetadata.service.alerting.channel.teams.TeamsMessage.AdaptiveCardContent;
import org.openmetadata.service.alerting.channel.teams.TeamsMessage.Attachment;
import org.openmetadata.service.alerting.channel.teams.TeamsMessage.Column;
import org.openmetadata.service.alerting.channel.teams.TeamsMessage.ColumnSet;
import org.openmetadata.service.alerting.channel.teams.TeamsMessage.Image;
import org.openmetadata.service.alerting.channel.teams.TeamsMessage.TextBlock;

/** What a Teams destination receives when it is tested: a card saying the connection works. */
public final class TeamsTestMessage {
  private TeamsTestMessage() {}

  public static TeamsMessage build() {
    Image imageItem =
        Image.builder().type("Image").url(ConnectionTestText.logoUrl()).size("Small").build();

    Column column1 =
        Column.builder().type("Column").width("auto").items(List.of(imageItem)).build();

    TextBlock textBlock1 = textBlock("Connection Successful ✅", "Bolder", "Large");
    TextBlock textBlock2 = textBlock(ConnectionTestText.description(), null, null);

    Column column2 =
        Column.builder()
            .type("Column")
            .width("stretch")
            .items(List.of(textBlock1, textBlock2))
            .build();

    ColumnSet columnSet =
        ColumnSet.builder().type("ColumnSet").columns(List.of(column1, column2)).build();

    // Create the footer text block
    TextBlock footerTextBlock = textBlock(ConnectionTestText.productName(), "Lighter", "Small");
    footerTextBlock.setHorizontalAlignment("Center");
    footerTextBlock.setSpacing("Medium");
    footerTextBlock.setSeparator(true);

    AdaptiveCardContent adaptiveCardContent =
        AdaptiveCardContent.builder()
            .type("AdaptiveCard")
            .version("1.0")
            .body(List.of(columnSet, footerTextBlock))
            .build();

    Attachment attachment =
        Attachment.builder()
            .contentType("application/vnd.microsoft.card.adaptive")
            .content(adaptiveCardContent)
            .build();

    return TeamsMessage.builder().type("message").attachments(List.of(attachment)).build();
  }

  private static TextBlock textBlock(String text, String weight, String size) {
    return TextBlock.builder()
        .type("TextBlock")
        .text(text)
        .weight(weight)
        .size(size)
        .wrap(true)
        .build();
  }
}

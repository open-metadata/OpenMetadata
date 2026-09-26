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

import java.util.List;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.AdaptiveCardContent;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Attachment;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Column;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.ColumnSet;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Image;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.TextBlock;
import org.openmetadata.service.util.email.EmailUtil;

public class MSTeamsMessageDecorator implements MessageDecorator<TeamsMessage> {
  private static final String TEST_CASE_RESULT = "testCaseResult";

  @Override
  public String getBold() {
    return "**%s**";
  }

  @Override
  public String getBoldWithSpace() {
    return "**%s** ";
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
    String encodedFqn = encodeEntityFqnSafe(fqn);
    return String.format(
        "[%s](%s/%s/%s%s)",
        fqn.trim(),
        EmailUtil.getOMBaseURL(),
        prefix,
        encodedFqn,
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams));
  }

  @Override
  public TeamsMessage buildTestMessage() {
    return getTeamTestMessage();
  }

  public TeamsMessage getTeamTestMessage() {
    return createConnectionTestMessage();
  }

  private TeamsMessage createConnectionTestMessage() {
    Image imageItem = createOMImageMessage();

    Column column1 =
        Column.builder().type("Column").width("auto").items(List.of(imageItem)).build();

    TextBlock textBlock1 = createTextBlock("Connection Successful ✅", "Bolder", "Large");
    TextBlock textBlock2 = createTextBlock(getConnectionTestDescription(), null, null);

    Column column2 =
        Column.builder()
            .type("Column")
            .width("stretch")
            .items(List.of(textBlock1, textBlock2))
            .build();

    ColumnSet columnSet =
        ColumnSet.builder().type("ColumnSet").columns(List.of(column1, column2)).build();

    // Create the footer text block
    TextBlock footerTextBlock = createTextBlock(getProductName(), "Lighter", "Small");
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

  private TextBlock createTextBlock(String text, String weight, String size) {
    return TextBlock.builder()
        .type("TextBlock")
        .text(text)
        .weight(weight)
        .size(size)
        .wrap(true)
        .build();
  }

  private Image createOMImageMessage() {
    return Image.builder().type("Image").url(getLogoUrl()).size("Small").build();
  }
}

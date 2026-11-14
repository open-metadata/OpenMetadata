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

package org.openmetadata.service.alerting.channel.gchat;

import java.util.Arrays;
import java.util.List;
import org.openmetadata.service.alerting.channel.ConnectionTestText;
import org.openmetadata.service.alerting.channel.gchat.GChatMessage.Card;
import org.openmetadata.service.alerting.channel.gchat.GChatMessage.Header;
import org.openmetadata.service.alerting.channel.gchat.GChatMessage.Section;
import org.openmetadata.service.alerting.channel.gchat.GChatMessage.TextParagraph;
import org.openmetadata.service.alerting.channel.gchat.GChatMessage.Widget;

/** What a Google Chat destination receives when it is tested: a card saying it works. */
public final class GChatTestMessage {
  private GChatTestMessage() {}

  public static GChatMessage build() {
    Header header = new Header("Connection Successful ✅", ConnectionTestText.logoUrl(), "IMAGE");

    Widget descriptionWidget = new Widget(new TextParagraph(ConnectionTestText.description()));

    Section descriptionSection = new Section(List.of(descriptionWidget));
    Section footerSection =
        new Section(
            List.of(
                new Widget(new TextParagraph(ConnectionTestText.productName() + " Change Event"))));

    Card card = new Card(header, Arrays.asList(descriptionSection, footerSection));

    return new GChatMessage(List.of(card));
  }
}

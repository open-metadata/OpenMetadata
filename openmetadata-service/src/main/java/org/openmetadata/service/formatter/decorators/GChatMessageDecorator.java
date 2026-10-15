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

import java.util.Arrays;
import java.util.List;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage.*;
import org.openmetadata.service.util.email.EmailUtil;

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
    String encodedFqn = encodeEntityFqnSafe(fqn);
    return String.format(
        "<%s/%s/%s%s|%s>",
        EmailUtil.getOMBaseURL(),
        prefix,
        encodedFqn,
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams),
        fqn.trim());
  }

  @Override
  public GChatMessage buildTestMessage() {
    return getGChatTestMessage();
  }

  private GChatMessage getGChatTestMessage() {
    return createConnectionTestMessage();
  }

  public GChatMessage createConnectionTestMessage() {
    Header header = createConnectionSuccessfulHeader();

    Widget descriptionWidget = new Widget(new TextParagraph(getConnectionTestDescription()));

    Section descriptionSection = new Section(List.of(descriptionWidget));
    Section footerSection = createFooterSection();

    Card card = new Card(header, Arrays.asList(descriptionSection, footerSection));

    return new GChatMessage(List.of(card));
  }

  private Header createConnectionSuccessfulHeader() {
    return new Header("Connection Successful ✅", getLogoUrl(), "IMAGE");
  }

  private Section createFooterSection() {
    return new Section(List.of(new Widget(new TextParagraph(getProductName() + " Change Event"))));
  }
}

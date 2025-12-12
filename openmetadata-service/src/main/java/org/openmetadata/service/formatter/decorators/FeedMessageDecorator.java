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

import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.formatter.util.FeedMessage;

public class FeedMessageDecorator implements MessageDecorator<FeedMessage> {

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
    return "<span data-diff='true' class=\"diff-added\">";
  }

  @Override
  public String getAddMarkerClose() {
    return "</span>";
  }

  @Override
  public String getRemoveMarker() {
    return "<span data-diff='true' class=\"diff-removed\">";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "</span>";
  }

  @Override
  public String getEntityUrl(String prefix, String fqn, String additionalParams) {
    String encodedFqn = encodeEntityFqnSafe(fqn);
    return String.format(
        "[%s](/%s/%s%s)",
        fqn.trim(),
        prefix,
        encodedFqn,
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams));
  }

  @Override
  public FeedMessage buildEntityMessage(String publisherName, ChangeEvent event) {
    return null;
  }

  @Override
  public FeedMessage buildTestMessage() {
    return null;
  }

  @Override
  public FeedMessage buildThreadMessage(String publisherName, ChangeEvent event) {
    return null;
  }
}

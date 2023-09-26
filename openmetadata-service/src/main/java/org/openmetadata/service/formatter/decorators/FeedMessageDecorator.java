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

import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.formatter.util.FeedMessage;

public class FeedMessageDecorator implements MessageDecorator<FeedMessage> {

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
    return "<span class=\"diff-added\">";
  }

  @Override
  public String getAddMarkerClose() {
    return "</span>";
  }

  @Override
  public String getRemoveMarker() {
    return "<span class=\"diff-removed\">";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "</span>";
  }

  @Override
  public String getEntityUrl(String entityType, String fqn) {
    return String.format("[%s](/%s/%s)", fqn, entityType, fqn.trim());
  }

  @Override
  public FeedMessage buildMessage(ChangeEvent event) {
    return null;
  }
}

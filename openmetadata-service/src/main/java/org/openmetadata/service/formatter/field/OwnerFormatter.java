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

package org.openmetadata.service.formatter.field;

import org.apache.commons.lang.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.resources.feeds.MessageParser;

public class OwnerFormatter extends DefaultFieldFormatter {
  public OwnerFormatter(
      MessageDecorator<?> messageDecorator,
      String fieldOldValue,
      String fieldNewValue,
      String fieldChangeName,
      MessageParser.EntityLink entityLink) {
    super(messageDecorator, fieldOldValue, fieldNewValue, fieldChangeName, entityLink);
  }

  @Override
  public String formatUpdatedField() {
    String diff =
        this.getMessageDecorator().httpRemoveMarker()
            + this.getFieldOldValue()
            + this.getMessageDecorator().httpRemoveMarker()
            + " changed to "
            + this.getMessageDecorator().httpAddMarker()
            + this.getFieldNewValue()
            + this.getMessageDecorator().httpAddMarker();
    String spanAdd = this.getMessageDecorator().getAddMarker();
    String spanAddClose = this.getMessageDecorator().getAddMarkerClose();
    String spanRemove = this.getMessageDecorator().getRemoveMarker();
    String spanRemoveClose = this.getMessageDecorator().getRemoveMarkerClose();
    diff =
        this.getMessageDecorator()
            .replaceMarkers(diff, this.getMessageDecorator().httpAddMarker(), spanAdd, spanAddClose);
    diff =
        this.getMessageDecorator()
            .replaceMarkers(diff, this.getMessageDecorator().httpRemoveMarker(), spanRemove, spanRemoveClose);
    if (CommonUtil.nullOrEmpty(diff)) {
      return StringUtils.EMPTY;
    } else {
      String field = String.format("Updated %s: %s", this.getMessageDecorator().getBold(), diff);
      return String.format(field, this.getFieldChangeName());
    }
  }
}

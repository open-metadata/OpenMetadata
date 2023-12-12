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

import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.resources.feeds.MessageParser;

public class DefaultFieldFormatter implements FieldFormatter {

  private final String fieldChangeName;
  private final String fieldOldValue;
  private final String fieldNewValue;
  private final MessageParser.EntityLink entityLink;
  private final MessageDecorator<?> messageDecorator;

  public DefaultFieldFormatter(
    MessageDecorator<?> messageDecorator,
    String fieldOldValue,
    String fieldNewValue,
    String fieldChangeName,
    MessageParser.EntityLink entityLink
  ) {
    this.messageDecorator = messageDecorator;
    this.fieldChangeName = fieldChangeName;
    this.fieldOldValue = fieldOldValue;
    this.fieldNewValue = fieldNewValue;
    this.entityLink = entityLink;
  }

  @Override
  public String getFieldChangeName() {
    return fieldChangeName;
  }

  @Override
  public String getFieldOldValue() {
    return fieldOldValue;
  }

  @Override
  public String getFieldNewValue() {
    return fieldNewValue;
  }

  @Override
  public String getFormattedMessage(FormatterUtil.CHANGE_TYPE changeType) {
    String message = "";
    switch (changeType) {
      case ADD:
        message = formatAddedField();
        break;
      case UPDATE:
        message = formatUpdatedField();
        break;
      case DELETE:
        message = formatDeletedField();
        break;
      default:
        break;
    }
    return message;
  }

  @Override
  public MessageDecorator<?> getMessageDecorator() {
    return messageDecorator;
  }

  @Override
  public MessageParser.EntityLink getEntityLink() {
    return entityLink;
  }

  public String formatAddedField() {
    String message = this.messageDecorator.httpAddMarker() + this.fieldNewValue + this.messageDecorator.httpAddMarker();
    message = String.format(("Added " + this.messageDecorator.getBold() + ": %s"), this.fieldChangeName, message);
    String spanAdd = this.messageDecorator.getAddMarker();
    String spanAddClose = this.messageDecorator.getAddMarkerClose();
    if (message != null) {
      message =
        this.messageDecorator.replaceMarkers(message, this.messageDecorator.httpAddMarker(), spanAdd, spanAddClose);
    }
    return message;
  }

  public String formatUpdatedField() {
    String message = this.messageDecorator.getPlaintextDiff(this.fieldOldValue, this.fieldNewValue);
    message = String.format("Updated %s: %s", this.messageDecorator.getBold(), message);
    return String.format(message, this.fieldChangeName);
  }

  public String formatDeletedField() {
    String message =
      this.messageDecorator.httpRemoveMarker() + this.fieldOldValue + this.messageDecorator.httpRemoveMarker();
    message = String.format(("Deleted " + this.messageDecorator.getBold() + ": %s"), this.fieldChangeName, message);
    String spanRemove = this.messageDecorator.getRemoveMarker();
    String spanRemoveClose = this.messageDecorator.getRemoveMarkerClose();
    if (message != null) {
      message =
        this.messageDecorator.replaceMarkers(
            message,
            this.messageDecorator.httpRemoveMarker(),
            spanRemove,
            spanRemoveClose
          );
    }
    return message;
  }
}

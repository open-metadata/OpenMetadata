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
import org.openmetadata.service.resources.feeds.MessageParser;

public class TagFormatter extends DefaultFieldFormatter {

  public TagFormatter(
    MessageDecorator<?> messageDecorator,
    String fieldOldValue,
    String fieldNewValue,
    String fieldChangeName,
    MessageParser.EntityLink entityLink
  ) {
    super(messageDecorator, fieldOldValue, fieldNewValue, fieldChangeName, entityLink);
  }

  @Override
  public String formatAddedField() {
    String message =
      this.getMessageDecorator().httpAddMarker() + this.getFieldNewValue() + this.getMessageDecorator().httpAddMarker();
    if (this.getEntityLink().getArrayFieldName() != null && this.getEntityLink().getArrayFieldValue() != null) {
      message =
        String.format(
          (
            "Added " +
            this.getMessageDecorator().getBold() +
            " to " +
            getTransformedName(this.getEntityLink().getFieldName()) +
            " " +
            this.getMessageDecorator().getBold() +
            ": %s"
          ),
          this.getEntityLink().getArrayFieldValue(),
          this.getEntityLink().getArrayFieldName(),
          message
        );
    } else {
      message =
        String.format(("Added " + this.getMessageDecorator().getBold() + ": %s"), this.getFieldChangeName(), message);
    }
    String spanAdd = this.getMessageDecorator().getAddMarker();
    String spanAddClose = this.getMessageDecorator().getAddMarkerClose();
    if (message != null) {
      message =
        this.getMessageDecorator()
          .replaceMarkers(message, this.getMessageDecorator().httpAddMarker(), spanAdd, spanAddClose);
    }
    return message;
  }

  @Override
  public String formatUpdatedField() {
    String diff =
      this.getMessageDecorator().httpRemoveMarker() +
      this.getFieldOldValue() +
      this.getMessageDecorator().httpRemoveMarker() +
      " changed to " +
      this.getMessageDecorator().httpAddMarker() +
      this.getFieldNewValue() +
      this.getMessageDecorator().httpAddMarker();
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
    String message;
    if (this.getEntityLink().getArrayFieldName() != null && this.getEntityLink().getArrayFieldValue() != null) {
      message =
        String.format(
          (
            "Updated " +
            this.getMessageDecorator().getBold() +
            " of " +
            getTransformedName(this.getEntityLink().getFieldName()) +
            " " +
            this.getMessageDecorator().getBold() +
            ": %s"
          ),
          this.getEntityLink().getArrayFieldValue(),
          this.getEntityLink().getArrayFieldName(),
          diff
        );
    } else {
      message =
        String.format(("Updated " + this.getMessageDecorator().getBold() + ": %s"), this.getFieldChangeName(), diff);
    }
    return String.format(message, this.getFieldChangeName());
  }

  @Override
  public String formatDeletedField() {
    String message =
      this.getMessageDecorator().httpRemoveMarker() +
      this.getFieldOldValue() +
      this.getMessageDecorator().httpRemoveMarker();
    if (this.getEntityLink().getArrayFieldName() != null && this.getEntityLink().getArrayFieldValue() != null) {
      message =
        String.format(
          (
            "Deleted " +
            this.getMessageDecorator().getBold() +
            " from " +
            getTransformedName(this.getEntityLink().getFieldName()) +
            " " +
            this.getMessageDecorator().getBold() +
            ": %s"
          ),
          this.getEntityLink().getArrayFieldValue(),
          this.getEntityLink().getArrayFieldName(),
          message
        );
    } else {
      message =
        String.format(("Deleted " + this.getMessageDecorator().getBold() + ": %s"), this.getFieldChangeName(), message);
    }
    String spanAdd = this.getMessageDecorator().getRemoveMarker();
    String spanAddClose = this.getMessageDecorator().getRemoveMarkerClose();
    if (message != null) {
      message =
        this.getMessageDecorator()
          .replaceMarkers(message, this.getMessageDecorator().httpRemoveMarker(), spanAdd, spanAddClose);
    }
    return message;
  }

  private String getTransformedName(String fieldName) {
    if ("columns".equals(fieldName)) {
      return "column";
    }
    return fieldName;
  }
}
